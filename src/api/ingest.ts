/**
 * Event ingestion API endpoint
 * 
 * DESIGN PHILOSOPHY:
 * Simple request-response interface
 * Clear success/failure semantics for clients
 * Defensive against malformed input
 * 
 * Endpoint: POST /api/ingest
 * Body: Raw JSON event (any schema)
 * Response: IngestResponse with clear status
 */

import { RawEvent, IngestResponse } from '../types';
import { EventProcessor } from '../core/processor';

export class IngestAPI {
  private processor: EventProcessor;

  constructor(processor: EventProcessor) {
    this.processor = processor;
  }

  /**
   * Ingest a raw event from a client
   * 
   * Client contract:
   * - Input: Any JSON object (will be normalized)
   * - Output: Clear success/failure response
   * - Semantics: Safe to retry if response doesn't arrive
   *   (deduplication ensures no double-counting)
   * 
   * Clients should:
   * 1. Include consistent (client_id, metric, amount, timestamp) in payload
   * 2. Retry on network error
   * 3. Not infer success if HTTP error occurs
   */
  async ingestEvent(rawEvent: RawEvent): Promise<IngestResponse> {
    // Validate input
    if (!rawEvent || typeof rawEvent !== 'object') {
      return {
        success: false,
        message: 'Invalid input: expected JSON object',
        error: `Received ${typeof rawEvent}`,
      };
    }

    // Process through pipeline
    return await this.processor.processEvent(rawEvent);
  }

  /**
   * Batch ingest multiple events
   * Useful for clients with high throughput
   * 
   * Design: Process each independently
   * No transactional guarantee across batch
   * (Real system would batch at DB layer for efficiency)
   */
  async ingestBatch(rawEvents: RawEvent[]): Promise<IngestResponse[]> {
    if (!Array.isArray(rawEvents)) {
      return [{
        success: false,
        message: 'Invalid input: expected array of events',
      }];
    }

    const results: IngestResponse[] = [];
    for (const event of rawEvents) {
      results.push(await this.ingestEvent(event));
    }
    return results;
  }
}
