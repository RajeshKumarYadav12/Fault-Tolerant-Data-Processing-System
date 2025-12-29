/**
 * Event submission form component
 * Allows users to manually submit events with various malformed schemas
 * for testing the system's resilience
 */

import React, { useState } from 'react';

interface EventFormProps {
  onSubmit: (event: any) => Promise<void>;
  isLoading: boolean;
}

/**
 * Presets for testing various malformed event schemas
 */
const EVENT_PRESETS = {
  valid: {
    client_id: 'app_server_01',
    metric: 'api_latency',
    amount: 245,
    timestamp: new Date().toISOString(),
  },
  missing_client: {
    metric: 'db_queries',
    amount: 512,
    timestamp: new Date().toISOString(),
  },
  wrong_types: {
    client_id: 98765, // Should be string
    metric: 'memory_usage',
    amount: '1024.5', // Should be number
    timestamp: new Date().toISOString(),
  },
  missing_amount: {
    client_id: 'cache_service',
    metric: 'cache_hits',
    timestamp: new Date().toISOString(),
    // Missing amount field
  },
  bad_timestamp: {
    client_id: 'load_balancer',
    metric: 'request_count',
    amount: 3456,
    timestamp: 'invalid_date_format', // Invalid timestamp
  },
  extra_fields: {
    client_id: 'worker_pool',
    metric: 'cpu_usage',
    amount: 78,
    timestamp: new Date().toISOString(),
    extra_field_1: 'should_ignore',
    extra_field_2: { nested: 'metadata' },
    // Should be silently ignored
  },
};

export const EventForm: React.FC<EventFormProps> = ({ onSubmit, isLoading }) => {
  const [eventJson, setEventJson] = useState(JSON.stringify(EVENT_PRESETS.valid, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const event = JSON.parse(eventJson);
      await onSubmit(event);
    } catch (err: any) {
      setError(`Invalid JSON: ${err.message}`);
    }
  };

  const loadPreset = (preset: keyof typeof EVENT_PRESETS) => {
    setEventJson(JSON.stringify(EVENT_PRESETS[preset], null, 2));
    setError(null);
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '16px', borderRadius: '4px' }}>
      <h3>Submit Event</h3>
      
      <div style={{ marginBottom: '12px' }}>
        <label>Quick Presets:</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
          {Object.keys(EVENT_PRESETS).map(key => (
            <button
              key={key}
              onClick={() => loadPreset(key as keyof typeof EVENT_PRESETS)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '3px',
              }}
            >
              {key.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={eventJson}
          onChange={e => setEventJson(e.target.value)}
          style={{
            width: '100%',
            height: '200px',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            marginBottom: '12px',
          }}
        />

        {error && (
          <div style={{ color: 'red', marginBottom: '12px', fontSize: '12px' }}>
            Error: {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: isLoading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          {isLoading ? 'Submitting...' : 'Submit Event'}
        </button>
      </form>
    </div>
  );
};
