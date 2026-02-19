import type { NoxyIdentity } from '@/modules/noxy-identity.types';
import type { NoxyDevice } from '@/modules/noxy-device.types';
import type { NoxyIdentityModule } from '@/modules/noxy-identity';
import type { NoxyDeviceModule } from '@/modules/noxy-device';
import type { NoxyNetworkModule } from '@/modules/noxy-network';

export enum NoxyClientStatusEnum {
  IDLE = 'idle',
  IDENTITY_READY = 'identity-ready',
  DEVICE_READY = 'device-ready',
  NETWORK_READY = 'network-ready',
  READY = 'ready',
  ERROR = 'error',
}
export type NoxyClientStatus = `${NoxyClientStatusEnum}`;

export interface NoxyClientState {
  // state
  status: NoxyClientStatus;

  identity?: NoxyIdentity;
  device?: NoxyDevice;

  network: {
    ready: boolean;
  };

  error?: {
    code: string;
    message: string;
    stage: 'init_identity' | 'load_device'  | 'connect_network';
    cause?: string;
  };

  // actions
  setStatus: (status: NoxyClientStatus) => void;
  initIdentity: (identityModule: NoxyIdentityModule) => void;
  loadOrCreateDevice: (deviceModule: NoxyDeviceModule, appId: string) => Promise<void>;
  connectNetwork: (networkModule: NoxyNetworkModule) => Promise<void>;
  reset: () => void;
}