import type { AIProvider } from '@platform/shared-types';
import type { AIProviderAdapter } from './base.js';
import type { ProviderConfig } from '../types.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { GoogleAdapter } from './google.js';

export class ProviderRegistry {
  private adapters = new Map<AIProvider, AIProviderAdapter>();

  register(config: ProviderConfig): AIProviderAdapter {
    const adapter = this.createAdapter(config);
    this.adapters.set(config.provider, adapter);
    return adapter;
  }

  get(provider: AIProvider): AIProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`Provider not registered: ${provider}`);
    return adapter;
  }

  has(provider: AIProvider): boolean {
    return this.adapters.has(provider);
  }

  all(): AIProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  private createAdapter(config: ProviderConfig): AIProviderAdapter {
    switch (config.provider) {
      case 'openai': return new OpenAIAdapter(config);
      case 'anthropic': return new AnthropicAdapter(config);
      case 'google': return new GoogleAdapter(config);
      default: throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
