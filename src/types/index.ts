/**
 * Shared type definitions for the Fault-Tolerant Data Processing System
 */

/**
 * Raw event as received from unreliable clients
 * Can have inconsistent schemas, missing fields, wrong types
 */
export interface RawEvent {
  [key: string]: unknown;
}

/**
 * Canonical normalized event format
 * All events are standardized to this schema
 */
export interface NormalizedEvent {
  client_id: string;
  metric: string;
  amount: number;
  timestamp: string; // ISO 8601
  normalized_at: string; // When we normalized it (ISO 8601)
}

/**
 * Event with metadata about processing
 */
export interface ProcessedEvent {
  id: string; // Content-based fingerprint hash
  raw_input: RawEvent;
  normalized: NormalizedEvent;
  fingerprint: string; // SHA256 of normalized event (for idempotency)
  processed_at: string; // ISO 8601
  status: 'success' | 'failed' | 'retry';
  error?: string;
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  count: number;
  total: number;
  average: number;
  min: number;
  max: number;
  by_client?: Record<string, AggregationResult>;
  by_metric?: Record<string, AggregationResult>;
  by_time_bucket?: Record<string, AggregationResult>;
}

/**
 * Query parameters for filtering aggregations
 */
export interface AggregationQuery {
  client_id?: string;
  metric?: string;
  start_time?: string; // ISO 8601
  end_time?: string; // ISO 8601
  group_by?: ('client' | 'metric' | 'time')[];
}

/**
 * Response from ingest endpoint
 */
export interface IngestResponse {
  success: boolean;
  message: string;
  event_id?: string;
  fingerprint?: string;
  error?: string;
  details?: {
    was_duplicate?: boolean;
    normalization_issues?: string[];
  };
}

/**
 * System status and stats
 */
export interface SystemStatus {
  total_events_received: number;
  total_events_processed: number;
  total_duplicates_rejected: number;
  total_failures: number;
  last_event_timestamp: string | null;
  db_healthy: boolean;
}
