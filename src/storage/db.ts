/**
 * In-memory database abstraction for event storage
 * Design: Simple, transactional interface to allow easy swapping with real DB
 * Trade-off: In-memory means data loss on restart, but perfect for demo
 */

import { ProcessedEvent, NormalizedEvent } from '../types';

export interface IDatabase {
  // Write operations
  storeRawEvent(event: any): Promise<string>; // Returns event ID
  storeNormalizedEvent(normalized: NormalizedEvent, fingerprint: string): Promise<void>;
  storeProcessedEvent(processed: ProcessedEvent): Promise<void>;
  checkFingerprint(fingerprint: string): Promise<boolean>; // Returns true if exists
  
  // Read operations
  getProcessedEvent(id: string): Promise<ProcessedEvent | null>;
  getAllProcessedEvents(): Promise<ProcessedEvent[]>;
  getEventsByFingerprint(fingerprint: string): Promise<ProcessedEvent[]>;
  
  // Stats
  getStats(): Promise<{
    total_stored: number;
    unique_fingerprints: number;
  }>;
  
  // Transaction-like behavior for atomic operations
  atomicWriteOrReject(
    fingerprint: string,
    eventData: ProcessedEvent
  ): Promise<{ success: boolean; reason?: string }>;
}

/**
 * In-memory implementation
 * Stores everything in memory with simple indexing
 */
export class InMemoryDatabase implements IDatabase {
  private processedEvents: Map<string, ProcessedEvent> = new Map();
  private fingerprintIndex: Map<string, string> = new Map(); // fingerprint -> event_id
  private eventIdCounter: number = 0;

  async storeRawEvent(event: any): Promise<string> {
    const id = `raw_${++this.eventIdCounter}`;
    // In real system, we'd store the raw event separately for audit trail
    return id;
  }

  async storeNormalizedEvent(normalized: NormalizedEvent, fingerprint: string): Promise<void> {
    // Normalized events are stored as part of ProcessedEvent
    // This is a no-op in our simplified model
  }

  async storeProcessedEvent(processed: ProcessedEvent): Promise<void> {
    this.processedEvents.set(processed.id, processed);
    this.fingerprintIndex.set(processed.fingerprint, processed.id);
  }

  async checkFingerprint(fingerprint: string): Promise<boolean> {
    return this.fingerprintIndex.has(fingerprint);
  }

  async getProcessedEvent(id: string): Promise<ProcessedEvent | null> {
    return this.processedEvents.get(id) || null;
  }

  async getAllProcessedEvents(): Promise<ProcessedEvent[]> {
    return Array.from(this.processedEvents.values());
  }

  async getEventsByFingerprint(fingerprint: string): Promise<ProcessedEvent[]> {
    const id = this.fingerprintIndex.get(fingerprint);
    if (!id) return [];
    const event = this.processedEvents.get(id);
    return event ? [event] : [];
  }

  async getStats(): Promise<{ total_stored: number; unique_fingerprints: number }> {
    return {
      total_stored: this.processedEvents.size,
      unique_fingerprints: this.fingerprintIndex.size,
    };
  }

  /**
   * Atomic operation: only write if fingerprint doesn't exist
   * This ensures idempotency - concurrent requests with same content won't create duplicates
   * 
   * DESIGN DECISION: This prevents double-counting if:
   * 1. First request is processed and stored
   * 2. First request fails to acknowledge to client
   * 3. Client retries with same content
   * 4. Retry is rejected because fingerprint already exists
   */
  async atomicWriteOrReject(
    fingerprint: string,
    eventData: ProcessedEvent
  ): Promise<{ success: boolean; reason?: string }> {
    // Check if already exists (simulates atomic check-and-set)
    if (this.fingerprintIndex.has(fingerprint)) {
      return {
        success: false,
        reason: 'Duplicate event - fingerprint already processed',
      };
    }

    // Write both data structures atomically
    this.processedEvents.set(eventData.id, eventData);
    this.fingerprintIndex.set(fingerprint, eventData.id);

    return { success: true };
  }
}
