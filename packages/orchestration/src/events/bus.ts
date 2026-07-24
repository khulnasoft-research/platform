export interface TypedEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  source: string;
  correlationId?: string;
}

export type EventHandler<T = unknown> = (event: TypedEvent<T>) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private history: TypedEvent[] = [];
  private maxHistory = 100;

  on<T>(type: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);
    return () => this.handlers.get(type)?.delete(handler as EventHandler);
  }

  emit<T>(type: string, payload: T, source = 'system'): void {
    const event: TypedEvent<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      source,
    };
    this.history.push(event as TypedEvent);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.handlers.get(type)?.forEach((handler) => {
      try {
        const result = handler(event);
        if (result instanceof Promise) result.catch(console.error);
      } catch (err) {
        console.error(`EventBus error in handler for ${type}:`, err);
      }
    });
  }

  once<T>(type: string, handler: EventHandler<T>): void {
    const wrapped: EventHandler<T> = (event) => {
      handler(event);
      this.off(type, wrapped);
    };
    this.on(type, wrapped);
  }

  off<T>(type: string, handler: EventHandler<T>): void {
    this.handlers.get(type)?.delete(handler as EventHandler);
  }

  getHistory(type?: string): TypedEvent[] {
    return type ? this.history.filter((e) => e.type === type) : [...this.history];
  }

  clear(): void {
    this.handlers.clear();
    this.history = [];
  }
}
