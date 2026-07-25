import { ProviderRegistry, type ProviderConfig } from '@platform/ai-sdk';
import type { WorkflowDefinition, WorkflowExecution, WorkflowStep } from '../types.js';
import { executeStep } from './executor.js';

const executions = new Map<string, WorkflowExecution>();
const approvalGates = new Map<string, Array<{ stepId: string; resolve: (approved: boolean) => void }>>();

export class WorkflowEngine {
  private definitions = new Map<string, WorkflowDefinition>();
  private listeners = new Map<string, Set<(event: string, data: unknown) => void>>();
  private providerRegistry = new ProviderRegistry();

  constructor(providerConfigs?: ProviderConfig[]) {
    if (providerConfigs) {
      for (const cfg of providerConfigs) {
        try {
          this.providerRegistry.register(cfg);
        } catch {}
      }
    }
  }

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

  async approveStep(executionId: string, stepId: string): Promise<boolean> {
    const execution = executions.get(executionId);
    if (!execution) return false;
    if (execution.status !== 'paused') return false;

    const gates = approvalGates.get(executionId);
    if (!gates) return false;

    const gate = gates.find((g) => g.stepId === stepId);
    if (!gate) return false;

    gate.resolve(true);
    gates.splice(gates.indexOf(gate), 1);
    if (gates.length === 0) approvalGates.delete(executionId);

    execution.status = 'running';
    this.emit(execution.workflowId, 'step-approved', { executionId, stepId });
    return true;
  }

  async rejectStep(executionId: string, stepId: string): Promise<boolean> {
    const execution = executions.get(executionId);
    if (!execution) return false;
    if (execution.status !== 'paused') return false;

    const gates = approvalGates.get(executionId);
    if (!gates) return false;

    const gate = gates.find((g) => g.stepId === stepId);
    if (!gate) return false;

    gate.resolve(false);
    gates.splice(gates.indexOf(gate), 1);
    if (gates.length === 0) approvalGates.delete(executionId);

    execution.status = 'failed';
    execution.error = `Step ${stepId} rejected`;
    this.emit(execution.workflowId, 'step-rejected', { executionId, stepId });
    return true;
  }

  private async execute(execution: WorkflowExecution, def: WorkflowDefinition): Promise<void> {
    const sorted = this.topologicalSort(def.steps);

    const provider = this.providerRegistry.has('anthropic')
      ? this.providerRegistry.get('anthropic')
      : this.providerRegistry.has('openai')
        ? this.providerRegistry.get('openai')
        : undefined;

    for (const step of sorted) {
      if (execution.status === 'cancelled' || execution.status === 'failed') return;

      execution.currentStep = step.id;
      this.emit(def.id, 'step-start', { executionId: execution.id, step });

      if (step.approvalRequired) {
        execution.status = 'paused';
        this.emit(def.id, 'step-awaiting-approval', { executionId: execution.id, step });

        const approved = await this.waitForApproval(execution.id, step.id);
        if (!approved) {
          execution.status = 'failed';
          execution.error = `Step ${step.id} was rejected`;
          this.emit(def.id, 'step-rejected', { executionId: execution.id, step });
          return;
        }
        execution.status = 'running';
      }

      const result = await executeStep(step, execution.context, provider);

      execution.context.stepResults[step.id] = {
        status: result.status,
        startedAt: new Date().toISOString(),
        output: result.output,
      };

      if (result.artifacts) {
        Object.assign(execution.context.artifacts, result.artifacts);
      }

      if (result.status === 'failed') {
        if (def.onFailure === 'skip') {
          this.emit(def.id, 'step-skipped', { executionId: execution.id, step, error: result.output });
          continue;
        }
        if (def.onFailure === 'retry' && step.retries && step.retries > 0) {
          let retriesLeft = step.retries;
          let retryResult = result;
          while (retriesLeft > 0 && retryResult.status === 'failed') {
            retriesLeft--;
            retryResult = await executeStep(step, execution.context, provider);
          }
          if (retryResult.status === 'failed') {
            execution.status = 'failed';
            execution.error = retryResult.output;
            this.emit(def.id, 'failed', execution);
            return;
          }
          execution.context.stepResults[step.id] = {
            status: retryResult.status,
            startedAt: new Date().toISOString(),
            output: retryResult.output,
          };
        } else {
          execution.status = 'failed';
          execution.error = result.output;
          this.emit(def.id, 'failed', execution);
          return;
        }
      }

      this.emit(def.id, 'step-complete', { executionId: execution.id, step, output: result.output });
    }

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
    execution.currentStep = null;
    this.emit(def.id, 'completed', execution);
  }

  private waitForApproval(executionId: string, stepId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!approvalGates.has(executionId)) {
        approvalGates.set(executionId, []);
      }
      approvalGates.get(executionId)!.push({ stepId, resolve });
    });
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
