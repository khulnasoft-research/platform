import type { StreamEvent } from '../types.js';

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

export class StreamParser {
  private buffer = '';
  private inputTokens = 0;
  private outputTokens = 0;

  push(data: string): StreamChunk[] {
    this.buffer += data;
    const chunks: StreamChunk[] = [];
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const chunk = this.parseLine(line);
      if (chunk) chunks.push(chunk);
    }

    return chunks;
  }

  private parseLine(line: string): StreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    try {
      const event: StreamEvent = JSON.parse(trimmed);
      switch (event.type) {
        case 'chunk':
          this.outputTokens += Math.ceil(event.content.length / 4);
          return { content: event.content, done: false };
        case 'done':
          return {
            content: '',
            done: true,
            usage: {
              inputTokens: this.inputTokens,
              outputTokens: this.outputTokens,
            },
          };
        case 'error':
          return { content: '', done: true, error: event.message };
        default:
          return null;
      }
    } catch {
      return { content: trimmed, done: false };
    }
  }

  reset(): void {
    this.buffer = '';
    this.inputTokens = 0;
    this.outputTokens = 0;
  }
}

export function createSSEString(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
