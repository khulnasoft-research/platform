import type { AgentType } from '@platform/shared-types';

export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  timeout?: number;
  onFailure?: 'abort' | 'skip' | 'retry';
  maxRetries?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agent: AgentType;
  description: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  timeout?: number;
  retries?: number;
  approvalRequired?: boolean;
  transformers?: {
    input?: string;
    output?: string;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  currentStep: string | null;
  context: WorkflowContext;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowContext {
  variables: Record<string, unknown>;
  artifacts: Record<string, string>;
  stepResults: Record<string, unknown>;
}
