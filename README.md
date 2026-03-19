# 📦 @noxy-network/browser-sdk

Noxy is a decentralized push notification network for Web3 apps. This browser SDK lets your app receive end-to-end encrypted notifications on users' devices using **wallet-based identity** — no emails or phone numbers.

Users register a device once with a wallet signature. After that, they receive reliable real-time or store-and-forward notifications in the browser — **without centralized user accounts**.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Usage Guide](#usage-guide)
- [Error Handling](#error-handling)
- [Pre-validation](#pre-validation)
- [Exports](#exports)
- [Security](#security)
- [License](#license)

---

## Features

- **Wallet-based identity** — EOA and Smart Contract Wallets; no email or phone
- **End-to-end encrypted notifications** — Kyber (post-quantum) + AES-GCM
- **One-time device registration** — Sign with wallet; device keys generated and stored securely
- **Relay-based delivery** — Single relay URL; real-time or store-and-forward notification delivery to the client
- **Browser** — IndexedDB for persistence, WebSocket for real-time delivery
- **Encrypted local storage** — IndexedDB with AES-GCM; SDK auto-generates and persists the key when not provided

---

## 🚀 Installation

```bash
npm install @noxy-network/browser-sdk
# or
yarn add @noxy-network/browser-sdk
# or
pnpm add @noxy-network/browser-sdk
```

### Requirements

- Modern browser with **IndexedDB**, **WebSocket**, and **Web Crypto API**
- **ES modules** support (or bundler that transpiles to your target)
- **TypeScript** types are included (`dist/index.d.ts`)

---

## 🛠 Quick Start

```ts
import { createNoxyClient } from "@noxy-network/browser-sdk";

const noxy = await createNoxyClient({
  identity: {
    type: "eoa",
    address: "0xabc...",
    signer: async (data) => wallet.signMessage({ message: { raw: data } }),
  },
  network: {
    relayNodesUrl: "wss://relay.noxy.network",
    appId: "your-app-id",
  },
  storage: {
    indexedDb: { dbName: "noxy-db", dbVersion: 1 },
  },
});

// Receive notifications
await noxy.on((notification) => {
  console.log("Notification:", notification);
});

// When done
await noxy.close();
```

---

## Configuration

Options passed to `createNoxyClient`:

```ts
createNoxyClient({
  identity: {                    // required
    type: "eoa",                 // required — "eoa" | "scw"
    address: "0x...",            // required — EVM address (0x + 40 hex chars)
    signer: async (data) => ..., // required — (data: Uint8Array) => Promise<Uint8Array | string>
    chainId: "...",              // optional — chain identifier
    publicKey: "...",            // optional — Uint8Array or hex string
    publicKeyType: "secp256k1",  // optional — "ed25519" | "ed448" | "sr25519" | "secp256k1" | "secp256k1-schnorr"
  },
  network: {                     // required
    relayNodesUrl: "wss://...",  // required — WebSocket relay URL
    appId: "your-app-id",        // required — Noxy app identifier
    maxRetries: 3,               // optional — max connection retry attempts
    retryTimeoutMs: 5000,        // optional — retry timeout in ms
    requireAck: true,            // optional — require acknowledgement for notifications
  },
  storage: {                     // optional — omit to use defaults (see Usage Guide)
    encryptionKey: new Uint8Array(32),  // optional — 16/24/32 bytes; omit to have SDK generate and persist one
    indexedDb: {
      dbName: "noxy-db",         // optional — IndexedDB database name
      dbVersion: 1,              // optional — schema version
    },
  },
});
```

### Identity types

| `type`  | Use case                                      |
|---------|-----------------------------------------------|
| `"eoa"` | Externally Owned Account (MetaMask, etc.)     |
| `"scw"` | Smart Contract Wallet (Safe, Argent, etc.)     |

The `signer` function must accept raw bytes and return the signature (hex string or `Uint8Array`). Example with viem/ethers:

```ts
// viem (wallet client)
signer: (data) => wallet.signMessage({ message: { raw: data } })

// ethers v6
signer: (data) => signer.signMessage(data)
```

---

## API Reference

### `createNoxyClient(options)`

Creates and initializes a Noxy client. Validates options and performs:

1. **Identity** — Load wallet identity
2. **Device** — Load existing or register new device (wallet signature, device keys)
3. **Network** — Connect to relay and authenticate

**Parameters:** `options: NoxyClientOptions`

**Returns:** `Promise<NoxyClient>` — Resolves when the client is connected and ready.

**Throws:** `NoxyInitializationError` when options are invalid or initialization fails.

---

### Client instance (returned by `createNoxyClient`)

| Property / Method        | Type                            | Description                                              |
|--------------------------|---------------------------------|----------------------------------------------------------|
| `options`                | `NoxyClientOptions`             | Read-only copy of the configuration used to create the client |
| `address`                | `string`                        | Wallet address (`0x...`) from the identity               |
| `isDeviceActive`         | `boolean`                       | `false` if the device has been revoked                   |
| `isRelayConnected`      | `boolean`                       | `true` when WebSocket is connected                       |
| `isNetworkReady`         | `boolean`                       | `true` when authenticated and ready for notifications   |
| `on(handler)`            | `(handler) => Promise<void>`    | Subscribe to incoming notifications                      |
| `revokeDevice()`         | `() => Promise<void>`           | Revoke the current device                                |
| `rotateKeys()`           | `() => Promise<void>`           | Rotate device keys and notify the relay                  |
| `close()`                | `() => Promise<void>`           | Disconnect from the relay                                |

#### `on(handler)`

Subscribe to decrypted notifications. The handler receives the plain JSON payload.

```ts
await noxy.on((notification: unknown) => {
  // notification is the decrypted object, e.g. { type, title, message, timestamp, ... }
});
```

#### `revokeDevice()`

Revokes the current device. The device can no longer receive notifications. Requires wallet signature.

```ts
await noxy.revokeDevice();
```

#### `rotateKeys()`

Rotates device encryption keys and updates the relay. Use after a suspected compromise or as part of key rotation policy.

```ts
await noxy.rotateKeys();
```

#### `close()`

Disconnects from the relay. Call when the user logs out or the app unmounts.

```ts
await noxy.close();
```

---

## Usage Guide

### Minimal setup (storage omitted)

When `storage` is omitted, the SDK uses **defaults**:

- **IndexedDB** db name: `noxy-client-db`
- **IndexedDB** db version: `1`
- **Encryption key**: auto-generated (Web Crypto) and stored in IndexedDB

Device keys and the encryption key persist across page reloads. Users stay registered.

```ts
const noxy = await createNoxyClient({
  identity: { type: "eoa", address: "0x...", signer: mySigner },
  network: { relayNodesUrl: "wss://relay.noxy.network", appId: "my-app" },
});
```

### Custom encryption key (user-derived)

Provide your own `encryptionKey` when you need to derive it from user input (e.g., password) so only that user can decrypt device keys on this device.

```ts
// Derive a stable key (e.g., from user password or app secret)
const key = await deriveKeyFromUserInput(); // 16, 24, or 32 bytes

const noxy = await createNoxyClient({
  identity: { type: "eoa", address: "0x...", signer: mySigner },
  network: { relayNodesUrl: "wss://relay.noxy.network", appId: "my-app" },
  storage: {
    encryptionKey: key,
    indexedDb: { dbName: "noxy-db", dbVersion: 1 },
  },
});
```

### Custom IndexedDB name

Override the default db name (`noxy-client-db`) without changing persistence behavior:

```ts
const noxy = await createNoxyClient({
  identity: { type: "eoa", address: "0x...", signer: mySigner },
  network: { relayNodesUrl: "wss://relay.noxy.network", appId: "my-app" },
  storage: {
    indexedDb: { dbName: "my-app-noxy-db", dbVersion: 1 },
  },
});
```

### Smart Contract Wallet

Use `type: "scw"` for smart contract wallets.

```ts
const noxy = await createNoxyClient({
  identity: {
    type: "scw",
    address: "0x...",  // SCW address
    signer: async (data) => /* SCW signing logic */,
  },
  network: { relayNodesUrl: "wss://...", appId: "my-app" },
});
```

### React example

```ts
import { useEffect, useState } from "react";
import { createNoxyClient } from "@noxy-network/browser-sdk";

function useNoxy(walletAddress: string, signer: (data: Uint8Array) => Promise<Uint8Array | string>) {
  const [noxy, setNoxy] = useState<Awaited<ReturnType<typeof createNoxyClient>> | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let client: Awaited<ReturnType<typeof createNoxyClient>> | null = null;

    createNoxyClient({
      identity: { type: "eoa", address: walletAddress, signer },
      network: { relayNodesUrl: "wss://relay.noxy.network", appId: "my-app" },
      storage: { indexedDb: { dbName: "noxy-db", dbVersion: 1 } },
    })
      .then((c) => {
        client = c;
        setNoxy(c);
      })
      .catch(setError);

    return () => {
      client?.close();
    };
  }, [walletAddress]);

  return { noxy, error };
}
```

---

## Error Handling

`createNoxyClient` throws when options are invalid or initialization fails. The error has:

- `message` — Human-readable description
- `code` — Error code string
- `stage` — Optional: `"init_identity"` | `"load_device"` | `"connect_network"`
- `cause` — Optional: underlying error message

```ts
try {
  const noxy = await createNoxyClient(options);
} catch (err) {
  if (err instanceof Error) {
    console.error("Init failed:", err.message);
    if ("stage" in err) {
      console.error("Failed at stage:", (err as { stage?: string }).stage);
    }
  }
}
```

`revokeDevice()`, `rotateKeys()`, `on()`, and `close()` may throw on network or internal failures. Wrap calls in try/catch as needed.

---

## Pre-validation

Validate options before calling `createNoxyClient`:

```ts
import {
  createNoxyClient,
  NoxyClientOptionsSchema,
} from "@noxy-network/browser-sdk";

const result = NoxyClientOptionsSchema.safeParse(userInput);
if (!result.success) {
  console.error("Invalid options:", result.error.flatten());
  return;
}
const noxy = await createNoxyClient(result.data);
```

Exported schemas: `NoxyClientOptionsSchema`, `NoxyNetworkOptionsSchema`, `NoxyStorageOptionsSchema`.

---

## Exports

| Export | Type | Description |
|--------|------|-------------|
| `createNoxyClient` | function | Creates and initializes a Noxy client |
| `NoxyClientOptions` | type | Options for `createNoxyClient` |
| `NoxyIdentity`, `NoxyEoaWalletIdentity`, `NoxyScwWalletIdentity` | types | Identity type definitions |
| `NoxyIdentityTypeEnum` | enum | `"eoa"` \| `"scw"` |
| `NoxyClientOptionsSchema`, `NoxyNetworkOptionsSchema`, `NoxyStorageOptionsSchema` | Zod schemas | For pre-validation of options |

---

## 🔐 Security

- **Device registration** — Device signs once with the wallet; the signature binds it to the identity.
- **Notification encryption** — Kyber KEM for key agreement, HKDF for key derivation, AES-GCM for payload encryption.
- **Relay** — Sees only encrypted payloads; no plaintext.
- **Identity keys** — Not used to encrypt notifications; device and post-quantum keys are used instead.

---

## 📄 License

MIT © Noxy Network
