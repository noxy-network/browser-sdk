import { base64 } from '@scure/base';
import { JSONParse } from 'json-with-bigint';
import type { NoxyStorageOptions } from '@/modules/noxy-storage.types';
import { NoxyInjectModule } from '@/modules/noxy-common.inject';
import { NoxyDeviceModule } from '@/modules/noxy-device';
import { NoxyGeneralError } from '@/modules/noxy-error';
import type { NoAny } from '@/modules/noxy-common.types';
import type { NoxyEncryptedDecisionRequest } from '@/modules/noxy-decision-request.types';
import type { UUIDTypes } from 'uuid';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/webcrypto.js';
import { NoxyKyberProvider } from '@/modules/noxy-kyber.provider';

@NoxyInjectModule(NoxyKyberProvider, () => ({}))
@NoxyInjectModule(NoxyDeviceModule, (options: NoxyStorageOptions) => options)
export class NoxyDecisionRequestModule {
  private static instance: Promise<NoxyDecisionRequestModule> | undefined = undefined;

  private constructor(options: NoxyStorageOptions) {}

  static async create(options: NoAny<NoxyStorageOptions>): Promise<NoxyDecisionRequestModule> {
    if (NoxyDecisionRequestModule.instance !== undefined) return NoxyDecisionRequestModule.instance;
    NoxyDecisionRequestModule.instance = (async () => {
      const inst = new NoxyDecisionRequestModule(options);
      await (inst as any).__initAllModules;
      return inst;
    })();
    return NoxyDecisionRequestModule.instance;
  }

  get #noxyDeviceModule(): NoxyDeviceModule {
    return (this as any).NoxyDeviceModule as NoxyDeviceModule;
  }

  get #noxyKyberProvider(): NoxyKyberProvider {
    return (this as any).NoxyKyberProvider as NoxyKyberProvider;
  }

  resolveDecisionRequestId(decision: unknown, messageId?: string | UUIDTypes): string {
    if (decision && typeof decision === 'object') {
      const o = decision as Record<string, unknown>;
      if (typeof o.decision_id === 'string') return o.decision_id;
      if (typeof o.decisionId === 'string') return o.decisionId;
    }
    if (messageId !== undefined && messageId !== null) return String(messageId);
    throw new NoxyGeneralError({
      message: 'Decision ID could not be resolved',
    });
  }

  async decryptDecisionRequest(data: NoxyEncryptedDecisionRequest): Promise<any> {
    const devicePrivateKeys = await this.#noxyDeviceModule.loadDevicePrivateKeys();
    const devicePrivateKey = devicePrivateKeys?.pqPrivateKey;
    if (!devicePrivateKey) {
      throw new NoxyGeneralError({ message: 'Device cannot decrypt decision request' });
    }

    const toBytes = (v: Uint8Array | string | number[] | undefined, name: string): Uint8Array => {
      if (v === undefined) throw new NoxyGeneralError({ message: `Missing ${name} in encrypted decision request` });
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
