# 📦 @noxy-network/browser-sdk

**Noxy** is a decentralized push notification network for Web3 apps. The Client SDK lets your app deliver secure, end-to-end encrypted notifications to users’ devices using **wallet-based identity** — no emails or phone numbers.

Users register a device once with a wallet signature. After that, they can receive reliable real-time or store-and-forward notifications across mobile, web, and desktop — **without centralized user accounts**.

---

## Features

- **Wallet-based identity** — EOA and Smart Contract Wallets; no email or phone
- **End-to-end encrypted notifications** — Kyber (post-quantum) + AES-GCM
- **One-time device registration** — Sign with wallet; device keys and PQ keys generated and stored securely
- **Relay-based delivery** — Single relay URL; real-time or store-and-forward
- **Cross-platform** — Browser and React Native
- **Optional encrypted local storage** — IndexedDB with optional AES-GCM key
- **No centralized user accounts** — Identity is the wallet; devices are bound to it

---

## 🚀 Installation

```bash
npm install @noxy-network/browser-sdk
# or
yarn add @noxy-network/browser-sdk
# or
pnpm add @noxy-network/browser-sdk
```

---

## 🛠 Quick Start

```ts
import { createNoxyClient } from "@noxy-network/browser-sdk";

const noxy = await createNoxyClient({
  identity: {
    type: "EOA",
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
```

---

## Initialize a Noxy Client

Client initialization runs these steps:

1. **Identity** — Validate wallet identity (EOA or SCW).
2. **Device** — Load existing device or register a new one (wallet signature, device keys, post-quantum keys).
3. **Network** — Connect to the relay and authenticate the device.

One client instance = one identity and one active device.

---

## 📥 Receiving Notifications

The relay sends **encrypted notifications only**. The SDK decrypts them and passes the plain payload to your handler.

```ts
await noxy.on((notification) => {
  console.log("Notification:", notification);
  // notification is the decrypted plain object (e.g. { type, title, message, ... })
});
```

---

## 🔐 Security Model

- **Device registration** — Device signs once with the wallet; the signature binds the device to the identity.
- **Notification encryption** — Kyber KEM for key agreement, HKDF for key derivation, AES-GCM for payload encryption.
- **Relay** — Sees only encrypted payloads; no plaintext and no need for centralized user accounts.

---

## Identity

Supported identity types:

- **EOA** — Externally Owned Accounts
- **SCW** — Smart Contract Wallets

Identity is used to:

- Authorize the device (one-time registration)
- Sign the device registration payload

Identity keys are not used to encrypt notifications; device and post-quantum keys are.

---

## 📦 Storage

Persisted data (encrypted):

- Device public/private keys (private keys encrypted at rest)
- Post-quantum keypairs
- Device metadata (e.g. issued-at, revoked)

**Browser:** IndexedDB with AES-GCM encryption key.

---



## 🧰 API Reference

Documentation (coming soon): https://docs.noxy.network/sdk

---

## 📄 License

MIT © Noxy Network
