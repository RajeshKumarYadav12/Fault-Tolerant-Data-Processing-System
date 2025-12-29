/**
 * Event normalization module
 * 
 * DESIGN PHILOSOPHY:
 * 1. Schema-tolerant: Accept any JSON, try to extract canonical fields
 * 2. Graceful degradation: Missing fields get defaults, wrong types are coerced
 * 3. Issue tracking: Record what we had to fix for debugging
 * 4. Isolated: No side effects, pure transformation
 * 
 * This ensures: Events from broken clients don't crash the system
 */

import { RawEvent, NormalizedEvent } from '../types';

export interface NormalizationResult {
  success: boolean;
  normalized?: NormalizedEvent;
  issues: string[];
}

export class EventNormalizer {
  /**
   * Convert raw, potentially malformed event into canonical format
   * 
   * Handles:
   * - Missing fields (uses sensible defaults)
   * - Wrong types (coerces intelligently)
   * - Extra fields (ignores them)
   * - Malformed timestamps (uses current time)
   */
  normalize(rawEvent: RawEvent): NormalizationResult {
    const issues: string[] = [];

    // Extract and validate client_id
    let client_id = this.extractString(rawEvent, 'client_id', issues);
    if (!client_id) {
      // Try common alternatives
      client_id = this.extractString(rawEvent, 'clientId', issues) ||
                  this.extractString(rawEvent, 'user_id', issues) ||
                  'unknown_client';
      issues.push(`client_id missing, defaulted to ${client_id}`);
    }

    // Extract and validate metric
    let metric = this.extractString(rawEvent, 'metric', issues);
    if (!metric) {
      metric = this.extractString(rawEvent, 'type', issues) ||
               this.extractString(rawEvent, 'event_type', issues) ||
               'unknown_metric';
      issues.push(`metric missing, defaulted to ${metric}`);
    }

    // Extract and validate amount
    let amount = this.extractNumber(rawEvent, 'amount', issues);
    if (amount === null) {
      amount = this.extractNumber(rawEvent, 'value', issues);
      if (amount === null) {
        amount = 0;
        issues.push('amount missing, defaulted to 0');
      }
    }

    // Extract and validate timestamp
    let timestamp = this.extractTimestamp(rawEvent, 'timestamp', issues);
    if (!timestamp) {
      timestamp = this.extractTimestamp(rawEvent, 'ts', issues) ||
                  this.extractTimestamp(rawEvent, 'time', issues) ||
                  new Date().toISOString();
      if (!timestamp) {
        timestamp = new Date().toISOString();
        issues.push('timestamp missing or invalid, using current time');
      }
    }

    const normalized: NormalizedEvent = {
      client_id: client_id.substring(0, 256), // Prevent extremely long IDs
      metric: metric.substring(0, 256),
      amount: Math.round(amount * 100) / 100, // Round to 2 decimals
      timestamp,
      normalized_at: new Date().toISOString(),
    };

    return {
      success: issues.length === 0,
      normalized,
      issues,
    };
  }

  /**
   * Safely extract string from object
   */
  private extractString(obj: any, field: string, issues: string[]): string | null {
    const value = obj?.[field];
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    issues.push(`Field '${field}' has unexpected type: ${typeof value}`);
    return String(value);
  }

  /**
   * Safely extract number from object
   */
  private extractNumber(obj: any, field: string, issues: string[]): number | null {
    const value = obj?.[field];
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
      issues.push(`Field '${field}' could not be parsed as number: "${value}"`);
      return null;
    }

    issues.push(`Field '${field}' has unexpected type for number: ${typeof value}`);
    return null;
  }

  /**
   * Extract and validate ISO 8601 timestamp
   */
  private extractTimestamp(obj: any, field: string, issues: string[]): string | null {
    const value = obj?.[field];
    if (value === null || value === undefined) return null;

    let timestamp: string | null = null;

    if (typeof value === 'string') {
      // Assume ISO 8601 format
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        timestamp = date.toISOString();
      } else {
        issues.push(`Field '${field}' is not valid ISO 8601: "${value}"`);
      }
    } else if (typeof value === 'number') {
      // Assume Unix timestamp in milliseconds
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        timestamp = date.toISOString();
      } else {
        issues.push(`Field '${field}' is not valid Unix timestamp: ${value}`);
      }
    } else {
      issues.push(`Field '${field}' has unexpected type: ${typeof value}`);
    }

    return timestamp;
  }
}
