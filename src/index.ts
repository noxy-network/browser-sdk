import type { NoxyClientOptions } from '@/modules/noxy-client.types';
import { NoxyClientModule } from '@/modules/noxy-client';
import { NoxyClientOptionsSchema } from '@/modules/noxy-client.schema';
import type { NoAny } from '@/modules/noxy-common.types';
import { NoxyInitializationError } from '@/modules/noxy-error';

export type { NoxyClientOptions } from '@/modules/noxy-client.types';
export type { NoxyIdentity, NoxyEoaWalletIdentity, NoxyScwWalletIdentity } from '@/modules/noxy-identity.types';
export { NoxyIdentityTypeEnum } from '@/modules/noxy-identity.types';
export { NoxyClientOptionsSchema, NoxyNetworkOptionsSchema, NoxyStorageOptionsSchema } from '@/modules/noxy-client.schema';
export type { NoxyDecisionOutcome, NoxyDecisionOutcomeValue } from '@/modules/noxy-decision-request.types';
export { NoxyDecisionOutcomeValues } from '@/modules/noxy-decision-request.types';

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