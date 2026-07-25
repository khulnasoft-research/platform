import type { AIModel } from '@platform/shared-types';
import type { AIRequestOptions, StreamEvent } from '../types.js';
import { ProviderBase } from './base.js';

export class GoogleAdapter extends ProviderBase {
  provider = 'google' as const;

  protected defaultBaseUrl(): string {
    return 'https://generativelanguage.googleapis.com/v1beta';
  }

  async models(): Promise<AIModel[]> {
    return [
      {
        id: 'gemini-2.0-flash',
        provider: 'google',
        name: 'Gemini 2.0 Flash',
        tier: 'fast',
        features: ['chat', 'streaming', 'vision', 'tools'],
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        pricing: { inputPerMillionTokens: 0.1, outputPerMillionTokens: 0.4 },
      },
      {
        id: 'gemini-2.0-pro',
        provider: 'google',
        name: 'Gemini 2.0 Pro',
        tier: 'capable',
        features: ['chat', 'streaming', 'vision', 'tools', 'structured-output'],
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        pricing: { inputPerMillionTokens: 1.5, outputPerMillionTokens: 2.5 },
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
    const contents = req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));

    const url = `${this.buildEndpoint(`/models/${req.model ?? 'gemini-2.0-flash'}:generateContent`)}?key=${this.config.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens,
        },
      }),
    });

    const data = await res.json();
    const candidate = data.candidates?.[0];
    return {
      content: candidate?.content?.parts?.[0]?.text ?? '',
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      model: data.modelVersion ?? req.model ?? 'gemini-2.0-flash',
      latencyMs: Date.now() - start,
    };
  }

  async *stream(req: AIRequestOptions): AsyncGenerator<StreamEvent> {
    const contents = req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));

    const url = `${this.buildEndpoint(`/models/${req.model ?? 'gemini-2.0-flash'}:streamGenerateContent`)}?key=${this.config.apiKey}&alt=sse`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens,
        },
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
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            outputTokens += this.estimateTokens(text);
            yield { type: 'chunk', content: text };
          }
          if (parsed.usageMetadata) {
            inputTokens = parsed.usageMetadata.promptTokenCount ?? inputTokens;
            outputTokens = parsed.usageMetadata.candidatesTokenCount ?? outputTokens;
          }
        } catch {}
      }
    }

    yield { type: 'done', usage: { inputTokens, outputTokens } };
  }
}
