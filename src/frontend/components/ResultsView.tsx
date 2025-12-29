/**
 * Results view component
 * Displays processed events, aggregations, and system status
 */

import React, { useState } from 'react';
import { ProcessedEvent, AggregationResult, SystemStatus } from '../../types';

interface ResultsViewProps {
  events: ProcessedEvent[];
  aggregation: AggregationResult | null;
  status: SystemStatus | null;
  isLoading: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ events, aggregation, status, isLoading }) => {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'aggregation' | 'status'>('events');

  if (isLoading) {
    return <div style={{ padding: '16px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #ddd',
          backgroundColor: '#f9f9f9',
        }}
      >
        {(['events', 'aggregation', 'status'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              backgroundColor: activeTab === tab ? 'white' : '#f9f9f9',
              borderBottom: activeTab === tab ? '3px solid #007bff' : 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px' }}>
        {activeTab === 'events' && <EventsTab events={events} expandedEvent={expandedEvent} setExpandedEvent={setExpandedEvent} />}
        {activeTab === 'aggregation' && <AggregationTab aggregation={aggregation} />}
        {activeTab === 'status' && <StatusTab status={status} />}
      </div>
    </div>
  );
};

const EventsTab: React.FC<{
  events: ProcessedEvent[];
  expandedEvent: string | null;
  setExpandedEvent: (id: string | null) => void;
}> = ({ events, expandedEvent, setExpandedEvent }) => {
  if (events.length === 0) {
    return <p style={{ color: '#999' }}>No events processed yet</p>;
  }

  const successCount = events.filter(e => e.status === 'success').length;
  const failureCount = events.filter(e => e.status === 'failed').length;

  return (
    <>
      <div style={{ marginBottom: '12px', fontSize: '13px' }}>
        <strong>Total:</strong> {events.length} | <span style={{ color: 'green' }}>Success: {successCount}</span> | <span style={{ color: 'red' }}>Failed: {failureCount}</span>
      </div>

      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {events.map(event => (
          <div
            key={event.id}
            style={{
              border: '1px solid #eee',
              borderRadius: '3px',
              marginBottom: '8px',
              overflow: 'hidden',
            }}
          >
            <div
              onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
              style={{
                padding: '8px 12px',
                backgroundColor: event.status === 'success' ? '#e8f5e9' : '#ffebee',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
              }}
            >
              <div>
                <strong>{event.normalized.metric}</strong> ({event.normalized.client_id}): {event.normalized.amount}
                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>
                  {event.fingerprint.substring(0, 8)}...
                </span>
              </div>
              <span>{expandedEvent === event.id ? '▼' : '▶'}</span>
            </div>

            {expandedEvent === event.id && (
              <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderTop: '1px solid #eee', fontSize: '12px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Raw Input:</strong>
                  <pre style={{ margin: '4px 0', padding: '4px', backgroundColor: 'white', borderRadius: '2px', overflow: 'auto' }}>
                    {JSON.stringify(event.raw_input, null, 2)}
                  </pre>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Normalized:</strong>
                  <pre style={{ margin: '4px 0', padding: '4px', backgroundColor: 'white', borderRadius: '2px', overflow: 'auto' }}>
                    {JSON.stringify(event.normalized, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>Status:</strong> {event.status} | <strong>ID:</strong> {event.id} | <strong>Fingerprint:</strong> {event.fingerprint.substring(0, 16)}...
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

const AggregationTab: React.FC<{ aggregation: AggregationResult | null }> = ({ aggregation }) => {
  if (!aggregation) {
    return <p style={{ color: '#999' }}>No aggregation data available</p>;
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Count', value: aggregation.count },
          { label: 'Total', value: aggregation.total.toFixed(2) },
          { label: 'Average', value: aggregation.average.toFixed(2) },
          { label: 'Min', value: aggregation.min.toFixed(2) },
          { label: 'Max', value: aggregation.max.toFixed(2) },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              padding: '12px',
              backgroundColor: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '3px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: '#666' }}>{stat.label}</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {aggregation.by_client && Object.keys(aggregation.by_client).length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <strong>By Client:</strong>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            {Object.entries(aggregation.by_client).map(([client, stats]) => (
              <div key={client} style={{ padding: '4px', backgroundColor: '#f9f9f9', borderRadius: '2px', marginBottom: '2px' }}>
                {client}: {stats.count} events, total {stats.total.toFixed(2)}, avg {stats.average.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}

      {aggregation.by_metric && Object.keys(aggregation.by_metric).length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <strong>By Metric:</strong>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            {Object.entries(aggregation.by_metric).map(([metric, stats]) => (
              <div key={metric} style={{ padding: '4px', backgroundColor: '#f9f9f9', borderRadius: '2px', marginBottom: '2px' }}>
                {metric}: {stats.count} events, total {stats.total.toFixed(2)}, avg {stats.average.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const StatusTab: React.FC<{ status: SystemStatus | null }> = ({ status }) => {
  if (!status) {
    return <p style={{ color: '#999' }}>No status data available</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
      {[
        { label: 'Total Events Received', value: status.total_events_received },
        { label: 'Successfully Processed', value: status.total_events_processed },
        { label: 'Duplicates Rejected', value: status.total_duplicates_rejected },
        { label: 'Processing Failures', value: status.total_failures },
        { label: 'DB Status', value: status.db_healthy ? '✅ Healthy' : '❌ Unhealthy' },
        { label: 'Last Event', value: status.last_event_timestamp ? new Date(status.last_event_timestamp).toLocaleString() : 'None' },
      ].map(stat => (
        <div
          key={stat.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ddd',
            borderRadius: '3px',
          }}
        >
          <strong>{stat.label}</strong>
          <span style={{ fontWeight: 'bold' }}>{stat.value}</span>
        </div>
      ))}
    </div>
  );
};
