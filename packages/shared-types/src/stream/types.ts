export type StreamType = 'sse' | 'websocket';
export type StreamChannel = 'stream' | 'agent' | 'preview' | 'studio' | 'deploy';

export interface SSEEvent {
  event: SSEEventType;
  data: string;
  id?: string;
  retry?: number;
}

export type SSEEventType =
  | 'meta'
  | 'token'
  | 'diff'
  | 'tool-call'
  | 'tool-result'
  | 'progress'
  | 'status'
  | 'error'
  | 'finish';

export interface TokenEvent {
  content: string;
  index: number;
  type?: 'text' | 'code';
}

export interface DiffEvent {
  path: string;
  type: 'edit' | 'create' | 'delete';
  patch: string;
}

export interface ToolCallEvent {
  tool: string;
  arguments: Record<string, unknown>;
  id: string;
}

export interface ToolResultEvent {
  toolCallId: string;
  content: string;
  isError: boolean;
}

export interface ProgressEvent {
  percentage: number;
  message: string;
  phase?: string;
  taskId?: string;
}

export interface ErrorEvent {
  code: string;
  message: string;
  recoverable: boolean;
  requestId?: string;
}

export interface FinishEvent {
  stopReason: 'stop' | 'length' | 'content-filter' | 'error';
  usage: { inputTokens: number; outputTokens: number };
  requestId: string;
  latencyMs: number;
}

// ── WebSocket messages ─────────────────────────────────

export interface WSClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'send' | 'cancel' | 'resume';
  channel: string;
  payload?: unknown;
  requestId?: string;
  fromEventId?: string;
}

export interface WSServerMessage {
  type: 'delta' | 'snapshot' | 'event' | 'error' | 'ack' | 'ping' | 'pong';
  channel: string;
  payload: unknown;
  eventId?: string;
  timestamp: string;
}
