import { v4 as uuidv4 } from 'uuid';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keygenAsync } from '@noble/ed25519';
import { NoxyIdentityTypeEnum } from '@/modules/noxy-identity.types';
import type { Hash } from '@/modules/noxy-common.types';
import type { NoxyEoaWalletIdentity, NoxyScwWalletIdentity } from '@/modules/noxy-identity.types';
import type { NoxyDevice } from '@/modules/noxy-device.types';
import { NoxyKyberProvider } from '@/modules/noxy-kyber.provider';

export default async function (): Promise<Record<string, unknown>> {
  const testStorageName = `test-db-${Date.now()}`;
  const testStorageVersion = 1;

  const testAppId = 'noxy-test-app';

  // EOA Wallet Identity (Externally Owned Account)
  const evmIdentity = privateKeyToAccount(generatePrivateKey());
  const testIdentity: NoxyEoaWalletIdentity = {
    type: NoxyIdentityTypeEnum.EOA,
    address: evmIdentity.address,
    publicKey: evmIdentity.publicKey,
    signer: async (data: Uint8Array): Promise<Hash> => evmIdentity.signMessage({ message: { raw: data } }),
  };
  const testIdentityId = testIdentity.address;

  // SCW Identity (Smart Contract Wallet)
  const scwEvmIdentity = privateKeyToAccount(generatePrivateKey());
  const testScwIdentity: NoxyScwWalletIdentity = {
    type: NoxyIdentityTypeEnum.SCW,
    address: scwEvmIdentity.address,
    chainId: '1',
    publicKey: scwEvmIdentity.publicKey,
    signer: async (data: Uint8Array): Promise<Hash> => scwEvmIdentity.signMessage({ message: { raw: data } }),
  };
  const testScwIdentityId = new TextEncoder().encode(testScwIdentity.address);

  const testDeviceId = uuidv4();
  const testDeviceKeyPair = await keygenAsync();
  const testDevicePrivateKey = testDeviceKeyPair.secretKey;
  const testDevicePublicKey = testDeviceKeyPair.publicKey;

  // In Node (vitest), WASM is provided via globalThis.__NOXY_KYBER_WASM_BINARY__ (vitest.setup.ts)
  const kyberProvider = await NoxyKyberProvider.create();
  const testDevicePqKeyPair = kyberProvider.keypair();
  const testDevicePqPublicKey = testDevicePqKeyPair.publicKey;
  const testDevicePqPrivateKey = testDevicePqKeyPair.secretKey;

  const testDevice: NoxyDevice = {
    appId: testAppId,
    identityId: testIdentityId,
    identitySignature: null,
    isRevoked: false,
    issuedAt: Date.now(),
    publicKey: testDevicePublicKey,
    pqPublicKey: testDevicePqPublicKey,
  };

  return {
    testStorageName,
    testStorageVersion,
    testAppId,
    testIdentity,
    testIdentityId,
    testScwIdentity,
    testScwIdentityId,
    testDeviceId,
    testDevicePublicKey,
    testDevicePrivateKey,
    testDevicePqPublicKey,
    testDevicePqPrivateKey,
    testDevice,
  };
}