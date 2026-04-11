# @noxy-network/browser-sdk

Browser SDK to integrate with the [Noxy](https://noxy.network) **Decision Layer**: subscribe to encrypted decision requests, present them to the user, and respond with decision — all with wallet-based identity.

**Before you integrate:** Create your app at [noxy.network](https://noxy.network). When the app is created, you receive an **app id** and an **app token** (auth token). This browser SDK uses the **app id** in `network.appId`. The **app token** is for agent/orchestrator SDKs (Go, Rust, Python, Node, etc.), not for this package.

---

## Table of Contents

- [What it does](#what-it-does)
- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Usage guide](#usage-guide)
- [Error handling](#error-handling)
- [Pre-validation](#pre-validation)
- [Exports](#exports)
- [Security](#security)
- [License](#license)

---

## What it does

1. **Identity** — Bind the device to a wallet (EOA or smart contract wallet).
2. **Decisions** — Receive end-to-end encrypted payloads from the relay; decrypt locally.
3. **Outcomes** — After the user chooses, send a **DecisionOutcome** to the relay (same shape as the gRPC message, as JSON on the WebSocket).

---

## Features

- **Decision Layer integration** — `on()` delivers decrypted requests to your UI; you send `APPROVE` / `REJECT` with `submitDecisionOutcome` when ready
- **Wallet-based identity** — EOA and SCW; no email or phone
- **End-to-end encryption** — Kyber (post-quantum) + AES-GCM for payloads
- **Relay** — Single WebSocket URL; encrypted delivery to the browser
- **Encrypted local storage** — IndexedDB + AES-GCM; SDK can generate and persist the storage key

---

## Installation

```bash
npm install @noxy-network/browser-sdk
```

### Requirements

- **IndexedDB**, **WebSocket**, and **Web Crypto API**
- **ES modules** (or a bundler)
- TypeScript types: `dist/bundle.d.ts`

---

## Quick start

```ts
import { createNoxyClient, NoxyDecisionOutcomeValues } from "@noxy-network/browser-sdk";

const noxy = await createNoxyClient({
  identity: {
    type: "scw",
    address: "0xabc...",
    signer: async (data) => wallet.signMessage({ message: { raw: data } }),
  },
  network: {
    relayNodesUrl: "wss://relay.noxy.network",
    appId: "your-app-id",
  },
});

await noxy.on(async (decisionId, decision) => {
  // Show UI; when the user decides, call submitDecisionOutcome (relay handles idempotency)
  const approved = await showConfirmDialog(decision);
  await noxy.submitDecisionOutcome({
    decisionId,
    outcome: approved ? NoxyDecisionOutcomeValues.APPROVE : NoxyDecisionOutcomeValues.REJECT,
    receivedAt: Date.now(),
  });
});

```

---

## Configuration

```ts
createNoxyClient({
  identity: {
    type: "eoa", // or "scw"
    address: "0x...",
    signer: async (data) => ...,
    chainId: "...",
    publicKey: "...",
    publicKeyType: "secp256k1",
  },
  network: {
    relayNodesUrl: "wss://relay.noxy.network",
    appId: "your-app-id",
    maxRetries: 3,
    retryTimeoutMs: 5000,
  },
  storage: {
    encryptionKey: new Uint8Array(32),
    indexedDb: { dbName: "noxy-db", dbVersion: 1 },
  },
});
```

---

## API reference

### `createNoxyClient(options)`

Initializes identity → device → relay connection. Throws `NoxyInitializationError` on invalid options or failure.

### Client

| Member | Description |
|--------|-------------|
| `options` | Configuration used to create the client |
| `address` | Wallet address from identity |
| `isDeviceActive` | `false` if device revoked |
| `isRelayConnected` | WebSocket open |
| `isNetworkReady` | Authenticated and ready |
| `on(handler)` | Decrypt decision → invoke handler (show UI); does not send an outcome by itself |
| `submitDecisionOutcome(payload)` | Send `APPROVE` \| `REJECT` DecisionOutcome to the relay |
| `revokeDevice()` | Revoke device (wallet signature) |
| `rotateKeys()` | Rotate device keys on relay |
| `close()` | Disconnect |

---

## Usage guide

**Default storage** — Omit `storage` to use IndexedDB `noxy-client-db`, version `1`, and an SDK-generated encryption key persisted in IndexedDB.

**Custom encryption key** — Pass `encryptionKey` (16/24/32 bytes) when you derive material from user input.

**SCW** — Use `identity.type: "scw"` and your SCW signing logic.

---

## Error handling

Initialization errors include `message`, `code`, optional `stage` (`init_identity` | `load_device` | `connect_network`), and optional `cause`. Network and device methods may throw; wrap in `try/catch` as needed.

---

## Pre-validation

```ts
import { createNoxyClient, NoxyClientOptionsSchema } from "@noxy-network/browser-sdk";

const result = NoxyClientOptionsSchema.safeParse(userInput);
if (!result.success) return;
await createNoxyClient(result.data);
```

---

## Exports

| Export | Description |
|--------|-------------|
| `createNoxyClient` | Create client |
| `NoxyClientOptions`, identity types | Types |
| `NoxyIdentityTypeEnum` | `"eoa"` / `"scw"` |
| `NoxyDecisionOutcome`, `NoxyDecisionOutcomeValue` | Decision outcome types |
| `NoxyDecisionOutcomeValues` | `APPROVE` / `REJECT` constants |
| `NoxyClientOptionsSchema`, etc. | Zod schemas |

---

## Security

- **Device registration** — One-time wallet signature binds the device to the identity.
- **Payload encryption** — Kyber KEM, HKDF, AES-GCM; relay sees ciphertext only.
- **Identity keys** — Not used to encrypt decision payloads; device and post-quantum keys are.

---

## License

MIT © Noxy Network
