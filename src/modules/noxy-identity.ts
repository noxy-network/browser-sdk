import { verifyMessage as viemVerifySignedMessage } from 'viem';
import { randomBytes } from '@noble/hashes/utils.js';
import type { NoxyWalletIdentity, NoxyIdentity, NoxyIdentityType, NoxyIdentityCryptoKeyType, WalletAddress } from '@/modules/noxy-identity.types';
import type { Signature, Hash, NoAny } from '@/modules/noxy-common.types';
import { NoxyIdentityError } from '@/modules/noxy-error';

export class NoxyIdentityModule {
  #identity: NoxyIdentity;

  private static instance: Promise<NoxyIdentityModule> | undefined = undefined;

  private constructor(identity: NoxyIdentity) {
    this.#identity = identity;
  }

  /**
   * Create and validate a new NoxyIdentityModule instance
   * Validates that the public key belongs to the signer if both are provided
   *
   * @param identity - A valid NoxyIdentity object (cannot be `any`)
   */
  /** Reset singleton (for tests). */
  static reset(): void {
    NoxyIdentityModule.instance = undefined;
  }

  static async create(
    identity: NoAny<NoxyIdentity>
  ): Promise<NoxyIdentityModule> {
    if (NoxyIdentityModule.instance !== undefined) return NoxyIdentityModule.instance;
    NoxyIdentityModule.instance = (async () => {
      await NoxyIdentityModule.validateSignerFunction(identity);
      return new NoxyIdentityModule(identity);
    })();
    return NoxyIdentityModule.instance;
  }

  /**
   * Validate that the provided signer function is valid.
   */
  private static async validateSignerFunction(identity: NoxyIdentity): Promise<void> {
    const hasSigner = identity.signer !== undefined && typeof identity.signer === 'function';

    if (!hasSigner) {
      throw new NoxyIdentityError({ message: 'Signer function is required' });
    }

    const address = identity.address;
    if (!address) {
      throw new NoxyIdentityError({ message: 'Wallet address is required for signer validation' });
    }

    try {
      const payload = randomBytes(32);
      const signature = await identity.signer!(payload);

      if (!signature) {
        throw new NoxyIdentityError({ message: 'Signer function is not working correctly / returns undefined' });
      }

      const isValid = await NoxyIdentityModule.verifySignedMessage(address, signature, payload);
      if (!isValid) {
        throw new NoxyIdentityError({ message: 'Signer validation failed: the signature does not match the wallet address' });
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new NoxyIdentityError({ message: `Signer validation failed: ${error.message}` });
      }
      throw new NoxyIdentityError({ message: 'Signer validation failed' });
    }
  }

 /**
  * Verify a signed message by the identity
  */
  private static async verifySignedMessage(address: WalletAddress, signature: Signature, payload: Uint8Array): Promise<boolean> {
    try {
      return await viemVerifySignedMessage({
        address,
        message: { raw: payload },
        signature: signature as Hash,
      });
    } catch (_err: unknown) {
      return false;
    }
  }

  /**
   * Get the identity data
   */
  get identity(): NoxyIdentity {
    return this.#identity;
  }

  /**
   * Get the identity type
   */
  get type(): NoxyIdentityType {
    return this.#identity.type;
  }

  /**
   * Get the identity address
   */
  get address(): WalletAddress {
    return (this.#identity as NoxyWalletIdentity).address;
  }

  /**
   * Get the identity address encoded
   */
  get addressEncoded(): Uint8Array {
    return new TextEncoder().encode(this.address);
  }

  /**
   * Get the identity public key
   */
  get publicKey(): Uint8Array | undefined {
    const publicKey = (this.#identity as NoxyWalletIdentity).publicKey;
    if (!publicKey) return undefined;
    return publicKey instanceof Uint8Array
      ? publicKey
      : new TextEncoder().encode(publicKey as string);
  }

  /**
   * Get the identity publickey type
   */
  get keyType(): NoxyIdentityCryptoKeyType | undefined {
    return (this.#identity as NoxyWalletIdentity).publicKeyType;
  }

  /**
   * Check if the identity has a public key
   */
  hasPublicKey(): boolean {
    return this.publicKey !== undefined;
  }

  /**
   * Check if the identity has a sign function
   */
  canSign(): boolean {
    return this.#identity.signer !== undefined && typeof this.#identity.signer === 'function';
  }

  /**
   * Sign data using the identity signer
   */
  async sign(data: Uint8Array): Promise<Signature | undefined> {
    if (!this.canSign()) return undefined;
    try {
      return await this.#identity.signer!(data);
    } catch (_err: unknown) {
      return undefined;
    }
  }

  /**
   * Verify a payload was signed by the identity
   */
  async verify(signature: Signature, payload: Uint8Array): Promise<boolean> {
    try {
      return await NoxyIdentityModule.verifySignedMessage(
        this.address,
        signature,
        payload
      );
    } catch (_err: unknown) {
      return false;
    }
  }
}