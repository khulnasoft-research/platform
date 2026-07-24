export type ModelTier = 'fast' | 'balanced' | 'capable' | 'reasoning';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'openrouter' | 'local';

export interface AIModel {
  id: string;
  provider: AIProvider;
  name: string;
  tier: ModelTier;
  features: ModelFeature[];
  contextWindow: number;
  maxOutputTokens: number;
  pricing: {
    inputPerMillionTokens: number;
    outputPerMillionTokens: number;
  };
}

export type ModelFeature =
  | 'chat'
  | 'streaming'
  | 'vision'
  | 'tools'
  | 'structured-output'
  | 'reasoning'
  | 'embedding';

export interface AIRequest {
  model?: string;
  messages: Message[];
  stream: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolConfig[];
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
}

export interface Attachment {
  type: 'image' | 'file' | 'figma' | 'code';
  url?: string;
  content?: string;
  mimeType?: string;
}

export interface ToolConfig {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AIResponse {
  requestId: string;
  model: string;
  provider: AIProvider;
  content: string;
  usage: TokenUsage;
  latencyMs: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface AILogEntry {
  id: string;
  timestamp: string;
  organizationId: string;
  projectId: string;
  userId: string;
  agentId?: string;
  feature: string;
  provider: AIProvider;
  model: string;
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  error?: string;
  fallbackChain: string[];
}
