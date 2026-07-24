import type { AIModel } from '@platform/shared-types';
import type { AIRequestOptions, StreamEvent } from '../types.js';
import { ProviderBase } from './base.js';

export class AnthropicAdapter extends ProviderBase {
  provider = 'anthropic' as const;

  protected defaultBaseUrl(): string {
    return 'https://api.anthropic.com/v1';
  }

  async models(): Promise<AIModel[]> {
    return [
      {
        id: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        name: 'Claude Sonnet 4',
        tier: 'balanced',
        features: ['chat', 'streaming', 'vision', 'tools', 'structured-output'],
        contextWindow: 200000,
        maxOutputTokens: 8192,
        pricing: { inputPerMillionTokens: 3, outputPerMillionTokens: 15 },
      },
      {
        id: 'claude-opus-4-20250514',
        provider: 'anthropic',
        name: 'Claude Opus 4',
        tier: 'reasoning',
        features: ['chat', 'streaming', 'vision', 'tools', 'reasoning'],
        contextWindow: 200000,
        maxOutputTokens: 4096,
        pricing: { inputPerMillionTokens: 15, outputPerMillionTokens: 75 },
      },
    ];
  }

  async complete(req: AIRequestOptions): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
    latencyMs: number;
  }> {
    const start = Date.now();
    const systemMessages = req.messages.filter((m) => m.role === 'system');
    const conversationMessages = req.messages.filter((m) => m.role !== 'system');

    const res = await fetch(this.buildEndpoint('/messages'), {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model ?? 'claude-sonnet-4-20250514',
        messages: conversationMessages,
        system: systemMessages.map((m) => m.content).join('\n'),
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature,
        stream: false,
      }),
    });
    const data = await res.json();
    return {
      content: data.content?.[0]?.text ?? '',
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      model: data.model ?? req.model ?? 'claude-sonnet-4-20250514',
      latencyMs: Date.now() - start,
    };
  }

  async *stream(req: AIRequestOptions): AsyncGenerator<StreamEvent> {
    const systemMessages = req.messages.filter((m) => m.role === 'system');
    const conversationMessages = req.messages.filter((m) => m.role !== 'system');

    const res = await fetch(this.buildEndpoint('/messages'), {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model ?? 'claude-sonnet-4-20250514',
        messages: conversationMessages,
        system: systemMessages.map((m) => m.content).join('\n'),
        max_tokens: req.maxTokens ?? 4096,
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const parsed = JSON.parse(trimmed.slice(6));
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            const text: string = parsed.delta.text;
            outputTokens += this.estimateTokens(text);
            yield { type: 'chunk', content: text };
          }
          if (parsed.type === 'message_start' && parsed.message?.usage) {
            inputTokens = parsed.message.usage.input_tokens ?? 0;
          }
          if (parsed.type === 'message_delta' && parsed.usage) {
            outputTokens = parsed.usage.output_tokens ?? outputTokens;
          }
        } catch {}
      }
    }
    yield { type: 'done', usage: { inputTokens, outputTokens } };
  }
}
