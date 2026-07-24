import type { AIModel } from '@platform/shared-types';
import type { AIRequestOptions, StreamEvent } from '../types.js';
import { ProviderBase } from './base.js';

export class OpenAIAdapter extends ProviderBase {
  provider = 'openai' as const;

  protected defaultBaseUrl(): string {
    return 'https://api.openai.com/v1';
  }

  async models(): Promise<AIModel[]> {
    const res = await fetch(this.buildEndpoint('/models'), {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    });
    const data = await res.json();
    return (data.data as Array<{ id: string }>).map((m: { id: string }) => ({
      id: m.id,
      provider: 'openai' as const,
      name: m.id,
      tier: 'balanced' as const,
      features: ['chat' as const, 'streaming' as const],
      contextWindow: 128000,
      maxOutputTokens: 4096,
      pricing: { inputPerMillionTokens: 2.5, outputPerMillionTokens: 10 },
    }));
  }

  async complete(req: AIRequestOptions): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
    latencyMs: number;
  }> {
    const start = Date.now();
    const res = await fetch(this.buildEndpoint('/chat/completions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model ?? 'gpt-4o',
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        top_p: req.topP,
        stop: req.stop,
        stream: false,
      }),
    });
    const data = await res.json();
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      model: data.model ?? req.model ?? 'gpt-4o',
      latencyMs: Date.now() - start,
    };
  }

  async *stream(req: AIRequestOptions): AsyncGenerator<StreamEvent> {
    const res = await fetch(this.buildEndpoint('/chat/completions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model ?? 'gpt-4o',
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        stream: true,
      }),
    });
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            outputTokens += this.estimateTokens(delta.content);
            yield { type: 'chunk', content: delta.content };
          }
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens ?? inputTokens;
          }
        } catch {}
      }
    }
    yield { type: 'done', usage: { inputTokens, outputTokens } };
  }
}
