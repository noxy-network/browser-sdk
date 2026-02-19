import type { NoxyIdentity } from '@/modules/noxy-identity.types';
import type { NoxyNetworkOptions } from '@/modules/noxy-network.types';
import type { NoxyStorageOptions } from '@/modules/noxy-storage.types';

export type NoxyClientOptions = {
  identity: NoxyIdentity;
  network: NoxyNetworkOptions;
  storage?: NoxyStorageOptions;
};