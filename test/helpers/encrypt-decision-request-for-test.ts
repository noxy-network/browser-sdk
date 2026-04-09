/**
 * Test-only encryption matching the relay path (inverse of decryptDecisionRequest).
 */
import { randomBytes } from '@noble/hashes/utils.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/webcrypto.js';
import type { NoxyEncryptedDecisionRequest } from '@/modules/noxy-decision-request.types';
import type { NoxyDeviceModule } from '@/modules/noxy-device';
import type { NoxyKyberProvider } from '@/modules/noxy-kyber.provider';

export async function encryptDecisionRequestForTest(
  deviceModule: NoxyDeviceModule,
  kyber: NoxyKyberProvider,
  plaintext: Uint8Array
): Promise<NoxyEncryptedDecisionRequest> {
  const devicePQPublicKey = deviceModule.pqPublicKey;
  if (!devicePQPublicKey) {
    throw new Error('Device has no PQ public key');
  }

  const { ciphertext: kyberCt, sharedSecret } = kyber.encapsulate(devicePQPublicKey);
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
