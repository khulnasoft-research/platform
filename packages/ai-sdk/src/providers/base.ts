import type { AIProvider, AIModel } from '@platform/shared-types';
import type { AIRequestOptions, StreamEvent, ProviderConfig } from '../types.js';

export interface AIProviderAdapter {
  provider: AIProvider;
  models(): Promise<AIModel[]>;
  complete(req: AIRequestOptions): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
    latencyMs: number;
  }>;
  stream(req: AIRequestOptions): AsyncGenerator<StreamEvent>;
}

export abstract class ProviderBase implements AIProviderAdapter {
  abstract provider: AIProvider;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract models(): Promise<AIModel[]>;

  abstract complete(req: AIRequestOptions): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
    latencyMs: number;
  }>;

  abstract stream(req: AIRequestOptions): AsyncGenerator<StreamEvent>;

  protected buildEndpoint(path: string): string {
    return `${this.config.baseUrl ?? this.defaultBaseUrl()}${path}`;
  }

  protected abstract defaultBaseUrl(): string;

  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
