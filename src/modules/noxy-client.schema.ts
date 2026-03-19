import { z } from 'zod';
import { NoxyIdentityTypeEnum } from '@/modules/noxy-identity.types';

/**
 * Supported cryptographic key types
 */
const NoxyIdentityCryptoKeyTypeSchema = z.enum([
  'ed25519',
  'ed448',
  'sr25519',
  'secp256k1',
  'secp256k1-schnorr',
]);

/**
 * Signature function validator
 * Note: Zod cannot deeply validate function signatures at runtime,
 * so we use a basic function check
 */
const SignerFunctionSchema = z.custom<(data: Uint8Array) => Promise<Uint8Array | `0x${string}` | string>>(
  (val) => typeof val === 'function',
  { message: 'Signer must be a function' }
);

/**
 * EOA Wallet Identity Schema
 * Matches NoxyEoaWalletIdentity: type, address, optional chainId/publicKey/publicKeyType, required signer
 */
const NoxyEoaWalletIdentitySchema = z.object({
  type: z.literal(NoxyIdentityTypeEnum.EOA),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address format'),
  chainId: z.string().optional(),
  publicKey: z.union([z.instanceof(Uint8Array), z.string()]).optional(),
  publicKeyType: NoxyIdentityCryptoKeyTypeSchema.optional(),
  signer: SignerFunctionSchema,
});

/**
 * SCW (Smart Contract Wallet) Identity Schema
 * Matches NoxyScwWalletIdentity: type, address, optional chainId/publicKey/publicKeyType, required signer
 */
const NoxyScwWalletIdentitySchema = z.object({
  type: z.literal(NoxyIdentityTypeEnum.SCW),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid smart contract address format'),
  chainId: z.string().optional(),
  publicKey: z.union([z.instanceof(Uint8Array), z.string()]).optional(),
  publicKeyType: NoxyIdentityCryptoKeyTypeSchema.optional(),
  signer: SignerFunctionSchema,
});

/**
 * NoxyIdentity Schema (union of all identity types)
 */
export const NoxyIdentitySchema = z.union([
  NoxyEoaWalletIdentitySchema,
  NoxyScwWalletIdentitySchema,
]);

/**
 * Storage Options Schema
 */
export const NoxyStorageOptionsSchema = z.object({
  encryptionKey: z.instanceof(Uint8Array)
    .refine((key) => [16, 24, 32].includes(key.byteLength), {
      message: 'Encryption key must be 16, 24, or 32 bytes for AES-GCM',
    })
    .optional(),
  indexedDb: z.object({
    dbName: z.string().min(1).optional(),
    dbVersion: z.number().int().positive().optional(),
  }).optional(),
}).optional();

/**
 * Network Options Schema
 */
export const NoxyNetworkOptionsSchema = z.object({
  relayNodesUrl: z.string().url('Relay URL must be valid'),
  appId: z.string().min(1, 'App ID is required'),
  maxRetries: z.number().int().nonnegative().optional(),
  retryTimeoutMs: z.number().int().positive().optional(),
  requireAck: z.boolean().optional(),
});

/**
 * Main NoxyClientOptions Schema
 */
export const NoxyClientOptionsSchema = z.object({
  identity: NoxyIdentitySchema,
  network: NoxyNetworkOptionsSchema,
  storage: NoxyStorageOptionsSchema,
});

/**
 * Type inference from schema
 */
export type NoxyClientOptionsInput = z.input<typeof NoxyClientOptionsSchema>;
export type NoxyClientOptionsOutput = z.output<typeof NoxyClientOptionsSchema>;

