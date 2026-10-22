import crypto from 'node:crypto';

/**
 * Generate a cryptographically secure random opaque token for QR tickets.
 * Format: tix_live_<24 random bytes base64url> (~192 bits of entropy)
 */
export function generateSecureTicketToken(): string {
  const randomBytes = crypto.randomBytes(24);
  const base64url = randomBytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `tix_live_${base64url}`;
}

/**
 * Hash an opaque ticket token using SHA-256.
 * The database ONLY stores this hash, never the plaintext token.
 */
export function hashTicketToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generate human-readable ticket number (e.g. TIX-SW-1082)
 */
export function generateTicketNumber(prefix: string, seq: number): string {
  const cleanPrefix = prefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'EVT';
  const paddedSeq = String(seq).padStart(5, '0');
  return `TIX-${cleanPrefix}-${paddedSeq}`;
}

/**
 * Verify HMAC-SHA256 signature for payment webhooks.
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    const bufferExpected = Buffer.from(expectedSignature, 'utf8');
    const bufferActual = Buffer.from(signature, 'utf8');
    
    if (bufferExpected.length !== bufferActual.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(bufferExpected, bufferActual);
  } catch {
    return false;
  }
}
