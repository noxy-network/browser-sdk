import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NoxyIdentityModule } from '@/modules/noxy-identity';
import { NoxyIdentityTypeEnum } from '@/modules/noxy-identity.types';
import type { NoxyIdentity } from '@/modules/noxy-identity.types';
import initMocks from '@test/__mocks__';
import 'fake-indexeddb/auto';

describe('NoxyIdentityModule', () => {
  let mocks: Record<string, any>;
  let identities: Array<{ name: string; identity: NoxyIdentity; expectedType: NoxyIdentityTypeEnum; getExpectedAddress: () => string; getExpectedKeyType: () => string }>;

  beforeAll(async () => {
    mocks = await initMocks();

    identities = [
      {
        name: 'EOA',
        identity: mocks.testIdentity,
        expectedType: NoxyIdentityTypeEnum.EOA,
        getExpectedAddress: () => mocks.testIdentity.address,
        getExpectedKeyType: () => mocks.testIdentity.keyType,
      },
      {
        name: 'SCW',
        identity: mocks.testScwIdentity,
        expectedType: NoxyIdentityTypeEnum.SCW,
        getExpectedAddress: () => mocks.testScwIdentity.address,
        getExpectedKeyType: () => mocks.testScwIdentity.keyType,
      },
    ];
  });

  beforeEach(() => {
    NoxyIdentityModule.reset();
  });

  describe('initialize an identity', () => {
    it('should test all identity types', async () => {
      for (const testCase of identities) {
        NoxyIdentityModule.reset();
        const identityModule = await NoxyIdentityModule.create(testCase.identity);
        expect(identityModule).toBeDefined();
        expect(identityModule.identity).toBeDefined();
        expect(identityModule.type).toBe(testCase.expectedType);
        expect(identityModule.address).toBe(testCase.getExpectedAddress());
        expect(identityModule.keyType).toBe(testCase.getExpectedKeyType());
      }
    });

    it('should be able to sign and verify data for all identity types', async () => {
      for (const testCase of identities) {
        NoxyIdentityModule.reset();
        const identityModule = await NoxyIdentityModule.create(testCase.identity);
        expect(identityModule.canSign()).toBe(true);

        const payload = new TextEncoder().encode('test payload');
        const signature = await identityModule.sign(payload);
        expect(signature).toBeDefined();

        const isVerified = await identityModule.verify(signature as Uint8Array, payload);
        expect(isVerified).toBe(true);
      }
    });
  });
});
