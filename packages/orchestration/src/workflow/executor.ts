import type { AIProviderAdapter } from '@platform/ai-sdk';
import type { WorkflowStep, WorkflowContext } from '../types.js';

type ToolHandler = (input: Record<string, unknown>, context: WorkflowContext) => Promise<string>;

const toolRegistry = new Map<string, ToolHandler>();

export function registerTool(name: string, handler: ToolHandler): void {
  toolRegistry.set(name, handler);
}

export function clearTools(): void {
  toolRegistry.clear();
}

function resolveTemplate(template: string | undefined, context: WorkflowContext): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+\.?\w*)\}\}/g, (_, key) => {
    const parts = (key as string).split('.');
    if (parts[0] === 'variables') return String(context.variables[parts[1]!] ?? '');
    if (parts[0] === 'stepResults') return String(context.stepResults[parts[1]!] ?? '');
    if (parts[0] === 'artifacts') return context.artifacts[parts[1]!] ?? '';
    return '';
  });
}

export async function executeStep(
  step: WorkflowStep,
  context: WorkflowContext,
  provider?: AIProviderAdapter,
): Promise<{ status: string; output: string; artifacts?: Record<string, string> }> {
  const inputStr = resolveTemplate(
    typeof step.input === 'string' ? step.input : JSON.stringify(step.input),
    context,
  );

  const agentPrompts: Record<string, string> = {
    architect: 'Analyze the system architecture and provide recommendations.',
    planner: 'Create a detailed implementation plan with steps and dependencies.',
    frontend: 'Implement frontend code changes based on the requirements.',
    backend: 'Implement backend API and service changes.',
    database: 'Design and implement database schema and migrations.',
    infrastructure: 'Design and provision infrastructure resources.',
    security: 'Perform a security review of the changes.',
    tester: 'Write tests for the implemented changes.',
    documentarian: 'Create comprehensive documentation for the changes.',
    reviewer: 'Review the code changes for quality and best practices.',
    'release-manager': 'Manage the release process and versioning.',
  };

  const prompt = agentPrompts[step.agent] ?? `Execute step: ${step.name}`;

  try {
    if (provider && step.agent !== 'reviewer') {
      const result = await provider.complete({
        model: 'claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: `You are a ${step.agent} agent. ${prompt}` },
          { role: 'user', content: inputStr || `Execute: ${step.name}\n\nDescription: ${step.description}` },
        ],
      });

      return {
        status: 'completed',
        output: result.content,
        artifacts: {},
      };
    }

    const toolName = step.input.tool as string | undefined;
    if (toolName && toolRegistry.has(toolName)) {
      const result = await toolRegistry.get(toolName)!(step.input, context);
      return { status: 'completed', output: result };
    }

    return {
      status: 'completed',
      output: `Executed step "${step.name}" (agent: ${step.agent})`,
      artifacts: { [`${step.id}-result`]: `Step ${step.name} completed` },
    };
  } catch (err) {
    return {
      status: 'failed',
      output: `Error: ${(err as Error).message}`,
    };
  }
}
