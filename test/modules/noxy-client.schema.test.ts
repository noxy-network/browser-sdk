import { describe, it, expect, beforeAll } from 'vitest';
import { NoxyClientOptionsSchema, NoxyIdentitySchema, NoxyNetworkOptionsSchema } from '@/modules/noxy-client.schema';
import { NoxyIdentityTypeEnum } from '@/modules/noxy-identity.types';
import { createNoxyClient } from '@/index';
import initMocks from '@test/__mocks__';

describe('NoxyClientOptionsSchema', () => {
  let mocks: Record<string, any>;

  beforeAll(async () => {
    mocks = await initMocks();
  });

  describe('NoxyIdentitySchema', () => {
    it('should validate EOA wallet identity with public key', () => {
      const identity = {
        type: NoxyIdentityTypeEnum.EOA,
        address: '0x1234567890123456789012345678901234567890',
        publicKey: '0xabcdef',
        publicKeyType: 'secp256k1' as const,
        signer: async (data: Uint8Array) => new Uint8Array(64),
      };

      const result = NoxyIdentitySchema.safeParse(identity);
      expect(result.success).toBe(true);
    });

    it('should validate EOA wallet identity without public key', () => {
      const identity = {
        type: NoxyIdentityTypeEnum.EOA,
        address: '0x1234567890123456789012345678901234567890',
        signer: async (data: Uint8Array) => new Uint8Array(64),
      };

      const result = NoxyIdentitySchema.safeParse(identity);
      expect(result.success).toBe(true);
    });

    it('should validate SCW wallet identity with public key', () => {
      const result = NoxyIdentitySchema.safeParse(mocks.testScwIdentity);
      expect(result.success).toBe(true);
    });

    it('should validate SCW wallet identity without public key', () => {
      const identity = {
        type: NoxyIdentityTypeEnum.SCW,
        address: '0x1234567890123456789012345678901234567890',
        chainId: '1',
        signer: async (data: Uint8Array) => new Uint8Array(64),
      };

      const result = NoxyIdentitySchema.safeParse(identity);
      expect(result.success).toBe(true);
    });

    it('should reject DID identity (schema only supports EOA and SCW)', () => {
      const identity = {
        type: 'DID' as const,
        did: 'did:ethr:0x1234567890123456789012345678901234567890',
        signer: async (data: Uint8Array) => new Uint8Array(64),
      };

      const result = NoxyIdentitySchema.safeParse(identity);
      expect(result.success).toBe(false);
    });

    it('should reject invalid Ethereum address', () => {
      const identity = {
        type: NoxyIdentityTypeEnum.EOA,
        address: 'invalid-address',
        signer: async (data: Uint8Array) => new Uint8Array(64),
      };

      const result = NoxyIdentitySchema.safeParse(identity);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/address|Ethereum/i);
      }
    });

    it('should reject identity without signer', () => {
      const identity = {
        type: NoxyIdentityTypeEnum.EOA,
        address: '0x1234567890123456789012345678901234567890',
      };

      const result = NoxyIdentitySchema.safeParse(identity);
      expect(result.success).toBe(false);
    });
  });

  describe('NoxyNetworkOptionsSchema', () => {
    it('should validate network options', () => {
      const network = {
        relayNodesUrl: 'wss://relay.noxy.network',
        appId: 'test-project-id',
      };

      const result = NoxyNetworkOptionsSchema.safeParse(network);
      expect(result.success).toBe(true);
    });

    it('should reject invalid relay URL', () => {
      const network = {
        relayNodesUrl: 'not-a-url',
        appId: 'test-project-id',
      };

      const result = NoxyNetworkOptionsSchema.safeParse(network);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/url|URL|Relay/i);
      }
    });

    it('should reject missing appId', () => {
      const network = {
        relayNodesUrl: 'wss://relay.noxy.network',
        appId: '',
      };

      const result = NoxyNetworkOptionsSchema.safeParse(network);
      expect(result.success).toBe(false);
    });
  });

  describe('NoxyClientOptionsSchema', () => {
    it('should validate complete client options', () => {
      const options = {
        identity: {
          type: NoxyIdentityTypeEnum.EOA,
          address: '0x1234567890123456789012345678901234567890',
          publicKey: '0xabcdef',
          publicKeyType: 'secp256k1' as const,
          signer: async (data: Uint8Array) => new Uint8Array(64),
        },
        network: {
          relayNodesUrl: 'wss://relay.noxy.network',
          appId: 'test-project',
        },
        storage: {
          indexedDb: {
            dbName: 'test-db',
            dbVersion: 1,
          },
        },
      };

      const result = NoxyClientOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });

    it('should reject invalid encryption key size', () => {
      const options = {
        identity: {
          type: NoxyIdentityTypeEnum.EOA,
          address: '0x1234567890123456789012345678901234567890',
          signer: async (data: Uint8Array) => new Uint8Array(64),
        },
        network: {
          relayNodesUrl: 'wss://relay.noxy.network',
          appId: 'test-project',
        },
        storage: {
          encryptionKey: new Uint8Array(10), // Invalid size
        },
      };

      const result = NoxyClientOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('16, 24, or 32 bytes');
      }
    });
  });

  describe('createNoxyClient error handling', () => {
    it('should throw formatted error for invalid options', async () => {
      const invalidOptions = {
        identity: {
          type: NoxyIdentityTypeEnum.EOA,
          address: 'invalid-address',
          signer: async (data: Uint8Array) => new Uint8Array(64),
        },
        network: {
          relayNodesUrl: '',
          appId: '',
        },
      } as any;

      await expect(createNoxyClient(invalidOptions)).rejects.toThrow('Invalid Noxy client options');
    });

    it('should include specific validation errors in message', async () => {
      const invalidOptions = {
        identity: {
          type: NoxyIdentityTypeEnum.EOA,
          address: 'not-an-address',
          signer: async (data: Uint8Array) => new Uint8Array(64),
        },
        network: {
          relayNodesUrl: 'wss://relay.noxy.network',
          appId: 'test',
        },
      } as any;

      try {
        await createNoxyClient(invalidOptions);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('identity');
        expect((error as Error).message).toContain('address');
      }
    });
  });
});

