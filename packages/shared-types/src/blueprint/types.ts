export interface BlueprintSnapshot {
  id: string;
  projectId: string;
  commitSha: string;
  branch: string;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  metadata: BlueprintMetadata;
  createdAt: string;
}

export type BlueprintNodeType =
  | 'system' | 'service' | 'module'
  | 'application' | 'page' | 'component' | 'api-route' | 'server-action'
  | 'database' | 'table' | 'schema' | 'migration'
  | 'deployment' | 'function' | 'bucket' | 'queue'
  | 'domain' | 'interface' | 'event';

export interface BlueprintNode {
  id: string;
  type: BlueprintNodeType;
  name: string;
  path: string | null;
  metadata: Record<string, unknown>;
  position?: { x: number; y: number };
}

export type BlueprintEdgeType =
  | 'contains' | 'extends' | 'implements'
  | 'imports' | 'depends-on' | 'uses'
  | 'calls' | 'http-calls' | 'emits' | 'subscribes'
  | 'reads' | 'writes' | 'migrates'
  | 'deploys-to' | 'routes-to'
  | 'adheres-to' | 'violates';

export interface BlueprintEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: BlueprintEdgeType;
  metadata?: Record<string, unknown>;
}

export interface BlueprintMetadata {
  totalFiles: number;
  totalSymbols: number;
  languageBreakdown: Record<string, number>;
  frameworkDetected: string[];
  architecturePattern: string;
}

export interface DriftFinding {
  id: string;
  severity: 'info' | 'warning' | 'error';
  rule: string;
  message: string;
  sourceNodeId: string;
  targetNodeId?: string;
  codeLocation?: string;
  suggestedFix?: string;
}

export interface ImpactAnalysis {
  target: string;
  change: 'modify' | 'delete' | 'rename';
  directImpact: string[];
  indirectImpact: string[];
  filesToModify: string[];
  estimatedEffort: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
}
