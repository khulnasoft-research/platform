import type { AIProvider, ModelTier, ModelFeature, TokenUsage, AILogEntry, Message } from '@platform/shared-types';
import { ProviderRegistry, type AIProviderAdapter } from '@platform/ai-sdk';

interface ModelRoute {
  modelId: string;
  name: string;
  provider: AIProvider;
  tier: ModelTier;
  features: ModelFeature[];
  contextWindow: number;
  maxOutputTokens: number;
  pricing: { inputPerMillionTokens: number; outputPerMillionTokens: number };
  fallbacks: AIProvider[];
}

interface ProviderStatus {
  provider: AIProvider;
  healthy: boolean;
  lastCheck: string;
  latencyMs: number;
  rateLimitRemaining: number;
}

interface GatewayRequest {
  model?: string;
  messages: Message[];
  stream: boolean;
  temperature?: number;
  maxTokens?: number;
  skipCache?: boolean;
}

interface GatewayMeta {
  requestId: string;
  model: string;
  provider: AIProvider;
  tier: ModelTier;
  startedAt: string;
  cached: boolean;
  fallbackChain: AIProvider[];
}

interface GatewayResult {
  meta: GatewayMeta;
  content: string;
  usage: TokenUsage;
  latencyMs: number;
}

const modelRegistry: ModelRoute[] = [
  {
    modelId: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    tier: 'balanced',
    features: ['chat', 'streaming', 'vision', 'tools', 'structured-output'],
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPerMillionTokens: 3, outputPerMillionTokens: 15 },
    fallbacks: ['openai'],
  },
  {
    modelId: 'claude-haiku-4',
    name: 'Claude Haiku 4',
    provider: 'anthropic',
    tier: 'fast',
    features: ['chat', 'streaming', 'vision', 'tools'],
    contextWindow: 100000,
    maxOutputTokens: 4096,
    pricing: { inputPerMillionTokens: 0.8, outputPerMillionTokens: 4 },
    fallbacks: ['openai'],
  },
  {
    modelId: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    tier: 'reasoning',
    features: ['chat', 'streaming', 'vision', 'tools', 'structured-output', 'reasoning'],
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPerMillionTokens: 15, outputPerMillionTokens: 75 },
    fallbacks: ['openai', 'google'],
  },
  {
    modelId: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    tier: 'balanced',
    features: ['chat', 'streaming', 'vision', 'tools', 'structured-output'],
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { inputPerMillionTokens: 2.5, outputPerMillionTokens: 10 },
    fallbacks: ['anthropic'],
  },
  {
    modelId: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    tier: 'fast',
    features: ['chat', 'streaming'],
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { inputPerMillionTokens: 0.15, outputPerMillionTokens: 0.6 },
    fallbacks: ['anthropic'],
  },
  {
    modelId: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    tier: 'fast',
    features: ['chat', 'streaming', 'vision', 'tools'],
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    pricing: { inputPerMillionTokens: 0.1, outputPerMillionTokens: 0.4 },
    fallbacks: ['openai'],
  },
  {
    modelId: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'google',
    tier: 'capable',
    features: ['chat', 'streaming', 'vision', 'tools', 'structured-output'],
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    pricing: { inputPerMillionTokens: 1.5, outputPerMillionTokens: 2.5 },
    fallbacks: ['anthropic', 'openai'],
  },
];

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

const MODEL_TO_ADAPTER_MODEL: Record<string, string> = {
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-haiku-4': 'claude-sonnet-4-20250514',
  'claude-opus-4': 'claude-opus-4-20250514',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-2.0-pro': 'gemini-2.0-pro',
};

class AiGateway {
  private registry: ProviderRegistry;
  private cache = new Map<string, string>();
  private usageLog: AILogEntry[] = [];
  private providerStatus = new Map<AIProvider, ProviderStatus>();
  private rateLimiters = new Map<string, RateLimitStore>();
  private simulateMode: boolean;

  constructor() {
    this.registry = new ProviderRegistry();
    this.simulateMode = true;

    const providerConfigs: Array<{ provider: AIProvider; envKey: string }> = [
      { provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
      { provider: 'openai', envKey: 'OPENAI_API_KEY' },
      { provider: 'google', envKey: 'GOOGLE_GENERATIVE_AI_API_KEY' },
    ];

    for (const cfg of providerConfigs) {
      const apiKey = process.env[cfg.envKey];
      if (apiKey) {
        try {
          this.registry.register({ provider: cfg.provider, apiKey });
          this.providerStatus.set(cfg.provider, {
            provider: cfg.provider,
            healthy: true,
            lastCheck: new Date().toISOString(),
            latencyMs: 0,
            rateLimitRemaining: 10000,
          });
          this.simulateMode = false;
        } catch {
          this.markUnhealthy(cfg.provider);
        }
      } else {
        this.markUnhealthy(cfg.provider);
      }
    }
  }

  private markUnhealthy(provider: AIProvider): void {
    this.providerStatus.set(provider, {
      provider,
      healthy: false,
      lastCheck: new Date().toISOString(),
      latencyMs: 0,
      rateLimitRemaining: 0,
    });
  }

  getModelRoute(modelId: string): ModelRoute | undefined {
    return modelRegistry.find((m) => m.modelId === modelId);
  }

  getModels() {
    return modelRegistry.map((m) => ({
      id: m.modelId,
      provider: m.provider,
      name: m.name,
      tier: m.tier,
      features: m.features,
    }));
  }

  getProviderStatus(): ProviderStatus[] {
    return Array.from(this.providerStatus.values());
  }

  getUsageStats() {
    const stats = {
      totalRequests: this.usageLog.length,
      totalTokens: this.usageLog.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0),
      totalCostUsd: this.usageLog.reduce((s, e) => s + e.costUsd, 0),
      cacheHits: this.usageLog.filter((e) => e.cacheHit).length,
      byProvider: {} as Record<string, { requests: number; tokens: number; costUsd: number }>,
      byTier: {} as Record<string, { requests: number; tokens: number; costUsd: number }>,
    };

    for (const entry of this.usageLog) {
      const p = entry.provider;
      if (!stats.byProvider[p]) stats.byProvider[p] = { requests: 0, tokens: 0, costUsd: 0 };
      stats.byProvider[p]!.requests++;
      stats.byProvider[p]!.tokens += entry.inputTokens + entry.outputTokens;
      stats.byProvider[p]!.costUsd += entry.costUsd;

      const t = entry.tier;
      if (!stats.byTier[t]) stats.byTier[t] = { requests: 0, tokens: 0, costUsd: 0 };
      stats.byTier[t]!.requests++;
      stats.byTier[t]!.tokens += entry.inputTokens + entry.outputTokens;
      stats.byTier[t]!.costUsd += entry.costUsd;
    }

    return stats;
  }

  private checkRateLimit(tier: ModelTier): boolean {
    const limits: Record<ModelTier, { window: number; max: number }> = {
      fast: { window: 60000, max: 100 },
      balanced: { window: 60000, max: 30 },
      capable: { window: 60000, max: 10 },
      reasoning: { window: 60000, max: 5 },
    };

    const limit = limits[tier];
    if (!limit) return true;

    let store = this.rateLimiters.get(tier);
    if (!store) {
      store = new Map();
      this.rateLimiters.set(tier, store);
    }

    const now = Date.now();
    const entry = store.get('default');
    if (entry && now < entry.resetAt) {
      entry.count++;
      return entry.count <= limit.max;
    }

    store.set('default', { count: 1, resetAt: now + limit.window });
    return true;
  }

  private cacheKey(messages: Message[], model?: string): string {
    const hash = JSON.stringify({ messages, model });
    let key = 0;
    for (let i = 0; i < hash.length; i++) {
      key = ((key << 5) - key) + hash.charCodeAt(i);
      key |= 0;
    }
    return `${model ?? 'default'}:${key}`;
  }

  private simulateProviderCall(
    provider: AIProvider,
    _modelId: string,
    messages: Message[],
    _temperature?: number,
    _maxTokens?: number,
  ): { content: string; inputTokens: number; outputTokens: number; latencyMs: number } {
    const lastMessage = messages[messages.length - 1]?.content ?? '';
    const estimatedInputTokens = Math.ceil(messages.reduce((s, m) => s + m.content.length / 4, 0));

    const providerResponses: Record<string, string> = {
      anthropic: 'This is a simulated response from Anthropic (Claude).',
      openai: 'This is a simulated response from OpenAI (GPT).',
      google: 'This is a simulated response from Google (Gemini).',
      mistral: 'This is a simulated Mistral response.',
      openrouter: 'OpenRouter fallback response.',
      local: 'Local model fallback response.',
    };

    return {
      content: `${providerResponses[provider] ?? providerResponses.anthropic} (last message: "${lastMessage.slice(0, 50)}...")`,
      inputTokens: estimatedInputTokens,
      outputTokens: Math.floor(Math.random() * 100) + 20,
      latencyMs: Math.floor(Math.random() * 800) + 200,
    };
  }

  private async callRealProvider(
    adapter: AIProviderAdapter,
    modelId: string,
    messages: Message[],
    temperature?: number,
    maxTokens?: number,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number; latencyMs: number }> {
    const result = await adapter.complete({
      model: MODEL_TO_ADAPTER_MODEL[modelId] ?? modelId,
      messages,
      temperature,
      maxTokens,
    });
    return {
      content: result.content,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: result.latencyMs,
    };
  }

  private calculateCost(
    pricing: { inputPerMillionTokens: number; outputPerMillionTokens: number },
    inputTokens: number,
    outputTokens: number,
  ): number {
    return (
      (inputTokens / 1_000_000) * pricing.inputPerMillionTokens +
      (outputTokens / 1_000_000) * pricing.outputPerMillionTokens
    );
  }

  private logUsage(entry: AILogEntry): void {
    this.usageLog.push(entry);
    if (this.usageLog.length > 10000) {
      this.usageLog.shift();
    }
  }

  async chat(req: GatewayRequest): Promise<GatewayResult> {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const modelId = req.model || 'claude-sonnet-4';
    const route = this.getModelRoute(modelId);

    if (!route) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (!this.checkRateLimit(route.tier)) {
      throw new Error(`Rate limit exceeded for tier: ${route.tier}`);
    }

    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let providerUsed: AIProvider = route.provider;
    const fallbackChain: AIProvider[] = [route.provider];
    let cached = false;

    if (!req.stream && !req.skipCache) {
      const ckey = this.cacheKey(req.messages, modelId);
      const cachedContent = this.cache.get(ckey);
      if (cachedContent) {
        content = cachedContent;
        cached = true;
        inputTokens = Math.ceil(req.messages.reduce((s, m) => s + m.content.length / 4, 0));
        outputTokens = Math.ceil(content.length / 4);
      }
    }

    if (!cached) {
      let success = false;
      const providersToTry = [route.provider, ...route.fallbacks];

      for (const provider of providersToTry) {
        const status = this.providerStatus.get(provider);
        if (!status?.healthy && !this.simulateMode) continue;

        try {
          if (!this.simulateMode && this.registry.has(provider)) {
            const adapter = this.registry.get(provider);
            const result = await this.callRealProvider(adapter, modelId, req.messages, req.temperature, req.maxTokens);
            content = result.content;
            inputTokens = result.inputTokens;
            outputTokens = result.outputTokens;
          } else {
            const result = this.simulateProviderCall(provider, modelId, req.messages, req.temperature, req.maxTokens);
            content = result.content;
            inputTokens = result.inputTokens;
            outputTokens = result.outputTokens;
          }
          providerUsed = provider;
          if (provider !== route.provider) fallbackChain.push(provider);
          success = true;
          break;
        } catch {
          if (provider !== route.provider) fallbackChain.push(provider);
        }
      }

      if (!success) {
        throw new Error(`All providers failed for model: ${modelId}`);
      }

      if (!req.stream && !req.skipCache) {
        this.cache.set(this.cacheKey(req.messages, modelId), content);
      }
    }

    const cost = this.calculateCost(route.pricing, inputTokens, outputTokens);
    const latencyMs = Date.now() - startedAt;

    const logEntry: AILogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      organizationId: '',
      projectId: '',
      userId: '',
      feature: 'chat',
      provider: providerUsed,
      model: modelId,
      tier: route.tier,
      inputTokens,
      outputTokens,
      costUsd: cost,
      latencyMs,
      cacheHit: cached,
      fallbackChain,
    };
    this.logUsage(logEntry);

    return {
      meta: {
        requestId,
        model: modelId,
        provider: providerUsed,
        tier: route.tier,
        startedAt: new Date(startedAt).toISOString(),
        cached,
        fallbackChain,
      },
      content,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd: cost,
      },
      latencyMs,
    };
  }

  async *streamChat(req: GatewayRequest): AsyncGenerator<{ event: string; data: unknown }> {
    const modelId = req.model || 'claude-sonnet-4';
    const route = this.getModelRoute(modelId);

    if (!route) throw new Error(`Unknown model: ${modelId}`);
    if (!this.checkRateLimit(route.tier)) throw new Error(`Rate limit exceeded for tier: ${route.tier}`);

    const providersToTry = [route.provider, ...route.fallbacks];
    let succeeded = false;

    for (const provider of providersToTry) {
      const status = this.providerStatus.get(provider);
      if (!status?.healthy && !this.simulateMode) continue;

      try {
        if (!this.simulateMode && this.registry.has(provider)) {
          const adapter = this.registry.get(provider);
          const stream = adapter.stream({
            model: MODEL_TO_ADAPTER_MODEL[modelId] ?? modelId,
            messages: req.messages,
            temperature: req.temperature,
            maxTokens: req.maxTokens,
          });

          for await (const event of stream) {
            if (event.type === 'chunk') {
              yield { event: 'token', data: { content: event.content } };
            } else if (event.type === 'done') {
              yield {
                event: 'finish',
                data: {
                  stopReason: 'stop',
                  usage: {
                    inputTokens: event.usage.inputTokens,
                    outputTokens: event.usage.outputTokens,
                    totalTokens: event.usage.inputTokens + event.usage.outputTokens,
                    costUsd: this.calculateCost(route.pricing, event.usage.inputTokens, event.usage.outputTokens),
                  },
                  requestId: crypto.randomUUID(),
                  latencyMs: 0,
                },
              };
            } else if (event.type === 'error') {
              yield { event: 'error', data: { code: 'PROVIDER_ERROR', message: event.message, recoverable: false } };
            }
          }
        } else {
          const result = this.simulateProviderCall(provider, modelId, req.messages, req.temperature, req.maxTokens);
          yield { event: 'meta', data: { requestId: crypto.randomUUID(), model: modelId, provider } };
          const words = result.content.split(' ');
          for (let i = 0; i < words.length; i++) {
            yield { event: 'token', data: { content: (i === 0 ? '' : ' ') + words[i] } };
          }
          yield {
            event: 'finish',
            data: {
              stopReason: 'stop', usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, totalTokens: result.inputTokens + result.outputTokens, costUsd: this.calculateCost(route.pricing, result.inputTokens, result.outputTokens) },
              requestId: crypto.randomUUID(),
              latencyMs: result.latencyMs,
            },
          };
        }

        succeeded = true;
        break;
      } catch (err) {
        yield { event: 'error', data: { code: 'FALLBACK', message: `Provider ${provider} failed: ${err instanceof Error ? err.message : 'unknown'}`, recoverable: true } };
      }
    }

    if (!succeeded) {
      yield { event: 'error', data: { code: 'ALL_PROVIDERS_FAILED', message: 'All providers failed', recoverable: false } };
    }
  }
}

export const aiGateway = new AiGateway();
