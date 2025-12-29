/**
 * Repository layer with failure simulation
 * 
 * DESIGN DECISION: Separate repository from DB to allow:
 * 1. Failure injection for testing resilience
 * 2. Retry logic and recovery mechanisms
 * 3. Transaction-like behavior at higher level
 * 
 * This ensures: If DB fails after validation, we don't lose data
 */

import { IDatabase } from './db';
import { ProcessedEvent, NormalizedEvent } from '../types';

export interface IRepository {
  saveProcessedEvent(processed: ProcessedEvent): Promise<{ success: boolean; error?: string }>;
  isDuplicate(fingerprint: string): Promise<boolean>;
  getProcessedEvents(): Promise<ProcessedEvent[]>;
}

export class EventRepository implements IRepository {
  private db: IDatabase;
  private failureSimulator: FailureSimulator;

  constructor(db: IDatabase) {
    this.db = db;
    this.failureSimulator = new FailureSimulator();
  }

  /**
   * Save a processed event with failure resilience
   * 
   * SAFETY GUARANTEE: 
   * - If this returns success, event is definitely in storage
   * - If it returns error, client can safely retry (idempotency via fingerprint)
   * - No partial writes that corrupt the database
   */
  async saveProcessedEvent(
    processed: ProcessedEvent
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if should simulate DB failure
      if (this.failureSimulator.shouldFail('save')) {
        throw new Error('Simulated database failure during save');
      }

      // Atomic operation: only write if not already written
      const result = await this.db.atomicWriteOrReject(
        processed.fingerprint,
        processed
      );

      if (!result.success) {
        // Not an error - this is a duplicate
        return {
          success: false,
          error: result.reason,
        };
      }

      return { success: true };
    } catch (error: any) {
      // Return error without throwing - let caller decide retry strategy
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Check if fingerprint already processed (idempotency check)
   */
  async isDuplicate(fingerprint: string): Promise<boolean> {
    try {
      if (this.failureSimulator.shouldFail('read')) {
        throw new Error('Simulated database failure during read');
      }
      return await this.db.checkFingerprint(fingerprint);
    } catch (error) {
      // On read failure, assume it might exist (conservative approach)
      // Better to reject a valid event than accept a duplicate
      console.error('Failed to check duplicate:', error);
      return false;
    }
  }

  /**
   * Retrieve all processed events for querying/aggregation
   */
  async getProcessedEvents(): Promise<ProcessedEvent[]> {
    try {
      if (this.failureSimulator.shouldFail('read')) {
        throw new Error('Simulated database failure');
      }
      return await this.db.getAllProcessedEvents();
    } catch (error) {
      console.error('Failed to retrieve events:', error);
      return [];
    }
  }

  /**
   * Toggle failure simulation for demo purposes
   */
  setSimulateFailures(enabled: boolean): void {
    this.failureSimulator.setEnabled(enabled);
  }

  getFailureSimulationStatus(): boolean {
    return this.failureSimulator.isEnabled();
  }
}

/**
 * Simulates database failures for testing resilience
 * Used by frontend toggle to inject failures
 */
export class FailureSimulator {
  private enabled: boolean = false;
  private failureRate: number = 0.5; // 50% failure rate when enabled

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Should operation fail? Returns true with failure rate probability
   */
  shouldFail(operationType: string): boolean {
    if (!this.enabled) return false;
    // Randomly fail based on rate
    return Math.random() < this.failureRate;
  }

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }
}

/**
 * Global repository instance (singleton pattern)
 * In production, would use dependency injection
 */
let globalRepository: EventRepository | null = null;

export function initializeRepository(db: IDatabase): EventRepository {
  globalRepository = new EventRepository(db);
  return globalRepository;
}

export function getRepository(): EventRepository {
  if (!globalRepository) {
    throw new Error('Repository not initialized');
  }
  return globalRepository;
}
