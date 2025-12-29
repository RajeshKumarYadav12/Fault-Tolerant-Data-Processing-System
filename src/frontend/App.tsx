/**
 * Main application component
 * Orchestrates the entire system: API, storage, processing, and UI
 */

import React, { useState, useEffect } from 'react';
import { EventForm } from './components/EventForm';
import { FailureToggle } from './components/FailureToggle';
import { ResultsView } from './components/ResultsView';
import { IngestAPI } from '../api/ingest';
import { QueryAPI } from '../api/query';
import { EventProcessor } from '../core/processor';
import { EventNormalizer } from '../core/normalizer';
import { EventDeduplicator } from '../core/deduplicator';
import { EventAggregator } from '../core/aggregator';
import { InMemoryDatabase } from '../storage/db';
import { initializeRepository, getRepository } from '../storage/repository';
import { ProcessedEvent, AggregationResult, SystemStatus, IngestResponse } from '../types';

/**
 * App initialization happens here
 * Creates all system components and wires them together
 * 
 * ARCHITECTURE:
 * 1. Database layer (in-memory)
 * 2. Repository (with failure simulation)
 * 3. Core processors (normalizer, deduplicator, processor, aggregator)
 * 4. APIs (ingest, query)
 * 5. React UI (Event form, results, status)
 */
export const App: React.FC = () => {
  // System state
  const [ingestAPI] = useState(() => {
    const db = new InMemoryDatabase();
    const repo = initializeRepository(db);
    const normalizer = new EventNormalizer();
    const deduplicator = new EventDeduplicator();
    const processor = new EventProcessor(normalizer, deduplicator, repo);
    return new IngestAPI(processor);
  });

  const [queryAPI] = useState(() => {
    const repo = getRepository();
    const aggregator = new EventAggregator(repo);
    return new QueryAPI(aggregator, repo);
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<IngestResponse | null>(null);
  const [failuresEnabled, setFailuresEnabled] = useState(false);
  const [events, setEvents] = useState<ProcessedEvent[]>([]);
  const [aggregation, setAggregation] = useState<AggregationResult | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);

  // Refresh data
  const refreshData = async () => {
    try {
      const [newEvents, newAgg, newStatus] = await Promise.all([
        queryAPI.getProcessedEvents(),
        queryAPI.query({}),
        queryAPI.getStatus(),
      ]);
      setEvents(newEvents);
      setAggregation(newAgg);
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  // Refresh data when submitting
  const handleSubmitEvent = async (rawEvent: any) => {
    setIsSubmitting(true);
    try {
      const response = await ingestAPI.ingestEvent(rawEvent);
      setLastResponse(response);
      
      // Show success/failure feedback
      if (response.success) {
        alert(`✅ Event processed successfully!\nID: ${response.event_id}\nFingerprint: ${response.fingerprint?.substring(0, 16)}...`);
      } else if (response.details?.was_duplicate) {
        alert(`⚠️ Duplicate event rejected\n(This is expected if you submit the same event twice)`);
      } else if (response.error?.includes('failure')) {
        alert(`❌ Database failure (simulated)\nYou can safely retry - idempotency prevents double-counting`);
      } else {
        alert(`⚠️ ${response.message}\n${response.error || ''}`);
      }

      // Refresh UI
      await refreshData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle failure simulation toggle
  const handleFailureToggle = (enabled: boolean) => {
    setFailuresEnabled(enabled);
    const repo = getRepository();
    repo.setSimulateFailures(enabled);
  };

  // Initial data load
  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui' }}>
      <header style={{ marginBottom: '32px', borderBottom: '1px solid #ddd', paddingBottom: '16px' }}>
        <h1>Fault-Tolerant Data Processing System</h1>
        <p style={{ color: '#666', marginTop: '8px' }}>
          Submit unreliable events, watch the system normalize, deduplicate, and aggregate them safely.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div>
          <FailureToggle enabled={failuresEnabled} onToggle={handleFailureToggle} />
          <EventForm onSubmit={handleSubmitEvent} isLoading={isSubmitting} />
        </div>

        <div>
          {lastResponse && (
            <div
              style={{
                border: `2px solid ${lastResponse.success ? '#4caf50' : '#f44336'}`,
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '12px',
                backgroundColor: lastResponse.success ? '#f1f8f6' : '#fef5f5',
                fontSize: '13px',
              }}
            >
              <strong>{lastResponse.success ? '✅ Success' : '❌ Failed'}</strong>
              <div style={{ marginTop: '4px' }}>{lastResponse.message}</div>
              {lastResponse.fingerprint && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
                  Fingerprint: {lastResponse.fingerprint.substring(0, 32)}...
                </div>
              )}
            </div>
          )}

          <button
            onClick={refreshData}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '12px',
            }}
          >
            🔄 Refresh Results
          </button>
        </div>
      </div>

      <ResultsView events={events} aggregation={aggregation} status={status} isLoading={false} />

      <footer style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #ddd', fontSize: '12px', color: '#666' }}>
        <details style={{ marginBottom: '12px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
            How the system works
          </summary>
          <ul style={{ marginLeft: '20px', lineHeight: '1.6' }}>
            <li>
              <strong>Normalization:</strong> Raw events with inconsistent schemas are converted to a canonical format.
            </li>
            <li>
              <strong>Content-Based Fingerprinting:</strong> A SHA256 hash of the canonical event ensures deduplication
              without relying on unique IDs or reliable timestamps.
            </li>
            <li>
              <strong>Atomic Storage:</strong> Events are stored in a way that prevents double-counting even if
              the database fails mid-request.
            </li>
            <li>
              <strong>Aggregation:</strong> Independent read-only queries that never corrupt data, supporting grouping
              by client, metric, and time.
            </li>
            <li>
              <strong>Failure Simulation:</strong> Toggle database failures to test that the system remains consistent.
            </li>
          </ul>
        </details>

        <p>
          This demonstrates idempotency, failure isolation, and consistent data processing under unreliable client behavior.
        </p>
      </footer>
    </div>
  );
};
