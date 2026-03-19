import { openDB, IDBPDatabase } from 'idb';
import { NOXY_STORAGE_DB_NAME } from '@/modules/noxy-common.constants';
import {
  NOXY_LOCAL_STORAGE_CONFIG,
  NOXY_ENCRYPTION_KEY_ID,
  NoxyLocalStorageCollection,
} from '@/modules/noxy-storage.types';
import type {
  NoxyStorageOptions,
  NoxyLocalStorageSchema,
  NoxyLocalStorageCollectionType,
  NoxyLocalStorageIndexConfig,
  NoxyLocalStorageAPI,
  NoxyLoadOptions,
} from '@/modules/noxy-storage.types';
import { randomBytes } from '@noble/hashes/utils.js';
import * as webcrypto from '@noble/ciphers/webcrypto.js';
import { NoxyStorageError } from '@/modules/noxy-error';
import { NoxyStorageErrorOperationEnum } from '@/modules/noxy-error.types';
import type { NoAny } from '@/modules/noxy-common.types';

/** Generate a cryptographically secure 256-bit key using Web Crypto API */
function generateEncryptionKey(length: number): Uint8Array {
  const key = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(key);
    return key;
  }
  return randomBytes(length);
}

export class NoxyStorageModule implements NoxyLocalStorageAPI {
  #dbName: string;
  #dbVersion: number;
  #dbEncryptionKey: Uint8Array | null;
  #dbConnection: IDBPDatabase<NoxyLocalStorageSchema> | null = null;

  private static instance: NoxyStorageModule | undefined = undefined;

  constructor(options: NoAny<NoxyStorageOptions> = {}) {
    this.#dbName = options.indexedDb?.dbName ?? NOXY_STORAGE_DB_NAME;
    this.#dbVersion = options.indexedDb?.dbVersion ?? 1;
    this.#dbEncryptionKey = options.encryptionKey ?? null;
  }

  static create(options: NoAny<NoxyStorageOptions> = {}): NoxyStorageModule {
    if (NoxyStorageModule.instance !== undefined) return NoxyStorageModule.instance;
    NoxyStorageModule.instance = new NoxyStorageModule(options);
    return NoxyStorageModule.instance;
  }

  private get encryptionKey(): Uint8Array {
    if (!this.#dbEncryptionKey) {
      throw new NoxyStorageError({
        code: 'ENCRYPTION_KEY_NOT_READY',
        message: 'Encryption key not yet resolved; ensure connect() has completed',
        operation: NoxyStorageErrorOperationEnum.VALIDATE_KEY,
      });
    }
    return this.#dbEncryptionKey;
  }

  private createObjectStores(db: IDBPDatabase<NoxyLocalStorageSchema>): void {
    for (const config of NOXY_LOCAL_STORAGE_CONFIG) {
      if (db.objectStoreNames.contains(config.name)) continue;

      const store = db.createObjectStore(config.name, config.options);
      this.createIndexes(store, config.indexes);
    }
  }

  private createIndexes(store: any, indexes: NoxyLocalStorageIndexConfig[] | undefined): void {
    const list = indexes ?? [];

    for (const { name, keyPath, options } of list) {
      store.createIndex(name, keyPath, options);
    }
  }

  private async validateDbEncryptionKey(): Promise<void> {
    const key = this.encryptionKey;
    const validKeySizes = [16, 24, 32];
    if (!validKeySizes.includes(key.byteLength)) {
      throw new NoxyStorageError({
        code: 'INVALID_ENCRYPTION_KEY',
        message: `Invalid db encryption key length. AES key must be 16, 24, or 32 bytes for CBC/CTR/GCM modes, got ${key.byteLength} bytes`,
        operation: NoxyStorageErrorOperationEnum.VALIDATE_KEY,
      });
    }
  }

  /** Load or generate encryption key when user did not provide one; persists in IndexedDB */
  private async resolveAutoEncryptionKey(): Promise<void> {
    if (this.#dbEncryptionKey !== null) return;

    const record = await this.load(
      NoxyLocalStorageCollection.ENCRYPTION_KEY,
      NOXY_ENCRYPTION_KEY_ID
    );

    if (record?.key) {
      this.#dbEncryptionKey = new Uint8Array(record.key);
      return;
    }

    const key = generateEncryptionKey(32);
    const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
    await this.save(NoxyLocalStorageCollection.ENCRYPTION_KEY, {
      id: NOXY_ENCRYPTION_KEY_ID,
      key: keyBuffer,
    });
    this.#dbEncryptionKey = key;
  }

  async connect(): Promise<void> {
    if (this.#dbConnection) return;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.#dbConnection = await openDB(this.#dbName, this.#dbVersion, {
      upgrade(db) {
        return self.createObjectStores(db);
      },
      terminated() {
        return self.disconnect();
      },
    });
    await this.resolveAutoEncryptionKey();
    await this.validateDbEncryptionKey();
  }

  /**
   * Ensure database connection is established before operations
   * Automatically connects if not already connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.#dbConnection) {
      await this.connect();
    }
  }

  disconnect(): void {
    this.#dbConnection?.close();
    this.#dbConnection = null;
  }

  async load<T extends NoxyLocalStorageCollectionType>(
    storeName: T,
    key: IDBValidKey,
    options?: NoxyLoadOptions
  ): Promise<NoxyLocalStorageSchema['objectStoreNames'][T] | undefined> {
    await this.ensureConnected();

    // Query by index if specified
    if (options?.indexName) {
      return (await this.#dbConnection!.getFromIndex(storeName, options.indexName, key)) as
        NoxyLocalStorageSchema['objectStoreNames'][T] | undefined;
    }

    // Query by primary key
    return (await this.#dbConnection!.get(storeName, key)) as
      NoxyLocalStorageSchema['objectStoreNames'][T] | undefined;
  }

  async loadAll<T extends NoxyLocalStorageCollectionType>(
    storeName: T,
    key?: IDBValidKey,
    options?: NoxyLoadOptions
  ): Promise<NoxyLocalStorageSchema['objectStoreNames'][T][]> {
    await this.ensureConnected();

    // Query by index if specified
    if (options?.indexName) {
      return (await this.#dbConnection!.getAllFromIndex(storeName, options.indexName, key)) as
        NoxyLocalStorageSchema['objectStoreNames'][T][];
    }

    // Get all records (optionally filtered by primary key)
    return (await this.#dbConnection!.getAll(storeName, key)) as
      NoxyLocalStorageSchema['objectStoreNames'][T][];
  }

  async save<T extends NoxyLocalStorageCollectionType>(
    storeName: T,
    value: NoxyLocalStorageSchema['objectStoreNames'][T]
  ): Promise<IDBValidKey> {
    await this.ensureConnected();
    return (await this.#dbConnection!.put(storeName, value)) as IDBValidKey;
  }

  async delete(
    storeName: NoxyLocalStorageCollectionType,
    key: IDBValidKey,
    options?: NoxyLoadOptions
  ): Promise<void> {
    await this.ensureConnected();

    // Delete by index if specified
    if (options?.indexName) {
      const tx = this.#dbConnection!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index(options.indexName);

      // Get all primary keys matching the index value
      const keys = await index.getAllKeys(key);

      // Delete all matching records
      for (const pk of keys) {
        await store.delete(pk);
      }

      await tx.done;
      return;
    }

    // Delete by primary key (default behavior)
    await this.#dbConnection!.delete(storeName, key);
  }

  async clear(
    storeName: NoxyLocalStorageCollectionType,
  ): Promise<void> {
    await this.ensureConnected();
    await this.#dbConnection!.clear(storeName);
  }

  async loadDecrypted(
    storeName: NoxyLocalStorageCollectionType,
    key: IDBValidKey
  ): Promise<Uint8Array | undefined> {
    await this.ensureConnected();
    const tx = this.#dbConnection!.transaction(storeName, 'readonly');
    const record = await tx.objectStore(storeName).get(key);
    await tx.done;
    if (!record) return undefined;
    return webcrypto.gcm(this.encryptionKey, record.iv).decrypt(record.ciphertext);
  }

  async saveEncrypted(
    storeName: NoxyLocalStorageCollectionType,
    key: IDBValidKey,
    data: Uint8Array
  ): Promise<IDBValidKey> {
    await this.ensureConnected();

    const iv = randomBytes(12);
    const ciphertext = await webcrypto.gcm(this.encryptionKey, iv).encrypt(data);

    const config = NOXY_LOCAL_STORAGE_CONFIG.find(c => c.name === storeName);
    const keyPath = config?.options?.keyPath as string;

    const tx = this.#dbConnection!.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).put({ [keyPath]: key, iv, ciphertext });
    await tx.done;

    return key as IDBValidKey;
  }
}
