import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// In Node (vitest), Kyber WASM cannot be fetched from file://. Pre-load and set on global
// so NoxyKyberProvider.create() can use it when modules are created in tests.
const wasmPath = join(process.cwd(), 'src', 'kyber', 'kyber.wasm');
const buf = readFileSync(wasmPath);
const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
(globalThis as unknown as Record<string, unknown>).__NOXY_KYBER_WASM_BINARY__ = wasmBinary;

