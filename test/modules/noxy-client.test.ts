import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { JSONStringify } from 'json-with-bigint';
import { NoxyClientModule } from '@/modules/noxy-client';
import { NoxyNotificationModule } from '@/modules/noxy-notification';
import type { NoxyEncryptedNotification } from '@/modules/noxy-notification.types';
import { MockWebSocket } from '@test/__mocks__/websocket';
import initMocks from '@test/__mocks__';
import 'fake-indexeddb/auto';

const TEST_RELAY_URL = 'wss://relay.noxy.network';

const AUTH_RESPONSE = {
  requestId: 'test-request-id',
  timestamp: Date.now(),
  status: 'ok',
  authenticate: {
    requiresRegistration: false,
    deviceId: 'test-device-id',
    sessionId: 'test-session-id',
  },
};

describe('NoxyClientModule', () => {
  let mocks: Record<string, any>;
  let mockWebSocket: MockWebSocket | null = null;

  beforeAll(async () => {
    mocks = await initMocks();
  });

  beforeEach(() => {
    mockWebSocket = null;
    (globalThis as any).WebSocket = class TestWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      constructor(url: string) {
        const mock = new MockWebSocket(url);
        mockWebSocket = mock;
        // Deliver auth response when first message is sent (so read() in authenticateDevice gets it)
        let firstSend = true;
        const origSend = mock.send.bind(mock);
        mock.send = function (data: string | ArrayBuffer | Blob | Uint8Array) {
          origSend(data);
          if (firstSend) {
            firstSend = false;
            // eslint-disable-next-line
            queueMicrotask(() => {
              mock.simulateReceive(new TextEncoder().encode(JSONStringify(AUTH_RESPONSE)));
            });
          }
        };
        return mock as any;
      }
    };
  });

  afterEach(async () => {
    try {
      if (mockWebSocket) {
        mockWebSocket.close();
      }
    } catch {
      // ignore
    }
  });

  it('should initialize a client correctly (identity -> device -> connect network)', async () => {
    const client = await NoxyClientModule.init({
      identity: mocks.testIdentity,
      network: {
        relayNodesUrl: TEST_RELAY_URL,
        appId: mocks.testAppId,
      },
      storage: {
        indexedDb: {
          dbName: mocks.testStorageName,
          dbVersion: mocks.testStorageVersion,
        },
      },
    });

    expect(client).toBeDefined();
    expect(client.address).toBe(mocks.testIdentityId);
    expect(client.isDeviceActive).toBe(true);
    expect(client.isRelayConnected).toBe(true);
    expect(client.isNetworkReady).toBe(true);
    expect(mockWebSocket).toBeDefined();

    await client.close();
  });

  it('client and notification module share same device module instance and device is loaded', async () => {
    const client = await NoxyClientModule.init({
      identity: mocks.testIdentity,
      network: {
        relayNodesUrl: TEST_RELAY_URL,
        appId: mocks.testAppId,
      },
      storage: {
        indexedDb: {
          dbName: mocks.testStorageName,
          dbVersion: mocks.testStorageVersion,
        },
      },
    });

    const clientDeviceModule = (client as any).NoxyDeviceModule;
    const notificationModule = (client as any).NoxyNotificationModule;
    const notificationDeviceModule = (notificationModule as any).NoxyDeviceModule;

    expect(clientDeviceModule).toBeDefined();
    expect(notificationDeviceModule).toBeDefined();
    expect(clientDeviceModule).toBe(notificationDeviceModule);

    expect(clientDeviceModule.publicKey).toBeDefined();
    expect(clientDeviceModule.pqPublicKey).toBeDefined();

    await client.close();
  });

  it('on(handler) should subscribe and pass decrypted plain object when relay sends encrypted notification', async () => {
    const client = await NoxyClientModule.init({
      identity: mocks.testIdentity,
      network: {
        relayNodesUrl: TEST_RELAY_URL,
        appId: mocks.testAppId,
      },
      storage: {
        indexedDb: {
          dbName: mocks.testStorageName,
          dbVersion: mocks.testStorageVersion,
        },
      },
    });

    const plainNotification = {
      type: 'default',
      title: 'Hello from relay',
      message: 'Test body',
      timestamp: Date.now(),
    };

    const clientNotificationModule = (client as any).NoxyNotificationModule as NoxyNotificationModule;
    const clientDeviceModule = (clientNotificationModule as any).NoxyDeviceModule;
    await clientDeviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);

    const plaintext = new TextEncoder().encode(JSONStringify(plainNotification));
    const encrypted = await clientNotificationModule.encryptNotification(plaintext);

    const handler = vi.fn<(data: unknown) => void>();
    const networkModule = (client as any).NoxyNetworkModule;
    vi.spyOn(networkModule, 'subscribeToNotifications').mockImplementation(async (fn: unknown) => {
      await (fn as (n: NoxyEncryptedNotification) => Promise<void>)(encrypted);
    });

    await client.on(handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual(plainNotification);

    await client.close();
  });
});
