import type { Hash, Signature } from '@/modules/noxy-common.types';
/**
 * EVM-style address (EOA or SCW).
 *
 * This is intentionally broad (`0x${string}`) and does not enforce
 * checksum or length at the type level.
 */
export type WalletAddress = Hash;

/**
 * Cryptographic key types Noxy identities may use.
 */
export type NoxyIdentityCryptoKeyType =
| 'ed25519'            // Solana, Cardano, Polkadot, NEAR, Aptos, Sui, Stellar
| 'ed448'              // High-security applications
| 'sr25519'            // Polkadot, Kusama, Substrate-based chains
| 'secp256k1'          // Ethereum, Bitcoin (ECDSA), most EVM chains
| 'secp256k1-schnorr'; // Bitcoin Taproot (BIP340)

export enum NoxyIdentityTypeEnum {
  EOA = 'eoa',
  SCW = 'scw',
}

/**
 * Identity types supported by the SDK.
 */
export type NoxyIdentityType = `${NoxyIdentityTypeEnum}`;

/**
 * EOA wallet identity (externally owned account).
 */
export type NoxyEoaWalletIdentity = {
  type: NoxyIdentityTypeEnum.EOA;
  /**
   * EVM-style chain / network identifier (name or chain ID).
   */
  chainId?: string;
  /**
   * User-facing wallet address (0x...).
   */
  address: WalletAddress;
  /**
   * Public key of the identity.
   */
  publicKey?: Uint8Array | string;
  /**
   * Type of the public key.
   */
  publicKeyType?: NoxyIdentityCryptoKeyType;
  /**
   * Signer function of the identity.
   */
  signer: (data: Uint8Array) => Promise<Signature>;
};

/**
 * Smart Contract Wallet (SCW) identity.
 */
export type NoxyScwWalletIdentity = {
  type: NoxyIdentityTypeEnum.SCW;
  /**
   * Chain / network identifier.
   * For EVM chains, prefer a string name or chain ID.
   */
  chainId?: string;
  /**
   * Smart contract wallet address (0x...).
   */
  address: WalletAddress;
  /**
   * Public key of the identity.
   */
  publicKey?: Uint8Array | string;
  /**
   * Type of the public key.
   */
  publicKeyType?: NoxyIdentityCryptoKeyType;
  /**
   * Signer function of the identity.
   */
  signer: (data: Uint8Array) => Promise<Signature>;
};

export type NoxyWalletIdentity = NoxyEoaWalletIdentity | NoxyScwWalletIdentity;

/**
 * Union of all identity types Noxy can work with.
 */
export type NoxyIdentity =
  | NoxyEoaWalletIdentity
  | NoxyScwWalletIdentity;
