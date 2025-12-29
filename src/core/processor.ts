/**
 * Processing pipeline module
 * 
 * DESIGN PHILOSOPHY:
 * Chain of responsibility pattern for event processing
 * Each step is isolated and can be tested independently
 * 
 * Pipeline:
 * 1. Normalize raw event to canonical form
 * 2. Generate fingerprint for deduplication
 * 3. Check if duplicate (idempotency check)
 * 4. If not duplicate, atomically save to storage
 * 5. Return clear success/failure status
 * 
 * This ensures:
 * - Normalization doesn't block storage
 * - Failures are isolated and recoverable
 * - Duplicates are caught before storage
 */

import { RawEvent, ProcessedEvent, IngestResponse } from '../types';
import { EventNormalizer } from './normalizer';
import { EventDeduplicator } from './deduplicator';
import { IRepository } from '../storage/repository';

export class EventProcessor {
  private normalizer: EventNormalizer;
  private deduplicator: EventDeduplicator;
  private repository: IRepository;

  constructor(normalizer: EventNormalizer, deduplicator: EventDeduplicator, repository: IRepository) {
    this.normalizer = normalizer;
    this.deduplicator = deduplicator;
    this.repository = repository;
  }

  /**
   * Full processing pipeline for a raw event
   * 
   * Returns: Clear status indicating what happened
   * - Processed: New event successfully stored
   * - Duplicate: Event already processed, rejected
   * - Failed: Unexpected error (client can retry)
   */
  async processEvent(rawEvent: RawEvent): Promise<IngestResponse> {
    try {
      // Step 1: Normalize
      const normResult = this.normalizer.normalize(rawEvent);
      
      if (!normResult.normalized) {
        return {
          success: false,
          message: 'Failed to normalize event',
          error: 'Normalization produced invalid result',
        };
      }

      // Step 2: Generate fingerprint
      const fpResult = await this.deduplicator.generateFingerprint(normResult.normalized);

      // Step 3: Check for duplicates
      const isDuplicate = await this.repository.isDuplicate(fpResult.fingerprint);
      
      if (isDuplicate) {
        return {
          success: false,
          message: 'Duplicate event rejected (idempotency)',
          fingerprint: fpResult.fingerprint,
          details: {
            was_duplicate: true,
          },
        };
      }

      // Step 4: Create ProcessedEvent
      const processed: ProcessedEvent = {
        id: this.generateEventId(),
        raw_input: rawEvent,
        normalized: normResult.normalized,
        fingerprint: fpResult.fingerprint,
        processed_at: new Date().toISOString(),
        status: 'success',
      };

      // Step 5: Atomically save to storage
      const saveResult = await this.repository.saveProcessedEvent(processed);

      if (!saveResult.success) {
        // If it's a duplicate (shouldn't happen, but defensive)
        if (saveResult.error?.includes('Duplicate')) {
          return {
            success: false,
            message: 'Duplicate event rejected (caught at storage layer)',
            event_id: processed.id,
            fingerprint: fpResult.fingerprint,
            details: {
              was_duplicate: true,
            },
          };
        }

        // Otherwise it's a genuine DB error - client can retry
        return {
          success: false,
          message: 'Failed to store event (temporary DB failure)',
          event_id: processed.id,
          fingerprint: fpResult.fingerprint,
          error: saveResult.error,
        };
      }

      // Success!
      return {
        success: true,
        message: 'Event processed successfully',
        event_id: processed.id,
        fingerprint: fpResult.fingerprint,
        details: {
          was_duplicate: false,
          normalization_issues: normResult.issues,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Unexpected error during processing',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Generate unique ID for processed event
   * Format: {timestamp}-{random} for some uniqueness
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
