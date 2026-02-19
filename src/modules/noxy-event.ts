import type { NoxyEventHandler, NoxyEventType } from '@/modules/noxy-event.types';
import { NoxyGeneralError } from '@/modules/noxy-error';

export class NoxyEventModule {
  #listeners: Map<NoxyEventType, Set<NoxyEventHandler>> = new Map();

  on(event: NoxyEventType, handler: NoxyEventHandler): void {
    if (typeof handler !== 'function') {
      throw new TypeError('NoxyEventModule.on: handler must be a function');
    }
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event)!.add(handler);
  }

  once(event: NoxyEventType, handler: NoxyEventHandler): void {
    const onceHandler: NoxyEventHandler = async (...args: unknown[]) => {
      await handler(...args);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  off(event: NoxyEventType, handler: NoxyEventHandler): void {
    const handlers = this.#listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.#listeners.delete(event);
      }
    }
  }

  async emit(event: NoxyEventType, ...args: unknown[]): Promise<void> {
    const handlers = this.#listeners.get(event);
    if (!handlers?.size) return;
    for (const handler of handlers) {
      try {
        await Promise.resolve(handler(...args));
      } catch (error: unknown) {
        throw new NoxyGeneralError({ message: (error as Error).message });
      }
    }
  }
}
