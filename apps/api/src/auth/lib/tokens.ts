import { createHash, randomBytes } from 'crypto';

/** SHA-256 hex digest — refresh tokens are never stored in cleartext. */
export function hashSecret(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Cryptographically random opaque token (refresh tokens) — never Math.random(). */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
