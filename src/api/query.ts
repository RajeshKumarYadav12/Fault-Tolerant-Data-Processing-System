/**
 * Query and aggregation API endpoint
 * 
 * DESIGN PHILOSOPHY:
 * Completely separate from ingestion pipeline
 * Read-only operations: Never modify state
 * Flexible filtering and grouping
 * 
 * Endpoint: GET /api/query
 * Query params: client_id, metric, start_time, end_time, group_by
 * Response: AggregationResult with filtered/grouped stats
 */

import { AggregationQuery, AggregationResult, ProcessedEvent, SystemStatus } from '../types';
import { EventAggregator } from '../core/aggregator';
import { IRepository } from '../storage/repository';

export class QueryAPI {
  private aggregator: EventAggregator;
  private repository: IRepository;
  private stats = {
    total_received: 0,
    total_processed: 0,
    total_duplicates: 0,
    total_failures: 0,
    last_event_time: null as string | null,
  };

  constructor(aggregator: EventAggregator, repository: IRepository) {
    this.aggregator = aggregator;
    this.repository = repository;
  }

  /**
   * Query aggregated metrics
   * 
   * Query parameters:
   * - client_id: Optional filter by client
   * - metric: Optional filter by metric type
   * - start_time: Optional ISO 8601 start (inclusive)
   * - end_time: Optional ISO 8601 end (inclusive)
   * - group_by: Optional array of ['client', 'metric', 'time']
   * 
   * Returns: Aggregation with count, total, average, min, max
   */
  async query(queryParams: AggregationQuery): Promise<AggregationResult> {
    try {
      return await this.aggregator.aggregate(queryParams);
    } catch (error: any) {
      console.error('Query failed:', error);
      // Return empty result on error, don't crash
      return {
        count: 0,
        total: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }
  }

  /**
   * Get all processed events (useful for UI inspection)
   */
  async getProcessedEvents(): Promise<ProcessedEvent[]> {
    try {
      return await this.repository.getProcessedEvents();
    } catch (error: any) {
      console.error('Failed to retrieve events:', error);
      return [];
    }
  }

  /**
   * Get system status and statistics
   */
  async getStatus(): Promise<SystemStatus> {
    const events = await this.repository.getProcessedEvents();
    
    let processedCount = 0;
    let failureCount = 0;
    let duplicateCount = 0;
    let lastTime: string | null = null;

    for (const event of events) {
      if (event.status === 'success') {
        processedCount++;
      } else if (event.status === 'failed') {
        failureCount++;
      }
      if (event.normalized.timestamp > (lastTime || '')) {
        lastTime = event.normalized.timestamp;
      }
    }

    return {
      total_events_received: this.stats.total_received,
      total_events_processed: processedCount,
      total_duplicates_rejected: duplicateCount,
      total_failures: failureCount,
      last_event_timestamp: lastTime,
      db_healthy: true, // In real system, would check DB health
    };
  }

  /**
   * Update stats when event is ingested
   * Called by processor to track metrics
   */
  recordIngestAttempt(success: boolean, isDuplicate: boolean, timestamp: string): void {
    this.stats.total_received++;
    if (success) {
      this.stats.total_processed++;
    }
    if (isDuplicate) {
      this.stats.total_duplicates++;
    }
    if (!success && !isDuplicate) {
      this.stats.total_failures++;
    }
    this.stats.last_event_time = timestamp;
  }

  /**
   * Example complex query: Get top clients by event count
   */
  async getTopClients(limit: number = 10): Promise<Array<{ client_id: string; count: number; total: number }>> {
    const result = await this.aggregator.aggregate({ group_by: ['client'] });
    
    if (!result.by_client) return [];

    return Object.entries(result.by_client)
      .map(([client_id, stats]) => ({
        client_id,
        count: stats.count,
        total: stats.total,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Example complex query: Get trending metrics
   */
  async getTrendingMetrics(limit: number = 10): Promise<Array<{ metric: string; count: number; average: number }>> {
    const result = await this.aggregator.aggregate({ group_by: ['metric'] });
    
    if (!result.by_metric) return [];

    return Object.entries(result.by_metric)
      .map(([metric, stats]) => ({
        metric,
        count: stats.count,
        average: stats.average,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}
