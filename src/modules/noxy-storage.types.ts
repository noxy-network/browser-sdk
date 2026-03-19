import type { NoxyDeviceSchema, NoxyDeviceKeysSchema } from '@/modules/noxy-device.types';

export type NoxyStorageOptions = {
  /**
   * Optional raw AES-GCM key material (16/24/32 bytes)
   */
  encryptionKey?: Uint8Array;

 /**
  * Browser IndexedDB configuration.
  */
  indexedDb?: {
    dbName?: string;
    dbVersion?: number;
  };
};

/**
 * Local storage collection names
 */
export enum NoxyLocalStorageCollection {
  DEVICES = 'noxy:devices',
  DEVICE_KEYS = 'noxy:device-keys',
  /** Internal store for auto-generated encryption key (when user omits encryptionKey) */
  ENCRYPTION_KEY = 'noxy:encryption-key',
}

/**
 * Local storage collection type (used for type safety)
 */
export type NoxyLocalStorageCollectionType =
  | NoxyLocalStorageCollection.DEVICES
  | NoxyLocalStorageCollection.DEVICE_KEYS
  | NoxyLocalStorageCollection.ENCRYPTION_KEY;

/**
 * Record stored in ENCRYPTION_KEY store for persisting auto-generated key
 */
export type NoxyEncryptionKeyRecord = {
  id: string;
  key: ArrayBuffer;
};

/**
 * Browser IndexedDB schema
 */
export interface NoxyLocalStorageSchema {
  objectStoreNames: {
    [NoxyLocalStorageCollection.DEVICES]: NoxyDeviceSchema;
    [NoxyLocalStorageCollection.DEVICE_KEYS]: NoxyDeviceKeysSchema;
    [NoxyLocalStorageCollection.ENCRYPTION_KEY]: NoxyEncryptionKeyRecord;
  };
}

/**
 * Type helper to get the value type for a collection
 */
export type NoxyLocalStorageValue<T extends NoxyLocalStorageCollectionType> =
  NoxyLocalStorageSchema['objectStoreNames'][T];

/**
 * Options for querying data from storage
 */
export type NoxyLoadOptions = {
  /**
   * Optional index name to query by. If not provided, queries by primary key.
   */
  indexName?: string;
};

/**
 * Local storage API
 */
export interface NoxyLocalStorageAPI {
  load: <T extends NoxyLocalStorageCollectionType>(
    storeName: T,
    key: IDBValidKey,
    options?: NoxyLoadOptions
  ) => Promise<NoxyLocalStorageValue<T> | undefined>;
  loadAll: <T extends NoxyLocalStorageCollectionType>(
    storeName: T,
    key?: IDBValidKey,
    options?: NoxyLoadOptions
  ) => Promise<NoxyLocalStorageValue<T>[]>;
  save: <T extends NoxyLocalStorageCollectionType>(
    storeName: T,
    value: NoxyLocalStorageValue<T>
  ) => Promise<IDBValidKey>;
  delete: (
    storeName: NoxyLocalStorageCollectionType,
    key: IDBValidKey
  ) => Promise<void>;
  clear: (
    storeName: NoxyLocalStorageCollectionType,
  ) => Promise<void>;
  loadDecrypted: (
    storeName: NoxyLocalStorageCollectionType,
    key: IDBValidKey
  ) => Promise<Uint8Array | undefined>;
  /** keyRecord must include the store keyPath field (e.g. appId_identityId for DEVICE_KEYS). */
  saveEncrypted: (
    storeName: NoxyLocalStorageCollectionType,
    keyRecord: IDBValidKey,
    data: Uint8Array
  ) => Promise<IDBValidKey>;
}

/**
 * Local storage index configuration
 */
export type NoxyLocalStorageIndexConfig = {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
};

/**
 * Local storage configuration type
 */
export type NoxyLocalStorageConfigType = {
  name: NoxyLocalStorageCollectionType;
  options: IDBObjectStoreParameters;
  indexes?: NoxyLocalStorageIndexConfig[];
};

/**
 * Local storage configuration
 * DEVICES and DEVICE_KEYS use keyPath pk only.
 * identity_fk index on DEVICES allows fetching all devices by identityId.
 * ENCRYPTION_KEY stores auto-generated AES key when user omits encryptionKey.
 */
export const NOXY_LOCAL_STORAGE_CONFIG: readonly NoxyLocalStorageConfigType[] = [
  {
    name: NoxyLocalStorageCollection.DEVICES,
    options: { keyPath: 'pk' },
    indexes: [
      {
        name: 'identity_fk',
        keyPath: 'identityId',
        options: { unique: false },
      },
    ],
  },
  {
    name: NoxyLocalStorageCollection.DEVICE_KEYS,
    options: { keyPath: 'pk' },
  },
  {
    name: NoxyLocalStorageCollection.ENCRYPTION_KEY,
    options: { keyPath: 'id' },
  },
] as const;

/** Primary key for the default encryption key record */
export const NOXY_ENCRYPTION_KEY_ID = 'default' as const;