export type Timestamp = bigint | number;
export type Hash = `0x${string}`;
export type Signature = Uint8Array | Hash | string;

/**
 * Detects if a type is `any` and returns the specified type if true
 * Used to prevent `any` from being passed to API methods
 */
type IfAny<T, Y = true, N = false> = 0 extends (1 & T) ? Y : N;

/**
 * Rejects `any` type and forces explicit types for SDK consumers
 * Returns `never` if `any` is passed, preventing compilation
 */
export type NoAny<T> = IfAny<T, never, T>;