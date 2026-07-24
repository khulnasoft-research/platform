import type { AIProvider, ModelTier, Message } from '@platform/shared-types';

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AIRequestOptions {
  model?: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface CompletionParams {
  model: string;
  tier: ModelTier;
  features: string[];
  contextWindow: number;
}

export type StreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; message: string }
  | { type: 'tool-call'; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; name: string; result: unknown };
