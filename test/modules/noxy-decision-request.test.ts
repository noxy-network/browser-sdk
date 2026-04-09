import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NoxyDecisionRequestModule } from '@/modules/noxy-decision-request';
import { encryptDecisionRequestForTest } from '@test/helpers/encrypt-decision-request-for-test';
import initMocks from '@test/__mocks__';
import 'fake-indexeddb/auto';

describe('NoxyDecisionRequestModule', () => {
  let decisionRequestModule: NoxyDecisionRequestModule;
  let mocks: Record<string, any>;

  beforeAll(async () => {
    mocks = await initMocks();
  });

  beforeEach(async () => {
    decisionRequestModule = await NoxyDecisionRequestModule.create({
      indexedDb: {
        dbName: mocks.testStorageName,
        dbVersion: mocks.testStorageVersion,
      },
    });
  });

  describe('decryptDecisionRequest', () => {
    it('should decrypt ciphertext produced with the same device keys', async () => {
      const deviceModule = (decisionRequestModule as any).NoxyDeviceModule;
      const kyber = (decisionRequestModule as any).NoxyKyberProvider;
      await deviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);

      const plain = {
        type: 'default',
        title: 'Test Title',
        message: 'Test Body',
        timestamp: Date.now(),
        metadata: {
          key: 'value',
        },
      };
      const plaintext = new TextEncoder().encode(JSON.stringify(plain));

      const encrypted = await encryptDecisionRequestForTest(deviceModule, kyber, plaintext);
      const decrypted = await decisionRequestModule.decryptDecisionRequest(encrypted);
      expect(decrypted).toEqual(plain);
    });
  });
});
