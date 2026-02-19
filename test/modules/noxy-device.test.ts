import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NoxyDeviceModule } from '@/modules/noxy-device';
import initMocks from '@test/__mocks__';
import 'fake-indexeddb/auto';

describe('NoxyDeviceModule', () => {
  let deviceModule: NoxyDeviceModule;
  let mocks: Record<string, any>;

  beforeAll(async () => {
    mocks = await initMocks();
  });

  beforeEach(async () => {
    deviceModule = await NoxyDeviceModule.create({
      indexedDb: {
        dbName: mocks.testStorageName,
        dbVersion: mocks.testStorageVersion,
      },
    });
  });

  describe('register device', () => {
    it('should register a device for the identity', async () => {
      const device = await deviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);
      expect(device).toBeDefined();
      expect(device.publicKey).toBeInstanceOf(Uint8Array);
      expect(device.identityId).toEqual(mocks.testDevice.identityId);
      expect(device.identitySignature).not.toBeNull();
      expect(device.isRevoked).toEqual(false);
      expect(device.issuedAt).toBeTypeOf('number');
    });

    it('should create a device signature', async () => {
      await deviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);
      const signature = await deviceModule.getDeviceSignature();
      expect(signature).toBeInstanceOf(Uint8Array);
    });

    it('should rotate the device keys', async () => {
      await deviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);
      await deviceModule.rotateKeys();
      expect(deviceModule.publicKey).toBeDefined();
      expect(deviceModule.publicKey).not.toEqual(mocks.testDevice.publicKey);
      expect(deviceModule.pqPublicKey).toBeDefined();
      expect(deviceModule.pqPublicKey).not.toEqual(mocks.testDevice.pqPublicKey);
      expect(deviceModule.isRevoked).toEqual(false);
    });

    it('should revoke a device', async () => {
      await deviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);
      await deviceModule.revoke();
      expect(deviceModule.isRevoked).toEqual(true);
    });

    it('should build the identity signature hash', async () => {
      await deviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);
      const payload = await deviceModule.buildIdentitySignatureHash(mocks.testDevice);
      expect(payload?.length).toBeGreaterThan(0);
    });

    it('should load a device for the identity', async () => {
      await deviceModule.register(mocks.testAppId, mocks.testIdentityId, mocks.testIdentity.signer);
      const device = await deviceModule.load(mocks.testIdentityId);
      expect(device).toBeDefined();
      expect(device?.identityId).toEqual(mocks.testIdentityId);
    });
  });
});