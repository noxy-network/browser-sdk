import { base64 } from '@scure/base';
import { type UUIDTypes } from 'uuid';
import { NoxyInjectModule } from '@/modules/noxy-common.inject';
import type { NoxyClientOptions } from '@/modules/noxy-client.types';
import { NoxyIdentityModule } from '@/modules/noxy-identity';
import { NoxyDeviceModule } from '@/modules/noxy-device';
import type { WalletAddress } from '@/modules/noxy-identity.types';
import { useNoxyClientStateMachine } from '@/modules/noxy-client-state';
import { NoxyNetworkModule } from '@/modules/noxy-network';
import { NoxyClientStatusEnum } from '@/modules/noxy-client-state.types';
import { NoxyGeneralError, NoxyInitializationError } from '@/modules/noxy-error';
import { NoxyDecisionRequestModule } from '@/modules/noxy-decision-request';
import type { NoxyDecisionOutcome } from '@/modules/noxy-decision-request.types';
import type { NoAny } from '@/modules/noxy-common.types';

@NoxyInjectModule(NoxyDecisionRequestModule, (options: NoxyClientOptions) => options.storage)
@NoxyInjectModule(NoxyNetworkModule, (options: NoxyClientOptions) => options.network)
@NoxyInjectModule(NoxyDeviceModule, (options: NoxyClientOptions) => options.storage)
@NoxyInjectModule(NoxyIdentityModule, (options: NoxyClientOptions) => options.identity)
export class NoxyClientModule {
  readonly #options: NoxyClientOptions;

  private constructor(options: NoxyClientOptions) {
    this.#options = options;
  }

  static async init(options: NoAny<NoxyClientOptions>): Promise<NoxyClientModule> {
    useNoxyClientStateMachine.getState().reset();
    const client = new NoxyClientModule(options);
    await (client as any).__initAllModules;

    const clientReady = new Promise<void>((resolve, reject) => {
      const run = async (state: ReturnType<typeof useNoxyClientStateMachine.getState>) => {
        try {
          switch (state.status) {
            case NoxyClientStatusEnum.IDLE:
              state.initIdentity(client.#noxyIdentityModule);
              break;
            case NoxyClientStatusEnum.IDENTITY_READY:
              await state.loadOrCreateDevice(client.#noxyDeviceModule, client.#options.network.appId);
              break;
            case NoxyClientStatusEnum.DEVICE_READY:
              await state.connectNetwork(client.#noxyNetworkModule);
              break;
            case NoxyClientStatusEnum.NETWORK_READY:
              unsubscribe();
              resolve();
              break;
            case NoxyClientStatusEnum.ERROR:
              unsubscribe();
              reject(new NoxyInitializationError(state.error));
              break;
            default:
              break;
          }
        } catch (error) {
          unsubscribe();
          reject(new NoxyInitializationError({ message: (error as Error).message }));
        }
      };
      const unsubscribe = useNoxyClientStateMachine.subscribe((state) => {
        void run(state);
      });
      void run(useNoxyClientStateMachine.getState());
    });

    await clientReady;
    return client;
  }

  get #noxyIdentityModule(): NoxyIdentityModule {
    return (this as any).NoxyIdentityModule as NoxyIdentityModule;
  }

  get #noxyDeviceModule(): NoxyDeviceModule {
    return (this as any).NoxyDeviceModule as NoxyDeviceModule;
  }

  get #noxyNetworkModule(): NoxyNetworkModule {
    return (this as any).NoxyNetworkModule as NoxyNetworkModule;
  }

  get #noxyDecisionRequestModule(): NoxyDecisionRequestModule {
    return (this as any).NoxyDecisionRequestModule as NoxyDecisionRequestModule;
  }

  get options(): NoxyClientOptions {
    return this.#options;
  }

  get address(): WalletAddress {
    return this.#noxyIdentityModule.address;
  }

  get isDeviceActive(): boolean {
    return this.#noxyDeviceModule.isRevoked === false;
  }

  get isRelayConnected(): boolean {
    return this.#noxyNetworkModule.isConnected;
  }

  get isNetworkReady(): boolean {
    return this.#noxyNetworkModule.isReady;
  }

  async revokeDevice(): Promise<void> {
    try {
      const deviceSignature = await this.#noxyDeviceModule.getDeviceSignature();
      if (!deviceSignature) {
        throw new NoxyGeneralError({ message: 'Unable to revoke device' });
      }
      await this.#noxyDeviceModule.revoke();
      await this.#noxyNetworkModule.revokeDevice({ walletAddress: this.address, signature: base64.encode(deviceSignature) });
    } catch (error) {
      throw new NoxyGeneralError({ message: (error as Error).message });
    }
  }

  async rotateKeys(): Promise<void> {
    try {
      const deviceSignature = await this.#noxyDeviceModule.getDeviceSignature();
      if (!deviceSignature) {
        throw new NoxyGeneralError({ message: 'Unable to rotate device keys' });
      }
      await this.#noxyDeviceModule.rotateKeys();

      const newPublicKey = this.#noxyDeviceModule.publicKey;
      const newPqPublicKey = this.#noxyDeviceModule.pqPublicKey;

      if (!newPublicKey || !newPqPublicKey) {
        throw new NoxyGeneralError({ message: 'Unable to rotate device keys' });
      }

      const newPubkeys = {
        publicKey: base64.encode(newPublicKey as Uint8Array),
        pqPublicKey: base64.encode(newPqPublicKey as Uint8Array),
      };
      await this.#noxyNetworkModule.rotateDeviceKeys({ walletAddress: this.address, signature: base64.encode(deviceSignature), newPubkeys });
    } catch (error) {
      throw new NoxyGeneralError({ message: (error as Error).message });
    }
  }

  /**
   * Subscribe to encrypted decision requests: decrypt and invoke the handler (e.g. show UI).
   * Send the outcome later with {@link submitDecisionOutcome}; the relay enforces idempotency.
   */
  async on(handler: (decisionId: UUIDTypes, decision: unknown) => void | Promise<void>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    await self.#noxyDeviceModule.loadDevicePrivateKeys();
    await this.#noxyNetworkModule.subscribeToDecisionRequests(async ({ messageId, decisionEvent }) => {
      if (!messageId) return;
      const decrypted = await self.#noxyDecisionRequestModule.decryptDecisionRequest(decisionEvent);
      if (!decrypted) return;
      await handler(messageId, decrypted);
    });
  }

  /** Send APPROVE/REJECT for a decision to the relay (call when the user decides). */
  async submitDecisionOutcome(payload: NoxyDecisionOutcome): Promise<void> {
    await this.#noxyNetworkModule.sendDecisionOutcome(payload);
  }

  async close(): Promise<void> {
    await this.#noxyNetworkModule.disconnect();
  }
}