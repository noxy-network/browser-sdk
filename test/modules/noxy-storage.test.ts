import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { NoxyStorageModule } from '@/modules/noxy-storage';
import { NoxyLocalStorageCollection } from '@/modules/noxy-storage.types';
import { NOXY_STORAGE_DB_NAME } from '@/modules/noxy-common.constants';
import initMocks from '@test/__mocks__';

describe('NoxyStorageModule', () => {
  let storage: NoxyStorageModule;
  let mocks: Record<string, any>;

  beforeAll(async () => {
    mocks = await initMocks();
  });

  afterEach(async () => {
    // Clean up: disconnect and delete test database
    if (storage) {
      storage.disconnect();
    }

    // Delete the test database
    if (typeof indexedDB !== 'undefined') {
      // eslint-disable-next-line
      indexedDB.deleteDatabase(mocks.testStorageName);
      // eslint-disable-next-line
      indexedDB.deleteDatabase(NOXY_STORAGE_DB_NAME);
    }
  });

  describe('constructor', () => {
    it('initializes with default options', () => {
      storage = new NoxyStorageModule();
      expect(storage).toBeInstanceOf(NoxyStorageModule);
    });

    it('accepts custom database name and version', () => {
      storage = new NoxyStorageModule({
        indexedDb: {
          dbName: mocks.testStorageName,
          dbVersion: mocks.testStorageVersion,
        },
      });
      expect(storage).toBeInstanceOf(NoxyStorageModule);
    });

    it('accepts encryption key option', () => {
      const encryptionKey = new Uint8Array(32).fill(1);
      storage = new NoxyStorageModule({
        encryptionKey,
        indexedDb: { dbName: mocks.testStorageName },
      });
      expect(storage).toBeInstanceOf(NoxyStorageModule);
    });
  });

  describe('database connection', () => {
    it('connects to database successfully', async () => {
      storage = new NoxyStorageModule({
        indexedDb: { dbName: mocks.testStorageName },
      });

      await expect(storage.connect()).resolves.not.toThrow();
    });

    it('disconnects from database successfully', async () => {
      storage = new NoxyStorageModule({
        indexedDb: { dbName: mocks.testStorageName },
      });

      await storage.connect();
      expect(() => storage.disconnect()).not.toThrow();
    });

    it('handles disconnect when not connected', () => {
      storage = new NoxyStorageModule({
        indexedDb: { dbName: mocks.testStorageName },
      });

      expect(() => storage.disconnect()).not.toThrow();
    });
  });

  describe('CRUD operations', () => {
    beforeEach(async () => {
      storage = new NoxyStorageModule({
        indexedDb: { dbName: mocks.testStorageName },
      });
      await storage.connect();
    });

    it('saves and loads a device', async () => {
      const pk = `${mocks.testAppId}_${mocks.testIdentityId}`;
      const toSave = { ...mocks.testDevice, pk };
      await storage.save(NoxyLocalStorageCollection.DEVICES, toSave);
      const loadedDevice = await storage.load(NoxyLocalStorageCollection.DEVICES, pk);

      const { publicKey, pk: _pk, ...rest } = toSave;
      const { publicKey: loadedPublicKey, pk: _lp, ...loadedRest } = loadedDevice!;

      expect(loadedRest).toEqual(rest);
      expect(Array.from(loadedPublicKey)).toEqual(Array.from(publicKey));
    });

    it('saves and loads an encrypted device key', async () => {
      const pk = `${mocks.testAppId}_${mocks.testIdentityId}`;
      await storage.saveEncrypted(NoxyLocalStorageCollection.DEVICE_KEYS, pk, mocks.testDevicePrivateKey);
      const loadedDeviceKey = await storage.loadDecrypted(NoxyLocalStorageCollection.DEVICE_KEYS, pk);

      expect(loadedDeviceKey).toEqual(mocks.testDevicePrivateKey);
    });

    it('round-trips device private keys payload', async () => {
      const pk = `${mocks.testAppId}_${mocks.testIdentityId}`;
      const payload = {
        privateKey: Array.from(mocks.testDevicePrivateKey),
        pqPrivateKey: Array.from(mocks.testDevicePqPrivateKey),
      };
      const data = new TextEncoder().encode(JSON.stringify(payload));
      await storage.saveEncrypted(NoxyLocalStorageCollection.DEVICE_KEYS, pk, data);

      const loaded = await storage.loadDecrypted(NoxyLocalStorageCollection.DEVICE_KEYS, pk);
      expect(loaded).toBeDefined();

      // Same restore logic as NoxyDeviceModule.loadDevicePrivateKeys
      const keys = JSON.parse(new TextDecoder().decode(loaded!)) as { privateKey: number[]; pqPrivateKey: number[] };
      const restored = {
        privateKey: new Uint8Array(keys.privateKey),
        pqPrivateKey: new Uint8Array(keys.pqPrivateKey),
      };

      expect(restored.privateKey).toBeInstanceOf(Uint8Array);
      expect(restored.pqPrivateKey).toBeInstanceOf(Uint8Array);
      expect(restored.privateKey.length).toBe(32);
      expect(restored.privateKey).toEqual(mocks.testDevicePrivateKey);
      expect(restored.pqPrivateKey).toEqual(mocks.testDevicePqPrivateKey);
    });
  });
});