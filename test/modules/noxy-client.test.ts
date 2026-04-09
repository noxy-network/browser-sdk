import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { JSONStringify } from 'json-with-bigint';
import { NoxyClientModule } from '@/modules/noxy-client';
import { NoxyDecisionRequestModule } from '@/modules/noxy-decision-request';
import type { NoxyEncryptedDecisionRequest } from '@/modules/noxy-decision-request.types';
import { NoxyDecisionOutcomeValues } from '@/modules/noxy-decision-request.types';
import { encryptDecisionRequestForTest } from '@test/helpers/encrypt-decision-request-for-test';
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

  it('client and decision request module share same device module instance and device is loaded', async () => {
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
    const decisionRequestModule = (client as any).NoxyDecisionRequestModule as NoxyDecisionRequestModule;
    const decisionRequestDeviceModule = (decisionRequestModule as any).NoxyDeviceModule;

    expect(clientDeviceModule).toBeDefined();
    expect(decisionRequestDeviceModule).toBeDefined();
    expect(clientDeviceModule).toBe(decisionRequestDeviceModule);

    expect(clientDeviceModule.publicKey).toBeDefined();
    expect(clientDeviceModule.pqPublicKey).toBeDefined();

    await client.close();
  });

  it('on(handler) should decrypt decision request and invoke handler; submitDecisionOutcome sends to relay', async () => {
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

    const plainDecision = {
      decision_id: 'decision-test-1',
      title: 'Approve action?',
      timestamp: Date.now(),
    };

    const clientDecisionRequestModule = (client as any).NoxyDecisionRequestModule as NoxyDecisionRequestModule;
    const clientDeviceModule = (clientDecisionRequestModule as any).NoxyDeviceModule;
    const kyber = (clientDecisionRequestModule as any).NoxyKyberProvider;
    await clientDeviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);

    const plaintext = new TextEncoder().encode(JSONStringify(plainDecision));
    const encrypted = await encryptDecisionRequestForTest(clientDeviceModule, kyber, plaintext);

    const networkModule = (client as any).NoxyNetworkModule;
    vi.spyOn(networkModule, 'subscribeToDecisionRequests').mockImplementation(async (fn: unknown) => {
      await (fn as (ctx: { messageId?: string; decisionEvent: NoxyEncryptedDecisionRequest }) => Promise<void>)({
        messageId: 'relay-msg-1',
        decisionEvent: encrypted,
      });
    });

    const sendDecisionOutcome = vi.spyOn(networkModule, 'sendDecisionOutcome').mockResolvedValue(undefined);

    const handler = vi.fn().mockResolvedValue(undefined);

    await client.on(handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBe('relay-msg-1');
    expect(handler.mock.calls[0][1]).toEqual(plainDecision);
    expect(sendDecisionOutcome).not.toHaveBeenCalled();

    await client.submitDecisionOutcome({
      decisionId: 'decision-test-1',
      outcome: NoxyDecisionOutcomeValues.APPROVE,
      receivedAt: Date.now(),
    });

    expect(sendDecisionOutcome).toHaveBeenCalledWith({
      decisionId: 'decision-test-1',
      outcome: 'APPROVE',
      receivedAt: expect.any(Number),
    });

    await client.close();
  });
});
