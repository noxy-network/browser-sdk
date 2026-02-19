import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NoxyNotificationModule } from '@/modules/noxy-notification';
import initMocks from '@test/__mocks__';
import 'fake-indexeddb/auto';

describe('NoxyNotificationModule', () => {
  let notificationModule: NoxyNotificationModule;
  let mocks: Record<string, any>;

  beforeAll(async () => {
    mocks = await initMocks();
  });

  beforeEach(async () => {
    notificationModule = await NoxyNotificationModule.create({
      indexedDb: {
        dbName: mocks.testStorageName,
        dbVersion: mocks.testStorageVersion,
      },
    });
  });

  describe('decryptNotification', () => {
    it('should encrypt and decrypt a notification', async () => {
      const deviceModule = (notificationModule as any).NoxyDeviceModule;
      await deviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);

      const plainNotification = {
        type: 'default',
        title: 'Test Title',
        message: 'Test Body',
        timestamp: Date.now(),
        metadata: {
          key: 'value',
        },
      };
      const plaintext = new TextEncoder().encode(JSON.stringify(plainNotification));

      const encrypted = await notificationModule.encryptNotification(plaintext);
      const decrypted = await notificationModule.decryptNotification(encrypted);
      expect(decrypted).toEqual(plainNotification);
    });
  });
});