/**
 * Deduplication and idempotency module
 * 
 * DESIGN PHILOSOPHY:
 * The problem: No unique event IDs from client, unreliable timestamps
 * The solution: Content-based fingerprinting (SHA256 of canonical event)
 * 
 * Why it works:
 * - If client sends exact same event twice (malformed timestamp, network retry)
 * - Normalization produces identical canonical form
 * - Fingerprint is identical
 * - Database rejects duplicate
 * 
 * Trade-off: Different clients with identical metrics get deduplicated
 * (acceptable: metrics are usually semantically scoped by client_id)
 */

import { NormalizedEvent } from '../types';

export interface FingerprintResult {
  fingerprint: string;
  canonical_string: string;
}

export class EventDeduplicator {
  /**
   * Generate content-based fingerprint of normalized event
   * 
   * Fingerprint includes:
   * - client_id, metric, amount, timestamp
   * 
   * NOT included (for tolerance):
   * - normalized_at (system timestamp, changes on each run)
   * - Event metadata like processing status
   * 
   * This ensures: Same event from client always produces same fingerprint
   */
  async generateFingerprint(normalized: NormalizedEvent): Promise<FingerprintResult> {
    // Create canonical string representation
    // Order matters: must be deterministic
    const canonical = JSON.stringify({
      client_id: normalized.client_id,
      metric: normalized.metric,
      amount: normalized.amount,
      timestamp: normalized.timestamp,
    });

    // Use Web Crypto API (browser-compatible) for SHA256
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert buffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      fingerprint,
      canonical_string: canonical,
    };
  }

  /**
   * Deterministic hash for quick lookup
   * Fingerprint is already this, but provided for completeness
   * Note: This is async like generateFingerprint
   */
  async getHash(normalized: NormalizedEvent): Promise<string> {
    const result = await this.generateFingerprint(normalized);
    return result.fingerprint;
  }
}
