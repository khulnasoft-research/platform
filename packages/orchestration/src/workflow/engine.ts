import type { WorkflowDefinition, WorkflowExecution, WorkflowStep } from '../types.js';

const executions = new Map<string, WorkflowExecution>();

export class WorkflowEngine {
  private definitions = new Map<string, WorkflowDefinition>();
  private listeners = new Map<string, Set<(event: string, data: unknown) => void>>();

  register(def: WorkflowDefinition): void {
    this.definitions.set(def.id, def);
  }

  getDefinition(id: string): WorkflowDefinition | undefined {
    return this.definitions.get(id);
  }

  async start(
    workflowId: string,
    initialVars: Record<string, unknown> = {},
  ): Promise<WorkflowExecution> {
    const def = this.definitions.get(workflowId);
    if (!def) throw new Error(`Workflow not found: ${workflowId}`);

    const execution: WorkflowExecution = {
      id: crypto.randomUUID(),
      workflowId,
      status: 'running',
      currentStep: null,
      context: {
        variables: { ...initialVars },
        artifacts: {},
        stepResults: {},
      },
      startedAt: new Date().toISOString(),
    };

    executions.set(execution.id, execution);
    this.emit(workflowId, 'started', execution);

    try {
      await this.execute(execution, def);
    } catch (err) {
      execution.status = 'failed';
      execution.error = (err as Error).message;
      this.emit(workflowId, 'failed', execution);
    }

    return execution;
  }

  getExecution(id: string): WorkflowExecution | undefined {
    return executions.get(id);
  }

  on(workflowId: string, handler: (event: string, data: unknown) => void): () => void {
    if (!this.listeners.has(workflowId)) {
      this.listeners.set(workflowId, new Set());
    }
    this.listeners.get(workflowId)!.add(handler);
    return () => this.listeners.get(workflowId)?.delete(handler);
  }

  listExecutions(workflowId?: string): WorkflowExecution[] {
    const all = Array.from(executions.values());
    return workflowId ? all.filter((e) => e.workflowId === workflowId) : all;
  }

  private async execute(execution: WorkflowExecution, def: WorkflowDefinition): Promise<void> {
    const sorted = this.topologicalSort(def.steps);

    for (const step of sorted) {
      if (execution.status === 'cancelled') return;

      execution.currentStep = step.id;
      this.emit(def.id, 'step-start', { executionId: execution.id, step });

      execution.context.variables.lastCompletedStep = step.id;
      execution.context.stepResults[step.id] = {
        status: 'completed',
        startedAt: new Date().toISOString(),
      };

      this.emit(def.id, 'step-complete', { executionId: execution.id, step });
    }

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
    execution.currentStep = null;
    this.emit(def.id, 'completed', execution);
  }

  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
    const visited = new Set<string>();
    const sorted: WorkflowStep[] = [];
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    function visit(id: string) {
      if (visited.has(id)) return;
      visited.add(id);
      const step = stepMap.get(id);
      if (!step) return;
      for (const dep of step.dependsOn) visit(dep);
      sorted.push(step);
    }

    for (const step of steps) visit(step.id);
    return sorted;
  }

  private emit(workflowId: string, event: string, data: unknown): void {
    this.listeners.get(workflowId)?.forEach((h) => h(event, data));
  }
}
