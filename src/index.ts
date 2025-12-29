/**
 * Entry point for the Fault-Tolerant Data Processing System
 * 
 * This file demonstrates how to instantiate and use the system programmatically
 * For frontend demo, the App.tsx component handles initialization internally
 */

import { InMemoryDatabase } from './storage/db';
import { initializeRepository, getRepository } from './storage/repository';
import { EventNormalizer } from './core/normalizer';
import { EventDeduplicator } from './core/deduplicator';
import { EventProcessor } from './core/processor';
import { EventAggregator } from './core/aggregator';
import { IngestAPI } from './api/ingest';
import { QueryAPI } from './api/query';

/**
 * Initialize the entire system
 * Returns APIs ready for use
 */
export async function initializeSystem() {
  // 1. Storage layer
  const db = new InMemoryDatabase();
  const repository = initializeRepository(db);

  // 2. Core processors
  const normalizer = new EventNormalizer();
  const deduplicator = new EventDeduplicator();
  const processor = new EventProcessor(normalizer, deduplicator, repository);

  // 3. Aggregator
  const aggregator = new EventAggregator(repository);

  // 4. APIs
  const ingestAPI = new IngestAPI(processor);
  const queryAPI = new QueryAPI(aggregator, repository);

  return {
    ingestAPI,
    queryAPI,
    repository,
  };
}

/**
 * Example usage (node.js compatible)
 */
export async function exampleUsage() {
  const { ingestAPI, queryAPI } = await initializeSystem();

  // Submit events
  const result1 = await ingestAPI.ingestEvent({
    client_id: 'service_analytics',
    metric: 'response_time',
    amount: 125,
    timestamp: new Date().toISOString(),
  });

  console.log('Ingest result:', result1);

  // Retry with same event
  const result2 = await ingestAPI.ingestEvent({
    client_id: 'service_analytics',
    metric: 'response_time',
    amount: 125,
    timestamp: new Date().toISOString(),
  });

  console.log('Duplicate result:', result2);

  // Query aggregations
  const aggregation = await queryAPI.query({ client_id: 'service_analytics' });
  console.log('Aggregation:', aggregation);

  // Get status
  const status = await queryAPI.getStatus();
  console.log('Status:', status);
}
