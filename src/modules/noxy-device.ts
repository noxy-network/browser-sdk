import { hexToBytes, isBytes, isHex } from 'viem';
import { keygenAsync, signAsync } from '@noble/ed25519';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { concatBytes, randomBytes } from '@noble/hashes/utils.js';
import type { NoxyDevice, NoxyDeviceKeyPairBundle, NoxyDevicePublicKeys, NoxyDevicePrivateKeys } from '@/modules/noxy-device.types';
import type { WalletAddress } from '@/modules/noxy-identity.types';
import { NOXY_DEVICE_KEY_PAIR_TYPE, NOXY_DEVICE_PQ_KEY_PAIR_TYPE, NOXY_DEVICE_VERSION } from '@/modules/noxy-common.constants';
import { NoxyInjectModule } from '@/modules/noxy-common.inject';
import { NoxyStorageModule } from '@/modules/noxy-storage';
import type { NoxyStorageOptions } from '@/modules/noxy-storage.types';
import { NoxyLocalStorageCollection } from '@/modules/noxy-storage.types';
import { NoxyKyberProvider } from '@/modules/noxy-kyber.provider';
import type { Signature, NoAny } from '@/modules/noxy-common.types';

@NoxyInjectModule(NoxyKyberProvider, () => ({}))
@NoxyInjectModule(NoxyStorageModule, (options: NoxyStorageOptions) => options)
export class NoxyDeviceModule {
  #device: NoxyDevice | undefined;

  private static instance: Promise<NoxyDeviceModule> | undefined = undefined;

  private constructor(options: NoxyStorageOptions) {}

  static async create(options: NoAny<NoxyStorageOptions>): Promise<NoxyDeviceModule> {
    if (NoxyDeviceModule.instance !== undefined) return NoxyDeviceModule.instance;
    NoxyDeviceModule.instance = (async () => {
      const inst = new NoxyDeviceModule(options);
      await (inst as any).__initAllModules;
      return inst;
    })();
    return NoxyDeviceModule.instance;
  }

  get #noxyStorageModule(): NoxyStorageModule {
    return (this as any).NoxyStorageModule as NoxyStorageModule;
  }

  get #noxyKyberProvider(): NoxyKyberProvider {
    return (this as any).NoxyKyberProvider as NoxyKyberProvider;
  }

  /**
   * Generate a new device key pair
   */
  private async generateKeys(): Promise<NoxyDeviceKeyPairBundle> {
    const { publicKey,secretKey } = await keygenAsync();
    const { publicKey: pqPublicKey, secretKey: pqSecretKey } = this.#noxyKyberProvider.keypair();
    return {
      keyPair: { privateKey: secretKey, publicKey, keyType: NOXY_DEVICE_KEY_PAIR_TYPE },
      pqKeyPair: { privateKey: pqSecretKey, publicKey: pqPublicKey, keyType: NOXY_DEVICE_PQ_KEY_PAIR_TYPE }
    };
  }

  /**
   * Build the identity signature from the device data
   */
  async buildIdentitySignatureHash(device: NoxyDevice): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const domain = encoder.encode(NOXY_DEVICE_VERSION);
    const appIdBytes = encoder.encode(device.appId);
    const identityIdBytes = encoder.encode(device.identityId);
    const issuedAtBytes = new Uint8Array(8);
    new DataView(issuedAtBytes.buffer).setBigUint64(
      0,
      BigInt(device.issuedAt),
      false
    );
    return keccak_256(
      concatBytes(
        domain,
        appIdBytes,
        identityIdBytes,
        device.publicKey,
        device.pqPublicKey,
        issuedAtBytes
      )
    );
  }

  /**
   * Normalize Signature to bytes using viem encoding.
   */
  private signatureToBytes(sig: Signature | null): Uint8Array | null {
    if (sig === null) return null;
    if (isBytes(sig)) return new Uint8Array(sig);
    const hex = typeof sig === 'string' && (sig.startsWith('0x') ? sig : `0x${sig}`) as `0x${string}`;
    if (isHex(hex)) return hexToBytes(hex);
    return null;
  }

  /**
   * Persist the device data in the local storage
   */
  private async persistDevice(device: NoxyDevice): Promise<void> {
    if (!device) return Promise.resolve();
    const pk = `${device.appId}_${device.identityId}`;
    await this.#noxyStorageModule.save(NoxyLocalStorageCollection.DEVICES, { pk, ...device });
    return Promise.resolve();
  }

  /**
   * Persist the device private key
   * Encrypt the private key and persist it in the local storage
   */
  private async persistDevicePrivateKeys(keys: NoxyDevicePrivateKeys): Promise<void> {
    if (!this.#device || !keys.privateKey || !keys.pqPrivateKey) return Promise.resolve();
    // Store as arrays so JSON round-trip preserves bytes (Uint8Array does not serialize correctly)
    const payload = {
      privateKey: Array.from(keys.privateKey),
      pqPrivateKey: Array.from(keys.pqPrivateKey),
    };
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const pk = `${this.#device.appId}_${this.#device.identityId}`;
    await this.#noxyStorageModule.saveEncrypted(NoxyLocalStorageCollection.DEVICE_KEYS, pk, data);
    return Promise.resolve();
  }

  async loadDevicePrivateKeys(): Promise<NoxyDevicePrivateKeys | undefined> {
    if (!this.#device) return undefined;
    const pk = `${this.#device.appId}_${this.#device.identityId}`;
    const data = await this.#noxyStorageModule.loadDecrypted(NoxyLocalStorageCollection.DEVICE_KEYS, pk);
    if (!data) return undefined;
    const keys = JSON.parse(new TextDecoder().decode(data)) as NoxyDevicePrivateKeys;
    return {
      privateKey: new Uint8Array(keys.privateKey),
      pqPrivateKey: new Uint8Array(keys.pqPrivateKey),
    };
  }

  /**
   * Get the device public key
   */
  get publicKey(): Uint8Array | undefined {
    return this.#device?.publicKey ?? undefined;
  }

  /**
   * Get the device PQ public key
   */
  get pqPublicKey(): Uint8Array | undefined {
    return this.#device?.pqPublicKey ?? undefined;
  }

  /**
   * Get the device revoked status
   */
  get isRevoked(): boolean | undefined {
    return this.#device?.isRevoked ?? undefined;
  }

  /**
   * Revoke a local device
   * Set the device as revoked and persist the device data
   */
  async revoke(): Promise<void> {
    if (!this.#device) return Promise.resolve();
    this.#device.isRevoked = true;
    return this.persistDevice(this.#device);
  }

  /**
   * Load all devices from the local storage
   */
  async listLocalDevices(identityId: WalletAddress): Promise<NoxyDevice[]> {
    const devices = (await this.#noxyStorageModule.loadAll(NoxyLocalStorageCollection.DEVICES, identityId, { indexName: 'identity_fk' })) as NoxyDevice[] | undefined;
    return devices ?? [];
  }

  /**
   * Load active (not revoked) local device for an identity.
   */
  async load(identityId: WalletAddress, appId?: string): Promise<NoxyDevice | undefined> {
    const devices = await this.listLocalDevices(identityId);
    const device = devices.find(d => !d.isRevoked && (appId ? d.appId === appId : true)) ?? undefined;
    this.#device = device ?? undefined;
    return device;
  }

  /**
   * Register a new device for an identity
   * Generate a new device ID, device keys, identity signature and persist the device data
   */
  async register(appId: string, identityId: WalletAddress, identitySigner?: (data: Uint8Array) => Promise<Signature>): Promise<NoxyDevice> {
    const { keyPair, pqKeyPair } = await this.generateKeys();

    const devicePublicKeys: NoxyDevicePublicKeys = {
      publicKey: keyPair.publicKey,
      pqPublicKey: pqKeyPair.publicKey,
    };

    const devicePrivateKeys: NoxyDevicePrivateKeys = {
      privateKey: keyPair.privateKey,
      pqPrivateKey: pqKeyPair.privateKey,
    };

    const deviceData: NoxyDevice = {
      appId,
      identityId,
      identitySignature: null,
      isRevoked: false,
      issuedAt: Date.now(),
      ...devicePublicKeys,
    };

    // Build signature payload using the newly generated device data
    const identitySignatureHash = await this.buildIdentitySignatureHash(deviceData);
    const identitySignature = typeof identitySigner === 'function'
      ? await identitySigner(identitySignatureHash)
      : null;
    deviceData.identitySignature = this.signatureToBytes(identitySignature);

    this.#device = deviceData;
    await this.persistDevice(deviceData);
    await this.persistDevicePrivateKeys(devicePrivateKeys);
    return this.#device;
  }

  /**
   * Rotate the device keys
   * Create a new key pair and persist the new keys
   */
  async rotateKeys(): Promise<void> {
    if (!this.#device) return Promise.resolve();
    const { keyPair, pqKeyPair } = await this.generateKeys();

    const devicePublicKeys: NoxyDevicePublicKeys = {
      publicKey: keyPair.publicKey,
      pqPublicKey: pqKeyPair.publicKey,
    };

    const devicePrivateKeys: NoxyDevicePrivateKeys = {
      privateKey: keyPair.privateKey,
      pqPrivateKey: pqKeyPair.privateKey,
    };

    this.#device = {
      ...this.#device,
      ...devicePublicKeys,
    };

    await this.persistDevice(this.#device);
    await this.persistDevicePrivateKeys(devicePrivateKeys);
  }

  /**
   * Sign data with the device private key
   */
  async getDeviceSignature(): Promise<Uint8Array | undefined> {
    if (!this.#device) return undefined;
    const devicePrivateKeys = await this.loadDevicePrivateKeys();
    if (!devicePrivateKeys) return undefined;
    const encoder = new TextEncoder();
    const domain = encoder.encode(NOXY_DEVICE_VERSION);
    const appIdBytes = encoder.encode(this.#device.appId);
    const identityIdBytes = encoder.encode(this.#device.identityId);
    const dateBytes = new Uint8Array(8);
    new DataView(dateBytes.buffer).setBigUint64(
      0,
      BigInt(Date.now()),
      false
    );
    const bytes = concatBytes(
      domain,
      appIdBytes,
      identityIdBytes,
      dateBytes,
      randomBytes(16),
    );
    return signAsync(bytes, devicePrivateKeys.privateKey);
  }
}