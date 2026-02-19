// Mock WebSocket for tests (replaces WebTransport mock)

export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  binaryType: 'blob' | 'arraybuffer' = 'arraybuffer';

  #listeners: { open: (() => void)[]; message: ((ev: MessageEvent) => void)[]; close: (() => void)[]; error: (() => void)[] } = {
    open: [],
    message: [],
    close: [],
    error: [],
  };
  #writtenData: (string | ArrayBuffer | Blob | Uint8Array)[] = [];

  constructor(url: string, options?: { failConnect?: boolean }) {
    this.url = url;
    if (options?.failConnect) {
      // eslint-disable-next-line
      queueMicrotask(() => this.simulateConnectionError());
    } else {
      // eslint-disable-next-line
      queueMicrotask(() => this.#open());
    }
  }

  #open() {
    if (this.readyState !== MockWebSocket.CONNECTING) return;
    this.readyState = MockWebSocket.OPEN;
    this.#listeners.open.forEach((fn) => fn());
  }

  addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: () => void | ((ev: MessageEvent) => void)) {
    this.#listeners[type].push(listener as any);
  }

  removeEventListener(_type: string, _listener: () => void) {
    // No-op for mock
  }

  send(data: string | ArrayBuffer | Blob | Uint8Array) {
    this.#writtenData.push(data);
  }

  close(_code?: number, _reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.#listeners.close.forEach((fn) => fn());
  }

  // Test helpers
  simulateReceive(data: Uint8Array) {
    const ev: MessageEvent<ArrayBuffer> = {
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      type: 'message',
    } as MessageEvent<ArrayBuffer>;
    this.#listeners.message.forEach((fn) => fn(ev));
  }

  simulateConnectionError() {
    this.#listeners.error.forEach((fn) => fn());
  }

  getWrittenData(): Uint8Array[] {
    return this.#writtenData.map((d) => {
      if (typeof d === 'string') return new TextEncoder().encode(d);
      if (d instanceof Uint8Array) return d;
      if (d instanceof ArrayBuffer) return new Uint8Array(d);
      if (d instanceof Blob) return new Uint8Array(0); // Blob not read in sync test
      return new Uint8Array(0);
    });
  }
}
