import type { NoxyClientOptions } from '@/modules/noxy-client.types';
import { NoxyClientModule } from '@/modules/noxy-client';
import { NoxyClientOptionsSchema } from '@/modules/noxy-client.schema';
import type { NoAny } from '@/modules/noxy-common.types';
import { NoxyInitializationError } from '@/modules/noxy-error';

export type { NoxyClientOptions } from '@/modules/noxy-client.types';
export type { NoxyIdentity, NoxyEoaWalletIdentity, NoxyScwWalletIdentity } from '@/modules/noxy-identity.types';
export { NoxyIdentityTypeEnum } from '@/modules/noxy-identity.types';
export { NoxyClientOptionsSchema, NoxyNetworkOptionsSchema, NoxyStorageOptionsSchema } from '@/modules/noxy-client.schema';

/**
 * Create and initialize a Noxy client instance
 *
 * @param options - Client configuration options (validated against schema)
 * @returns Initialized NoxyClientModule instance
 * @throws {Error} If options validation fails
 *
 * @example
 * ```typescript
 * const client = await createNoxyClient({
 *   identity: {
 *     type: 'eoa',
 *     address: '0x...',
 *     publicKey: '0x...',
 *     publicKeyType: 'secp256k1',
 *     signer: async (data) => wallet.signMessage({ message: { raw: data } })
 *   },
 *   network: {
 *     relayNodesUrl: 'wss://relay.noxy.network',
 *     appId: 'your-app-id'
 *   }
 * });
 * ```
 */
export async function createNoxyClient(options: NoAny<NoxyClientOptions>) {
  const result = NoxyClientOptionsSchema.safeParse(options);

  if (!result.success) {
    // Format validation errors for better readability
    const errorMessages = result.error?.issues?.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');

    throw new NoxyInitializationError({ message: `Invalid Noxy client options: ${errorMessages}` });
  }

  return await NoxyClientModule.init(result.data as NoxyClientOptions);
}