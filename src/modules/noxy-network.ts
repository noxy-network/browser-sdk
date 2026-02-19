import { v4 as uuidv4 } from 'uuid';
import { JSONParse, JSONStringify } from 'json-with-bigint';
import type { NoxyNetworkAckPayload, NoxyNetworkAnnounceDevicePayload, NoxyNetworkAnnounceDeviceResponse, NoxyNetworkAuthenticatePayload, NoxyNetworkAuthenticateResponse, NoxyNetworkErrorResponse, NoxyNetworkOptions, NoxyNetworkRevokeDevicePayload, NoxyNetworkRotateDeviceKeysPayload } from '@/modules/noxy-network.types';
import { isNoxyNetworkErrorResponse } from '@/modules/noxy-network.types';
import type { NoxyNetworkMessage } from '@/modules/noxy-network.types';
import type { NoxyDeviceId, NoxyDevice } from '@/modules/noxy-device.types';
import type { NoxyEncryptedNotification } from '@/modules/noxy-notification.types';
import { NoxyClientOptions } from '@/modules/noxy-client.types';
import { NOXY_NETWORK_MAX_RETRIES_DEFAULT, NOXT_NETWORK_RETRY_TIMEOUT_DEFAULT } from '@/modules/noxy-common.constants';
import { NoxyNetworkError } from '@/modules/noxy-error';
import { NoxyNetworkErrorOperationEnum } from '@/modules/noxy-error.types';
import type { NoAny } from '@/modules/noxy-common.types';
import { randomBytes } from '@noble/hashes/utils.js';
import { base64 } from '@scure/base';

export class NoxyNetworkModule {
  readonly #options: NoxyNetworkOptions;

  #ws: WebSocket | null = null;
  #stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array>; closed: Promise<void> } | null = null;
  #sessionId: string | undefined = undefined;
  #networkDeviceId: NoxyDeviceId | undefined = undefined;

  private static instance: NoxyNetworkModule | undefined = undefined;

  constructor(options: NoAny<NoxyClientOptions> | NoAny<NoxyNetworkOptions>) {
    this.#options = (options as NoxyClientOptions).network ?? (options as NoxyNetworkOptions);
  }

  static create(options: NoAny<NoxyNetworkOptions>): NoxyNetworkModule {
    if (NoxyNetworkModule.instance !== undefined) return NoxyNetworkModule.instance;
    NoxyNetworkModule.instance = new NoxyNetworkModule(options);
    return NoxyNetworkModule.instance;
  }

  /**
   * Is network connected
   */
  get isConnected(): boolean {
    return this.#ws?.readyState === WebSocket.OPEN && this.#stream !== null;
  }

  /** Session id from last successful authenticate response (optional session_id). */
  get sessionId(): string | undefined {
    return this.#sessionId;
  }

  /** Is network ready: connected, authenticated and device announced. */
  get isReady(): boolean {
    return this.isConnected && this.#sessionId !== undefined && this.#networkDeviceId !== undefined;
  }

  /** Device id from last successful authenticate response (device_id). */
  get networkDeviceId(): NoxyDeviceId | undefined {
    return this.#networkDeviceId;
  }

  /**
   * Resolve relay URL to WebSocket URL (https -> wss).
   */
  private static relayUrlToWebSocketUrl(relayUrl: string): string {
    const url = new URL(relayUrl);
    url.protocol = 'wss:';
    return url.toString();
  }

  private createBidiStreamFromWebSocket(ws: WebSocket): {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    closed: Promise<void>;
  } {
    let closedResolve: () => void;
    const closed = new Promise<void>(resolve => {
      closedResolve = resolve;
    });

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        ws.binaryType = 'arraybuffer';
        ws.addEventListener('message', (event: MessageEvent<ArrayBuffer | string>) => {
          const data = typeof event.data === 'string'
            ? new TextEncoder().encode(event.data)
            : new Uint8Array(event.data);
          controller.enqueue(data);
        });
        ws.addEventListener('close', () => {
          controller.close();
          closedResolve();
        });
        ws.addEventListener('error', () => {
          controller.error(new Error('WebSocket error'));
          closedResolve();
        });
      },
    });

    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        if (ws.readyState !== WebSocket.OPEN) {
          throw new Error('WebSocket is not open');
        }
        ws.send(chunk);
      },
      close() {
        ws.close();
      },
      abort() {
        ws.close();
      },
    });

    return { readable, writable, closed };
  }

  /**
   * Connect to a relay node (HTTP/2-style bidirectional streaming over TCP via WebSocket).
   */
  private async connectToNode(url: string): Promise<void> {
    const wsUrl = NoxyNetworkModule.relayUrlToWebSocketUrl(url);
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
      ws.addEventListener('close', (ev) => {
        if (ev.code !== 1000 && ev.code !== 1005) {
          reject(new Error(`WebSocket closed: ${ev.code} ${ev.reason || ''}`));
        }
      });
    });

    this.#ws = ws;
    this.#stream = this.createBidiStreamFromWebSocket(ws);

    this.#stream.closed.catch(() => {
      this.reconnect();
    });
  }

  /**
   * Reconnect with retries
   */
  private async reconnect(): Promise<void> {
    await this.disconnect();

    let attempt = 1;
    while (attempt <= (this.#options.maxRetries ?? NOXY_NETWORK_MAX_RETRIES_DEFAULT)) {
      try {
        await this.connect();
        return;
      } catch (error) {
        attempt++;
        // eslint-disable-next-line
        await new Promise(resolve => setTimeout(resolve, this.#options.retryTimeoutMs ?? NOXT_NETWORK_RETRY_TIMEOUT_DEFAULT));
      }
    }

    throw new NoxyNetworkError({
      code: 'RECONNECT_FAILED',
      message: `Failed to reconnect to relay after ${attempt} attempts`,
      operation: NoxyNetworkErrorOperationEnum.RECONNECT,
      attempts: attempt,
    });
  }

  /**
   * Establish a network connection to the relay load balancer
   */
  async connect(): Promise<void> {
    try {
      await this.connectToNode(this.#options.relayNodesUrl);
    } catch (error) {
      await this.disconnect();
      throw new NoxyNetworkError({
        code: 'CONNECTION_FAILED',
        message: `Failed to connect to relay: ${error instanceof Error ? error.message : String(error)}`,
        operation: NoxyNetworkErrorOperationEnum.CONNECT,
      });
    }
  }

  /**
   * Disconnect from the network and clean up
   */
  async disconnect(): Promise<void> {
    this.#sessionId = undefined;
    this.#networkDeviceId = undefined;

    const stream = this.#stream;
    const ws = this.#ws;
    this.#stream = null;
    this.#ws = null;

    try {
      await stream?.readable.cancel();
    } catch {
      // Ignore cancel errors during cleanup
    }
    try {
      await stream?.writable.abort();
    } catch {
      // Ignore abort errors during cleanup
    }
    try {
      ws?.close();
    } catch (error) {
      // Ignore close errors during cleanup
    }
  }

  /**
   * Send a message to the noxy network
   */
  async sendNetworkMessage(message: NoxyNetworkMessage): Promise<void> {
    if (!this.isConnected) {
      throw new NoxyNetworkError({
        code: 'NOT_CONNECTED',
        message: 'Cannot send network message: not connected to any relay node',
        operation: NoxyNetworkErrorOperationEnum.SEND_MESSAGE,
      });
    }

    try {
      const writer = this.#stream?.writable.getWriter();
      try {
        await writer?.write(
          new TextEncoder().encode(JSONStringify(message))
        );
      } finally {
        writer?.releaseLock();
      }
    } catch (error) {
      // Connection likely lost, trigger reconnection
      await this.reconnect();
      throw new NoxyNetworkError({ message: (error as Error).message });
    }
  }

  /**
   * Acknowledge a notification on the network
   */
  private async acknowledgeNotification(payload: NoxyNetworkAckPayload): Promise<void> {
    const nonceB64 = base64.encode(randomBytes(12));
    await this.sendNetworkMessage({
      requestId: uuidv4(),
      sessionId: this.#sessionId,
      appId: this.#options.appId,
      deviceId: this.#networkDeviceId,
      timestamp: Date.now(),
      nonce: nonceB64,
      payload,
    });
  }

  /**
   * Authenticate device on the network
   */
  async authenticateDevice(device: NoxyDevice): Promise<void> {

    const payload: NoxyNetworkAuthenticatePayload = {
      devicePubkeys: {
        publicKey: base64.encode(device.publicKey),
        pqPublicKey: base64.encode(device.pqPublicKey),
      },
    };

    const nonceB64 = base64.encode(randomBytes(12));

    await this.sendNetworkMessage({
      requestId: uuidv4(),
      appId: this.#options.appId,
      timestamp: Date.now(),
      nonce: nonceB64,
      payload,
    });

    const reader = this.#stream!.readable.getReader();
    let response: NoxyNetworkAuthenticateResponse | NoxyNetworkErrorResponse;
    try {
      const { value } = await reader.read();
      if (!value) {
        throw new NoxyNetworkError({
          code: 'AUTHENTICATE_FAILED',
          message: 'No response from relay',
          operation: NoxyNetworkErrorOperationEnum.AUTHENTICATE,
        });
      }
      response = JSONParse(new TextDecoder().decode(value)) as NoxyNetworkAuthenticateResponse;
    } finally {
      reader.releaseLock();
    }

    if (isNoxyNetworkErrorResponse(response)) {
      throw new NoxyNetworkError({
        code: response.error.code,
        message: response.error.message,
        operation: NoxyNetworkErrorOperationEnum.AUTHENTICATE,
      });
    }

    if (response!.authenticate?.requiresRegistration === true) {
      await this.announceDevice({
        devicePubkeys: payload.devicePubkeys,
        walletAddress: device.identityId,
        signature: base64.encode(device.identitySignature as Uint8Array),
      } as NoxyNetworkAnnounceDevicePayload);
    } else {
      this.#sessionId = response!.authenticate?.sessionId;
      this.#networkDeviceId = response!.authenticate?.deviceId;
    }
  }

  /**
   * Announce device on the network
   */
  async announceDevice(payload: NoxyNetworkAnnounceDevicePayload): Promise<void> {
    const nonceB64 = base64.encode(randomBytes(12));
    await this.sendNetworkMessage({
      requestId: uuidv4(),
      sessionId: this.#sessionId,
      appId: this.#options.appId,
      timestamp: Date.now(),
      nonce: nonceB64,
      payload,
    });

    const reader = this.#stream!.readable.getReader();
    try {
      const { value } = await reader.read();
      if (!value) {
        throw new NoxyNetworkError({
          code: 'ANNOUNCE_DEVICE_FAILED',
          message: 'No response from relay',
          operation: NoxyNetworkErrorOperationEnum.ANNOUNCE_DEVICE,
        });
      }
      const response = JSONParse(new TextDecoder().decode(value)) as NoxyNetworkAnnounceDeviceResponse;

      if (isNoxyNetworkErrorResponse(response)) {
        throw new NoxyNetworkError({
          code: response.error.code,
          message: response.error.message,
          operation: NoxyNetworkErrorOperationEnum.ANNOUNCE_DEVICE,
        });
      }

      this.#sessionId = response.registerDevice?.sessionId;
      this.#networkDeviceId = response.registerDevice?.deviceId;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Revoke a device on the network
   */
  async revokeDevice(payload: NoxyNetworkRevokeDevicePayload): Promise<void> {
    const nonceB64 = base64.encode(randomBytes(12));
    await this.sendNetworkMessage({
      requestId: uuidv4(),
      sessionId: this.#sessionId,
      appId: this.#options.appId,
      deviceId: this.#networkDeviceId,
      timestamp: Date.now(),
      nonce: nonceB64,
      payload,
    });
  }

  /**
   * Rotate the device keys on the network
   */
  async rotateDeviceKeys(payload: NoxyNetworkRotateDeviceKeysPayload): Promise<void> {
    const nonceB64 = base64.encode(randomBytes(12));
    await this.sendNetworkMessage({
      requestId: uuidv4(),
      sessionId: this.#sessionId,
      appId: this.#options.appId,
      deviceId: this.#networkDeviceId,
      timestamp: Date.now(),
      nonce: nonceB64,
      payload,
    });
  }

  /**
   * Subscribe and continuously listen for encrypted notifications from the network.
   * Uses async iteration which is event-driven and non-blocking.
   */
  async subscribeToNotifications(handler: (notification: NoxyEncryptedNotification) => Promise<void>): Promise<void> {
    if (!this.isConnected || !this.#stream?.readable) {
      throw new NoxyNetworkError({
        code: 'NOT_CONNECTED',
        message: 'Cannot subscribe to notifications: not connected to any relay node',
        operation: NoxyNetworkErrorOperationEnum.PUSH_RECEIVED,
      });
    }

    if (!this.#sessionId || !this.#networkDeviceId) {
      throw new NoxyNetworkError({
        code: 'NOT_AUTHENTICATED',
        message: 'Cannot subscribe to notifications: not authenticated',
        operation: NoxyNetworkErrorOperationEnum.PUSH_RECEIVED,
      });
    }

    try {
      const nonceB64 = base64.encode(randomBytes(12));
      await this.sendNetworkMessage({
        requestId: uuidv4(),
        sessionId: this.#sessionId,
        appId: this.#options.appId,
        deviceId: this.#networkDeviceId,
        timestamp: Date.now(),
        nonce: nonceB64,
        payload: { subscribe: true },
      });

      // Async iteration is event-driven and doesn't busy-wait
      for await (const chunk of this.#stream.readable) {
        try {
          const envelope = JSONParse(new TextDecoder().decode(chunk));
          if (envelope?.pushEvent?.ciphertext) {
            if (this.#options.requireAck) {
              // do not await
              this.acknowledgeNotification({
                messageId: envelope.messageId,
                receivedAt: Date.now(),
              });
            }
            await handler(envelope.pushEvent);
          }
        } catch (parseError) {
          return;
        }
      }

      // Stream ended naturally
      await this.reconnect();
    } catch (error) {
      // Connection likely lost, trigger reconnection
      await this.reconnect();
      throw new NoxyNetworkError({ message: (error as Error).message });
    }
  }
}
