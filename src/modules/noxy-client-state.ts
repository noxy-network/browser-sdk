import { createStore } from 'zustand/vanilla';
import { NoxyClientStatusEnum } from '@/modules/noxy-client-state.types';
import type { NoxyClientStatus, NoxyClientState } from '@/modules/noxy-client-state.types';
import type { NoxyWalletIdentity, NoxyIdentity, WalletAddress } from '@/modules/noxy-identity.types';
import type { NoxyDevice } from '@/modules/noxy-device.types';
import { NoxyIdentityModule } from '@/modules/noxy-identity';
import { NoxyDeviceModule } from '@/modules/noxy-device';
import { NoxyNetworkModule } from '@/modules/noxy-network';
import { NoxyGeneralError } from '@/modules/noxy-error';

export const useNoxyClientStateMachine = createStore<NoxyClientState>()((set, get) => ({
  status: NoxyClientStatusEnum.IDLE,
  network: { ready: false },

  setStatus: (status: NoxyClientStatus) => set({ status }),

  initIdentity(identityModule: NoxyIdentityModule) {
    const identity: NoxyIdentity = identityModule.identity;
    set({ status: NoxyClientStatusEnum.IDENTITY_READY, identity });
  },

  async loadOrCreateDevice(deviceModule: NoxyDeviceModule, appId: string) {
    const { identity } = get();
    if (!identity) {
      set({ status: NoxyClientStatusEnum.ERROR, error: { code: 'IDENTITY_NOT_INITIALIZED', message: 'Identity is not initialized', stage: 'load_device' } });
      return;
    }

    try {
      const identityId: WalletAddress = (identity as NoxyWalletIdentity).address;
      const device: NoxyDevice = await deviceModule.load(identityId, appId)
        ?? await deviceModule.register(appId, identityId, identity.signer);

      set({ status: NoxyClientStatusEnum.DEVICE_READY, device });
    } catch (err: unknown) {
      set({ status: NoxyClientStatusEnum.ERROR, error: { code: 'DEVICE_LOAD_ERROR', message: 'Failed to load or create device', stage: 'load_device', cause: (err as NoxyGeneralError)?.message } });
      return;
    }
  },

  async connectNetwork(networkModule: NoxyNetworkModule) {
    const { device } = get();
    if (!device) {
      set({ status: NoxyClientStatusEnum.ERROR, error: { code: 'DEVICE_NOT_INITIALIZED', message: 'Device was not initialized', stage: 'connect_network' } });
      return;
    }

    try {
      await networkModule.connect();
      await networkModule.authenticateDevice(device);
      if (!networkModule.isReady) {
        set({ status: NoxyClientStatusEnum.ERROR, network: { ready: false }, error: { code: 'NETWORK_NOT_READY', message: 'Network is not ready', stage: 'connect_network' } });
        return;
      }
      set({ status: NoxyClientStatusEnum.NETWORK_READY, network: { ready: true } });
    } catch (err: unknown) {
      set({ status: NoxyClientStatusEnum.ERROR, network: { ready: false }, error: { code: 'NETWORK_CONNECT_ERROR', message: 'Failed to connect to network', stage: 'connect_network', cause: (err as NoxyGeneralError)?.message } });
      return;
    }
  },

  reset() {
    set({
      status: NoxyClientStatusEnum.IDLE,
      identity: undefined,
      device: undefined,
      network: { ready: false },
    });
  },
}));