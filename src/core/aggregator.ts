/**
 * Aggregation module
 * 
 * DESIGN PHILOSOPHY:
 * Decoupled from ingestion: Aggregation reads from storage, doesn't affect it
 * Flexible: Supports grouping by client, metric, time bucket
 * Stateless: No caching (real system would cache here)
 * 
 * This ensures: Aggregation queries never corrupt data
 */

import { ProcessedEvent, AggregationQuery, AggregationResult } from '../types';
import { IRepository } from '../storage/repository';

export class EventAggregator {
  private repository: IRepository;

  constructor(repository: IRepository) {
    this.repository = repository;
  }

  /**
   * Main aggregation endpoint
   * Filters events based on query and computes statistics
   */
  async aggregate(query: AggregationQuery): Promise<AggregationResult> {
    const events = await this.repository.getProcessedEvents();

    // Filter events based on query
    let filtered = events.filter(e => this.matchesQuery(e, query));

    if (filtered.length === 0) {
      return {
        count: 0,
        total: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }

    // Compute basic stats
    const result = this.computeStats(filtered);

    // Apply grouping if requested
    if (query.group_by && query.group_by.length > 0) {
      result.by_client = this.groupByClient(filtered);
      result.by_metric = this.groupByMetric(filtered);
      result.by_time_bucket = this.groupByTimeBucket(filtered);
    }

    return result;
  }

  /**
   * Check if event matches query filters
   */
  private matchesQuery(event: ProcessedEvent, query: AggregationQuery): boolean {
    // Client filter
    if (query.client_id && event.normalized.client_id !== query.client_id) {
      return false;
    }

    // Metric filter
    if (query.metric && event.normalized.metric !== query.metric) {
      return false;
    }

    // Time range filter
    if (query.start_time) {
      const eventTime = new Date(event.normalized.timestamp);
      const startTime = new Date(query.start_time);
      if (eventTime < startTime) return false;
    }

    if (query.end_time) {
      const eventTime = new Date(event.normalized.timestamp);
      const endTime = new Date(query.end_time);
      if (eventTime > endTime) return false;
    }

    return true;
  }

  /**
   * Compute statistics for a set of events
   */
  private computeStats(events: ProcessedEvent[]): AggregationResult {
    const amounts = events.map(e => e.normalized.amount);

    return {
      count: events.length,
      total: amounts.reduce((sum, a) => sum + a, 0),
      average: amounts.reduce((sum, a) => sum + a, 0) / events.length,
      min: Math.min(...amounts),
      max: Math.max(...amounts),
    };
  }

  /**
   * Group events by client_id and compute stats for each
   */
  private groupByClient(events: ProcessedEvent[]): Record<string, AggregationResult> {
    const grouped: Record<string, ProcessedEvent[]> = {};

    for (const event of events) {
      const clientId = event.normalized.client_id;
      if (!grouped[clientId]) {
        grouped[clientId] = [];
      }
      grouped[clientId].push(event);
    }

    const result: Record<string, AggregationResult> = {};
    for (const [clientId, clientEvents] of Object.entries(grouped)) {
      result[clientId] = this.computeStats(clientEvents);
    }

    return result;
  }

  /**
   * Group events by metric and compute stats for each
   */
  private groupByMetric(events: ProcessedEvent[]): Record<string, AggregationResult> {
    const grouped: Record<string, ProcessedEvent[]> = {};

    for (const event of events) {
      const metric = event.normalized.metric;
      if (!grouped[metric]) {
        grouped[metric] = [];
      }
      grouped[metric].push(event);
    }

    const result: Record<string, AggregationResult> = {};
    for (const [metric, metricEvents] of Object.entries(grouped)) {
      result[metric] = this.computeStats(metricEvents);
    }

    return result;
  }

  /**
   * Group events by hourly time buckets and compute stats for each
   */
  private groupByTimeBucket(events: ProcessedEvent[]): Record<string, AggregationResult> {
    const grouped: Record<string, ProcessedEvent[]> = {};

    for (const event of events) {
      const date = new Date(event.normalized.timestamp);
      // Round to nearest hour
      date.setMinutes(0, 0, 0);
      const bucket = date.toISOString();

      if (!grouped[bucket]) {
        grouped[bucket] = [];
      }
      grouped[bucket].push(event);
    }

    const result: Record<string, AggregationResult> = {};
    for (const [bucket, bucketEvents] of Object.entries(grouped)) {
      result[bucket] = this.computeStats(bucketEvents);
    }

    return result;
  }
}
