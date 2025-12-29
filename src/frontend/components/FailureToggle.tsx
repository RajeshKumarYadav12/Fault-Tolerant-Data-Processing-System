/**
 * Toggle for simulating database failures
 * Tests the system's failure resilience and recovery
 */

import React from 'react';

interface FailureToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const FailureToggle: React.FC<FailureToggleProps> = ({ enabled, onToggle }) => {
  return (
    <div
      style={{
        border: '1px solid #ff6b6b',
        padding: '16px',
        borderRadius: '4px',
        backgroundColor: enabled ? '#ffe6e6' : '#fff',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <input
          type="checkbox"
          id="failure-toggle"
          checked={enabled}
          onChange={e => onToggle(e.target.checked)}
          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
        />
        <label htmlFor="failure-toggle" style={{ cursor: 'pointer', flex: 1 }}>
          <strong>Simulate Database Failures</strong>
          <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
            {enabled
              ? '⚠️ Database is unreliable (50% failure rate). Watch how system retries and maintains consistency.'
              : '✅ Database is healthy. All writes should succeed.'}
          </p>
        </label>
      </div>

      {enabled && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '3px',
            fontSize: '12px',
            color: '#856404',
          }}
        >
          <strong>What this tests:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
            <li>System handles DB errors gracefully</li>
            <li>Clients can safely retry failed requests</li>
            <li>Idempotency prevents double-counting on retry</li>
            <li>Failed events can be reprocessed later</li>
          </ul>
        </div>
      )}
    </div>
  );
};
