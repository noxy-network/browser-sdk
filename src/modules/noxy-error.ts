import type { NoxyStorageErrorOperationEnum, NoxyNetworkErrorOperationEnum } from '@/modules/noxy-error.types';

const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';

// Debug helper
function logNoxyErrorStackIfDebug(err: NoxyError): void {
  const isDebug = typeof globalThis !== 'undefined' && !!(globalThis as unknown as { __NOXY_DEBUG__?: boolean }).__NOXY_DEBUG__;
  if (isDebug && err.stack) {
    const cause = err.cause ? `\nCaused by: ${err.cause}` : '';
    globalThis.console.error(`[debug] ${err.message}${cause}\n${err.stack}`);
  }
}

/**
 * Base error interface for Noxy SDK
 */
export interface NoxyError extends Error {
  code: string;
  message: string;
}

/**
 * General error for Noxy SDK
 * Use for errors that don't fit into other specific categories
 */
export class NoxyGeneralError extends Error implements NoxyError {
  code: string;
  message: string;

  constructor({ code, message }: { code?: string; message?: string } = {}) {
    super(message);
    this.code = code ?? UNKNOWN_ERROR_CODE;
    this.message = `[noxy.error]: ${message ?? UNKNOWN_ERROR_MESSAGE}`;
    logNoxyErrorStackIfDebug(this);
  }
}

/**
 * Initialization error
 * Thrown when initialization of Noxy client fails
 */
export class NoxyInitializationError extends Error implements NoxyError {
  code: string;
  stage?: string;
  cause?: string;

  constructor({ code, message, stage, cause }: { code?: string; message?: string; stage?: string; cause?: string } = {}) {
    super(message);
    this.code = code ?? UNKNOWN_ERROR_CODE;
    this.message = `[noxy.init.error]: ${message ?? UNKNOWN_ERROR_MESSAGE}`;
    if (stage) {
      this.stage = stage;
    }
    if (cause) {
      this.cause = cause;
    }
    logNoxyErrorStackIfDebug(this);
  }
}

/**
 * Identity error
 * Thrown when identity operations fail (signing, verifying, etc.)
 */
export class NoxyIdentityError extends Error implements NoxyError {
  code: string;
  message: string;

  constructor({ code, message }: { code?: string; message?: string } = {}) {
    super(message);
    this.code = code ?? UNKNOWN_ERROR_CODE;
    this.message = `[noxy.identity.error]: ${message ?? UNKNOWN_ERROR_MESSAGE}`;
    logNoxyErrorStackIfDebug(this);
  }
}

/**
 * Kyber provider error
 * Thrown when Kyber provider operations fail (keypair, encapsulate, decapsulate, etc.)
 */
export class NoxyKyberProviderError extends NoxyGeneralError {
  code: string;
  message: string;

  constructor({ code, message }: { code?: string; message?: string } = {}) {
    super({ code, message });
    this.code = code ?? UNKNOWN_ERROR_CODE;
    this.message = `[noxy.kyber.error]: ${message ?? UNKNOWN_ERROR_MESSAGE}`;
  }
}

/**
 * Storage error
 * Thrown when storage operations fail (load, save, delete, encryption, etc.)
 */
export class NoxyStorageError extends Error implements NoxyError {
  code: string;
  operation?: NoxyStorageErrorOperationEnum;
  storeName?: string;

  constructor({
    code,
    message,
    operation,
    storeName,
  }: {
    code?: string;
    message?: string;
    operation?: NoxyStorageErrorOperationEnum;
    storeName?: string;
  } = {}) {
    super(message);
    this.code = code ?? UNKNOWN_ERROR_CODE;
    this.message = `[noxy.storage.error]: ${message ?? UNKNOWN_ERROR_MESSAGE}`;
    this.operation = operation;
    this.storeName = storeName;
    logNoxyErrorStackIfDebug(this);
  }
}

/**
 * Network error
 * Thrown when network operations fail (connection, sending, receiving, etc.)
 */
export class NoxyNetworkError extends Error implements NoxyError {
  code: string;
  operation?: NoxyNetworkErrorOperationEnum;
  nodes?: string[];
  attempts?: number;

  constructor({
    code,
    message,
    operation,
    nodes,
    attempts,
  }: {
    code?: string;
    message?: string;
    operation?: NoxyNetworkErrorOperationEnum;
    nodes?: string[];
    attempts?: number;
  } = {}) {
    super(message);
    this.code = code ?? UNKNOWN_ERROR_CODE;
    this.message = `[noxy.network.error]: ${message ?? UNKNOWN_ERROR_MESSAGE}`;
    this.operation = operation;
    this.nodes = nodes;
    this.attempts = attempts;
    logNoxyErrorStackIfDebug(this);
  }
}
