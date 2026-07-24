import type { TokenUsage } from '../ai/types.js';

export type AgentType =
  | 'architect'
  | 'planner'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'infrastructure'
  | 'security'
  | 'tester'
  | 'documentarian'
  | 'reviewer'
  | 'release-manager';

export type AgentAuthority = 'observe' | 'propose' | 'execute' | 'approve';

export type TokenBudget = {
  monthlyLimit: number;
  dailyLimit: number;
  perRequestLimit: number;
  costLimit: number;
};

export interface Task {
  id: string;
  projectId: string;
  parentId?: string;
  dependencies: string[];
  assignee: AgentType;
  goal: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: TaskStatus;
  plan: TaskPlan | null;
  result: TaskResult | null;
  budget: TokenBudget;
  approvalGates: ApprovalGate[];
  createdAt: string;
  completedAt?: string;
}

export type TaskStatus =
  | 'queued'
  | 'planning'
  | 'executing'
  | 'waiting'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskPlan {
  steps: TaskStep[];
  estimatedTokens: number;
  estimatedCostUsd: number;
  tools: string[];
}

export interface TaskStep {
  id: string;
  description: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface TaskResult {
  summary: string;
  artifacts: Artifact[];
  tokenUsage: TokenUsage;
  durationMs: number;
}

export interface Artifact {
  path: string;
  content: string;
  type: 'code' | 'config' | 'documentation' | 'test';
}

export interface ApprovalGate {
  id: string;
  type: 'destructive' | 'deployment' | 'schema-change' | 'dependency' | 'security';
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approvedBy?: string;
  notes?: string;
  timestamp?: string;
}

export interface AgentEvent {
  type: 'task.completed' | 'artifact.created' | 'question' | 'answer' | 'review.requested'
       | 'review.completed' | 'error' | 'progress';
  taskId: string;
  payload: unknown;
  timestamp: string;
}
