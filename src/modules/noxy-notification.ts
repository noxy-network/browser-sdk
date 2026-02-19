import { base64 } from '@scure/base';
import { JSONParse } from 'json-with-bigint';
import type { NoxyStorageOptions } from '@/modules/noxy-storage.types';
import { NoxyInjectModule } from '@/modules/noxy-common.inject';
import { NoxyDeviceModule } from '@/modules/noxy-device';
import { NoxyGeneralError } from '@/modules/noxy-error';
import type { NoAny } from '@/modules/noxy-common.types';
import type { NoxyEncryptedNotification } from '@/modules/noxy-notification.types';
import { randomBytes } from '@noble/hashes/utils.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/webcrypto.js';
import { NoxyKyberProvider } from '@/modules/noxy-kyber.provider';

@NoxyInjectModule(NoxyKyberProvider, () => ({}))
@NoxyInjectModule(NoxyDeviceModule, (options: NoxyStorageOptions) => options)
export class NoxyNotificationModule {
  private static instance: Promise<NoxyNotificationModule> | undefined = undefined;

  private constructor(options: NoxyStorageOptions) {}

  static async create(options: NoAny<NoxyStorageOptions>): Promise<NoxyNotificationModule> {
    if (NoxyNotificationModule.instance !== undefined) return NoxyNotificationModule.instance;
    NoxyNotificationModule.instance = (async () => {
      const inst = new NoxyNotificationModule(options);
      await (inst as any).__initAllModules;
      return inst;
    })();
    return NoxyNotificationModule.instance;
  }

  get #noxyDeviceModule(): NoxyDeviceModule {
    return (this as any).NoxyDeviceModule as NoxyDeviceModule;
  }

  get #noxyKyberProvider(): NoxyKyberProvider {
    return (this as any).NoxyKyberProvider as NoxyKyberProvider;
  }

  /**
   * Encrypt a notification
   * This performs the actual encryption operation
   * @param payload - The notification payload to encrypt
   * @returns The encrypted notification
   */
  async encryptNotification(plaintext: Uint8Array): Promise<NoxyEncryptedNotification> {
    const devicePQPublicKey = this.#noxyDeviceModule.pqPublicKey;
    if (!devicePQPublicKey) {
      throw new NoxyGeneralError({ message: 'Device cannot encrypt notification' });
    }

    const { ciphertext: kyberCt, sharedSecret } = this.#noxyKyberProvider.encapsulate(devicePQPublicKey);

    // Derive symmetric key (HKDF)
    const key = hkdf(sha256, sharedSecret, undefined, undefined, 32);

    const nonce = randomBytes(12);

    const cipher = gcm(key, nonce);
    const ciphertext = await cipher.encrypt(plaintext);

    return {
      kyber_ct: kyberCt,
      nonce,
      ciphertext,
    };
  }

  /**
   * Decrypt a notification
   * @param data - The encrypted notification (kyber_ct, nonce, ciphertext)
   * @returns The decrypted notification
   */
  async decryptNotification(data: NoxyEncryptedNotification): Promise<any> {
    const devicePrivateKeys = await this.#noxyDeviceModule.loadDevicePrivateKeys();
    const devicePrivateKey = devicePrivateKeys?.pqPrivateKey;
    if (!devicePrivateKey) {
      throw new NoxyGeneralError({ message: 'Device cannot decrypt notification' });
    }

    // Coerce to Uint8Array; relay may send camelCase (kyberCt) and base64 strings
    const toBytes = (v: Uint8Array | string | number[] | undefined, name: string): Uint8Array => {
      if (v === undefined) throw new NoxyGeneralError({ message: `Missing ${name} in encrypted notification` });
      if (v instanceof Uint8Array) return v;
      if (typeof v === 'string') return base64.decode(v);
      return new Uint8Array(v);
    };
    const kyberCtRaw = (data as any).kyber_ct ?? (data as any).kyberCt;
    const nonceRaw = data.nonce;
    const ciphertextRaw = data.ciphertext;
    const kyber_ct = toBytes(kyberCtRaw, 'kyber_ct');
    const nonce = toBytes(nonceRaw, 'nonce');
    const ciphertext = toBytes(ciphertextRaw, 'ciphertext');

    const sharedSecret = this.#noxyKyberProvider.decapsulate(devicePrivateKey, kyber_ct);

    const key = hkdf(sha256, sharedSecret, undefined, undefined, 32);

    const decipher = gcm(key, nonce);
    const plaintext = await decipher.decrypt(ciphertext as Uint8Array);

    return JSONParse(new TextDecoder().decode(plaintext));
  }
}