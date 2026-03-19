import { beforeAll, beforeEach, afterEach, describe, it, vi, expect } from 'vitest';
import { JSONParse, JSONStringify } from 'json-with-bigint';
import { base64 } from '@scure/base';
import { NoxyNetworkModule } from '@/modules/noxy-network';
import { NoxyNetworkError } from '@/modules/noxy-error';
import { MockWebSocket } from '@test/__mocks__/websocket';
import initMocks from '@test/__mocks__';
import 'fake-indexeddb/auto';

const TEST_RELAY_URL = 'wss://relay.noxy.network';

describe('NoxyNetworkModule', () => {
  let networkModule: NoxyNetworkModule;
  let mocks: Record<string, any>;
  let mockWebSocket: MockWebSocket | null = null;

  beforeAll(async () => {
    mocks = await initMocks();
  });

  beforeEach(async () => {
    mockWebSocket = null;

    (globalThis as any).WebSocket = class TestWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      constructor(url: string) {
        mockWebSocket = new MockWebSocket(url);
        return mockWebSocket;
      }
    };

    networkModule = new NoxyNetworkModule({
      identity: mocks.testIdentity,
      network: {
        relayNodesUrl: TEST_RELAY_URL,
        appId: 'test-app-id',
      },
      storage: {
        indexedDb: {
          dbName: mocks.testStorageName,
          dbVersion: mocks.testStorageVersion,
        },
      },
    });
  });

  afterEach(async () => {
    try {
      if (networkModule?.isConnected) {
        await networkModule.disconnect();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('connect', () => {
    it('should connect to the relay at relayNodesUrl (wss)', async () => {
      await networkModule.connect();
      expect(networkModule.isConnected).toBe(true);
      expect(mockWebSocket).toBeDefined();
      expect(mockWebSocket?.url).toBe('wss://relay.noxy.network/');
    });

    it('should throw NoxyNetworkError when relay connection fails', async () => {
      (globalThis as any).WebSocket = class TestWebSocketFail {
        static readonly OPEN = 1;
        constructor(url: string) {
          mockWebSocket = new MockWebSocket(url, { failConnect: true });
          return mockWebSocket;
        }
      };

      await expect(networkModule.connect()).rejects.toThrow(NoxyNetworkError);
      await expect(networkModule.connect()).rejects.toThrow('Failed to connect to relay');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from the network', async () => {
      await networkModule.connect();
      expect(networkModule.isConnected).toBe(true);

      await networkModule.disconnect();
      expect(networkModule.isConnected).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await expect(networkModule.disconnect()).resolves.not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(networkModule.isConnected).toBe(false);
    });

    it('should return true when connected', async () => {
      await networkModule.connect();
      expect(networkModule.isConnected).toBe(true);
    });
  });

  describe('authenticateDevice', () => {
    it('should send auth and set session when response has no requiresRegistration', async () => {
      await networkModule.connect();

      const authResponse = {
        requestId: 'test-request-id',
        timestamp: Date.now(),
        status: 'ok',
        authenticate: {
          requiresRegistration: false,
          deviceId: 'device-123',
          sessionId: 'session-456',
        },
      };
      mockWebSocket?.simulateReceive(new TextEncoder().encode(JSONStringify(authResponse)));

      await networkModule.authenticateDevice(mocks.testDevice);

      expect(networkModule.sessionId).toBe('session-456');
      expect(networkModule.networkDeviceId).toBe('device-123');
      const writtenData = mockWebSocket?.getWrittenData();
      expect(writtenData).toHaveLength(1);
      const parsed = JSONParse(new TextDecoder().decode(writtenData![0]));
      expect(parsed.payload.devicePubkeys).toBeDefined();
    });

    it('should throw NoxyNetworkError when not connected', async () => {
      await expect(networkModule.authenticateDevice(mocks.testDevice)).rejects.toThrow(NoxyNetworkError);
      await expect(networkModule.authenticateDevice(mocks.testDevice)).rejects.toThrow('not connected');
    });
  });

  describe('subscribeToNotifications', () => {
    it('should throw NoxyNetworkError when not connected', async () => {
      const handler = vi.fn();
      await expect(networkModule.subscribeToNotifications(handler)).rejects.toThrow(NoxyNetworkError);
      await expect(networkModule.subscribeToNotifications(handler)).rejects.toThrow('not connected');
    });

    it('should throw when connected but not authenticated', async () => {
      await networkModule.connect();
      const handler = vi.fn();
      await expect(networkModule.subscribeToNotifications(handler)).rejects.toThrow(NoxyNetworkError);
      await expect(networkModule.subscribeToNotifications(handler)).rejects.toThrow('not authenticated');
    });
  });

  describe('announceDevice', () => {
    it('should send announce payload and read response when connected', async () => {
      await networkModule.connect();

      const announceResponse = {
        requestId: 'test-request-id',
        timestamp: Date.now(),
        status: 'ok',
        registerDevice: {
          deviceId: 'announced-device-id',
          registeredAt: Date.now(),
          sessionId: 'announce-session-id',
        },
      };
      mockWebSocket?.simulateReceive(new TextEncoder().encode(JSONStringify(announceResponse)));

      const payload = {
        devicePubkeys: {
          publicKey: base64.encode(mocks.testDevice.publicKey),
          pqPublicKey: base64.encode(mocks.testDevice.pqPublicKey),
        },
        walletAddress: mocks.testDevice.identityId,
        signature: base64.encode(mocks.testDevice.identitySignature ?? new Uint8Array(64)),
      };

      await networkModule.announceDevice(payload);

      const writtenData = mockWebSocket?.getWrittenData();
      expect(writtenData).toHaveLength(1);
      const parsed = JSONParse(new TextDecoder().decode(writtenData![0]));
      expect(parsed.payload.type).toBe('browser');
      expect(parsed.payload.devicePubkeys).toBeDefined();
      expect(parsed.payload.walletAddress).toBe(mocks.testDevice.identityId);
      expect(networkModule.sessionId).toBe('announce-session-id');
      expect(networkModule.networkDeviceId).toBe('announced-device-id');
    });

    it('should throw NoxyNetworkError when not connected', async () => {
      const payload = {
        devicePubkeys: {
          publicKey: base64.encode(mocks.testDevice.publicKey),
          pqPublicKey: base64.encode(mocks.testDevice.pqPublicKey),
        },
        walletAddress: mocks.testDevice.identityId,
        signature: base64.encode(new Uint8Array(64)),
      };
      await expect(networkModule.announceDevice(payload)).rejects.toThrow(NoxyNetworkError);
      await expect(networkModule.announceDevice(payload)).rejects.toThrow('not connected');
    });
  });

  describe('reconnection', () => {
    it('should be disconnected after disconnect and send throws when not connected', async () => {
      const moduleWithRetries = new NoxyNetworkModule({
        identity: mocks.testIdentity,
        network: {
          relayNodesUrl: TEST_RELAY_URL,
          appId: 'test-app-id',
          maxRetries: 2,
          retryTimeoutMs: 10,
        },
        storage: {
          indexedDb: {
            dbName: mocks.testStorageName,
            dbVersion: mocks.testStorageVersion,
          },
        },
      });

      await moduleWithRetries.connect();
      expect(moduleWithRetries.isConnected).toBe(true);

      await moduleWithRetries.disconnect();
      expect(moduleWithRetries.isConnected).toBe(false);

      await expect(moduleWithRetries.authenticateDevice(mocks.testDevice)).rejects.toThrow(NoxyNetworkError);
      await expect(moduleWithRetries.authenticateDevice(mocks.testDevice)).rejects.toThrow('not connected');
    });
  });
});
