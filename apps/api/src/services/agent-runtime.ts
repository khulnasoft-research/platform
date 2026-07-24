import type {
  AgentType,
  Task,
  TaskPlan,
  TaskStep,
  TaskResult,
  Artifact,
} from '@platform/shared-types';
import { aiGateway } from './ai-gateway.js';

interface AgentCapability {
  type: AgentType;
  name: string;
  description: string;
  defaultModel: string;
  tools: string[];
  canDelegate: AgentType[];
}

const agentRegistry: AgentCapability[] = [
  {
    type: 'architect',
    name: 'Architect Agent',
    description: 'Designs system architecture and makes high-level design decisions',
    defaultModel: 'claude-sonnet-4',
    tools: ['analyze-codebase', 'search-docs', 'create-blueprint'],
    canDelegate: ['planner', 'frontend', 'backend', 'database', 'security'],
  },
  {
    type: 'planner',
    name: 'Planner Agent',
    description: 'Breaks down goals into executable task plans',
    defaultModel: 'claude-sonnet-4',
    tools: ['analyze-requirements', 'estimate-effort', 'create-plan'],
    canDelegate: ['frontend', 'backend', 'database', 'infrastructure'],
  },
  {
    type: 'frontend',
    name: 'Frontend Agent',
    description: 'Builds UI components, pages, and client-side logic',
    defaultModel: 'claude-sonnet-4',
    tools: ['read-files', 'write-files', 'install-packages', 'run-tests'],
    canDelegate: ['tester', 'reviewer'],
  },
  {
    type: 'backend',
    name: 'Backend Agent',
    description: 'Builds API routes, services, data access layers',
    defaultModel: 'claude-sonnet-4',
    tools: ['read-files', 'write-files', 'db-migrate', 'run-tests'],
    canDelegate: ['tester', 'security', 'reviewer'],
  },
  {
    type: 'database',
    name: 'Database Agent',
    description: 'Designs schemas, writes migrations, optimizes queries',
    defaultModel: 'gpt-4o',
    tools: ['db-migrate', 'db-query', 'analyze-schema', 'write-files'],
    canDelegate: ['reviewer'],
  },
  {
    type: 'tester',
    name: 'Tester Agent',
    description: 'Writes and runs unit/integration/e2e tests',
    defaultModel: 'gpt-4o-mini',
    tools: ['read-files', 'write-files', 'run-tests', 'analyze-coverage'],
    canDelegate: [],
  },
  {
    type: 'reviewer',
    name: 'Reviewer Agent',
    description: 'Reviews code for quality, security, and best practices',
    defaultModel: 'claude-sonnet-4',
    tools: ['read-files', 'diff-files', 'lint-check', 'security-scan'],
    canDelegate: [],
  },
  {
    type: 'security',
    name: 'Security Agent',
    description: 'Audits code for vulnerabilities and compliance',
    defaultModel: 'claude-opus-4',
    tools: ['security-scan', 'analyze-dependencies', 'read-files'],
    canDelegate: ['reviewer'],
  },
];

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

const toolRegistry: ToolDefinition[] = [
  { name: 'read-files', description: 'Read files from the project', parameters: { path: 'string' } },
  { name: 'write-files', description: 'Create or modify files', parameters: { path: 'string', content: 'string' } },
  { name: 'run-tests', description: 'Run test suite', parameters: { command: 'string' } },
  { name: 'install-packages', description: 'Install npm packages', parameters: { packages: 'string[]' } },
  { name: 'db-migrate', description: 'Run database migrations', parameters: { name: 'string', sql: 'string' } },
  { name: 'db-query', description: 'Execute database queries', parameters: { sql: 'string' } },
  { name: 'analyze-codebase', description: 'Analyze project structure and dependencies', parameters: {} },
  { name: 'analyze-requirements', description: 'Analyze requirements from goal description', parameters: { goal: 'string' } },
  { name: 'analyze-schema', description: 'Analyze database schema', parameters: {} },
  { name: 'analyze-coverage', description: 'Analyze test coverage', parameters: {} },
  { name: 'analyze-dependencies', description: 'Analyze dependency tree for vulnerabilities', parameters: {} },
  { name: 'create-blueprint', description: 'Create or update architecture blueprint', parameters: { nodes: 'string' } },
  { name: 'create-plan', description: 'Create an execution plan', parameters: { goal: 'string', steps: 'string[]' } },
  { name: 'estimate-effort', description: 'Estimate effort and cost for tasks', parameters: { description: 'string' } },
  { name: 'search-docs', description: 'Search documentation', parameters: { query: 'string' } },
  { name: 'diff-files', description: 'Show diff between file versions', parameters: { path: 'string', baseRef: 'string' } },
  { name: 'lint-check', description: 'Run linter on files', parameters: { path: 'string' } },
  { name: 'security-scan', description: 'Scan for security vulnerabilities', parameters: { path: 'string' } },
];

class AgentRuntime {
  private taskQueue = new Map<string, Task>();

  getAgent(type: AgentType): AgentCapability | undefined {
    return agentRegistry.find((a) => a.type === type);
  }

  getAgents(): AgentCapability[] {
    return agentRegistry;
  }

  getTools(): ToolDefinition[] {
    return toolRegistry;
  }

  async createPlan(task: Task): Promise<TaskPlan> {
    const agent = this.getAgent(task.assignee);
    if (!agent) throw new Error(`Unknown agent type: ${task.assignee}`);

    const prompt = `You are a ${agent.name}. Your goal is: "${task.goal}".
Available tools: ${agent.tools.join(', ')}.
Create a step-by-step plan to accomplish this goal.`;

    const response = await aiGateway.chat({
      model: agent.defaultModel,
      messages: [
        { role: 'system', content: 'You are an AI agent creating execution plans.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    });

    const parsed = this.parsePlanFromResponse(response.content, agent.tools);

    return {
      steps: parsed.steps,
      estimatedTokens: response.usage.totalTokens,
      estimatedCostUsd: response.usage.costUsd,
      tools: agent.tools,
    };
  }

  private parsePlanFromResponse(content: string, availableTools: string[]): { steps: TaskStep[] } {
    const lines = content.split('\n').filter((l) => l.trim());
    const steps: TaskStep[] = [];

    for (const line of lines) {
      const toolMatch = line.match(/tool:\s*(\S+)/i);
      const tool = toolMatch?.[1] ?? '';
      if (tool && availableTools.includes(tool)) {
        steps.push({
          id: crypto.randomUUID(),
          description: line.replace(/tool:\s*\S+/i, '').trim() || `Execute ${tool}`,
          tool,
          args: {},
        });
      }
    }

    if (steps.length === 0) {
      steps.push({
        id: crypto.randomUUID(),
        description: `Execute ${availableTools[0] ?? 'read-files'} to work on: ${content.slice(0, 100)}`,
        tool: availableTools[0] ?? 'read-files',
        args: {},
      });
    }

    return { steps };
  }

  async executeTask(task: Task, plan: TaskPlan): Promise<TaskResult> {
    const agent = this.getAgent(task.assignee);
    if (!agent) throw new Error(`Unknown agent type: ${task.assignee}`);

    const artifacts: Artifact[] = [];
    const startedAt = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const step of plan.steps) {
      if (step.tool === 'write-files') {
        artifacts.push({
          path: `src/generated/${task.id}/${step.id}.ts`,
          content: `// Generated by ${agent.name} for: ${step.description}`,
          type: 'code',
        });
      }

      const response = await aiGateway.chat({
        model: agent.defaultModel,
        messages: [
          {
            role: 'system',
            content: `You are ${agent.name}. Execute step: ${step.description} using ${step.tool}.`,
          },
          { role: 'user', content: `Goal: ${task.goal}\nStep: ${step.description}\nTool: ${step.tool}` },
        ],
        stream: false,
      });

      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;
    }

    const summary = `Task completed by ${agent.name}. Generated ${artifacts.length} artifacts.`;

    return {
      summary,
      artifacts,
      tokenUsage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        costUsd: (totalInputTokens / 1_000_000) * 3 + (totalOutputTokens / 1_000_000) * 15,
      },
      durationMs: Date.now() - startedAt,
    };
  }

  async submitTask(task: Task): Promise<Task> {
    task.status = 'planning';
    this.taskQueue.set(task.id, task);

    try {
      const plan = await this.createPlan(task);
      task.plan = plan;

      const needsApproval = task.approvalGates.length > 0 &&
        task.approvalGates.some((g) => g.status === 'pending');

      if (needsApproval) {
        task.status = 'waiting';
      } else {
        task.status = 'executing';
        const result = await this.executeTask(task, plan);
        task.result = result;
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
      }
    } catch (err) {
      task.status = 'failed';
      task.result = {
        summary: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        artifacts: [],
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        durationMs: 0,
      };
    }

    this.taskQueue.set(task.id, task);
    return task;
  }

  async approveGate(task: Task, gateId: string, approved: boolean, userId?: string, notes?: string): Promise<Task> {
    const gate = task.approvalGates.find((g) => g.id === gateId);
    if (!gate) throw new Error(`Gate not found: ${gateId}`);

    gate.status = approved ? 'approved' : 'rejected';
    gate.approvedBy = userId;
    gate.notes = notes;
    gate.timestamp = new Date().toISOString();

    if (approved && task.plan) {
      task.status = 'executing';
      try {
        const result = await this.executeTask(task, task.plan);
        task.result = result;
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
      } catch {
        task.status = 'failed';
      }
    }

    this.taskQueue.set(task.id, task);
    return task;
  }
}

export const agentRuntime = new AgentRuntime();
