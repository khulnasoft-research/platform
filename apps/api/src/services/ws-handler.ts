import type WebSocket from 'ws';
import type { WSClientMessage, WSServerMessage } from '@platform/shared-types';
import { aiGateway } from './ai-gateway.js';

type Subscriber = {
  ws: WebSocket;
  channels: Set<string>;
};

const subscribers = new Map<string, Subscriber>();

export function broadcast(channel: string, message: WSServerMessage): void {
  for (const sub of subscribers.values()) {
    if (sub.channels.has(channel)) {
      try {
        sub.ws.send(JSON.stringify(message));
      } catch {}
    }
  }
}

export function handleWebSocket(ws: WebSocket): void {
  const id = crypto.randomUUID();
  const sub: Subscriber = { ws, channels: new Set(['broadcast']) };
  subscribers.set(id, sub);

  ws.send(JSON.stringify({
    type: 'ack',
    channel: 'system',
    payload: { connectionId: id },
    timestamp: new Date().toISOString(),
  } satisfies WSServerMessage));

  const keepAlive = setInterval(() => {
    try {
      ws.send(JSON.stringify({
        type: 'ping',
        channel: 'system',
        payload: {},
        timestamp: new Date().toISOString(),
      } satisfies WSServerMessage));
    } catch {
      clearInterval(keepAlive);
    }
  }, 30000);

  ws.on('message', async (raw) => {
    try {
      const msg: WSClientMessage = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'subscribe':
          if (typeof msg.channel === 'string') {
            sub.channels.add(msg.channel);
            ws.send(JSON.stringify({
              type: 'ack',
              channel: msg.channel,
              payload: { subscribed: true, channel: msg.channel },
              timestamp: new Date().toISOString(),
            } satisfies WSServerMessage));
          }
          break;

        case 'unsubscribe':
          if (typeof msg.channel === 'string') {
            sub.channels.delete(msg.channel);
          }
          break;

        case 'send':
          if (msg.channel === 'ai' && msg.payload) {
            const p = msg.payload as { model?: string; messages?: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number };
            if (p.messages) {
              const stream = aiGateway.streamChat({
                model: p.model,
                messages: p.messages.map((m) => ({ role: m.role as 'user' | 'system' | 'assistant', content: m.content })),
                stream: true,
                skipCache: true,
                temperature: p.temperature,
                maxTokens: p.maxTokens,
              });

              for await (const { event, data } of stream) {
                ws.send(JSON.stringify({
                  type: 'event',
                  channel: 'ai',
                  payload: { event, data },
                  eventId: crypto.randomUUID(),
                  timestamp: new Date().toISOString(),
                } satisfies WSServerMessage));
              }
            }
          }
          break;

        case 'cancel':
          break;
      }
    } catch {}
  });

  ws.on('close', () => {
    clearInterval(keepAlive);
    subscribers.delete(id);
  });
}
