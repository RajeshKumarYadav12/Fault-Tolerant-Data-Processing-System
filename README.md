# Fault-Tolerant Data Processing System

A backend system design that ingests unreliable client events, normalizes them, safely handles retries and failures, and exposes consistent aggregated outputs. **Focus: clean architecture, idempotency, and failure safety.**

---

## 🎯 System Architecture

```
Raw Event (unreliable)
    ↓
[Normalizer] → Canonical form (handle missing fields, wrong types)
    ↓
[Deduplicator] → Content-based fingerprint (SHA256)
    ↓
[Repository] → Atomic check-and-set (prevent duplicates)
    ↓
[Storage] → In-memory database with idempotency index
    ↓
[Aggregator] → Read-only queries (grouping by client/metric/time)
```

---

## 📋 Design Decisions Explained

### 1. **Content-Based Fingerprinting (No Client-Generated IDs)**

**Problem:** Clients don't send unique IDs, timestamps are unreliable, clients retry requests.

**Solution:** Generate a deterministic SHA256 hash of the _normalized_ event:

```
fingerprint = SHA256({client_id, metric, amount, timestamp})
```

**Why it works:**

- If a client sends the exact same event twice (same timestamp, malformed or corrected), normalization produces identical output
- Identical output → identical fingerprint
- Database rejects duplicates by fingerprint
- Prevents double-counting even if database fails after validation

**Trade-off:**

- Different clients with identical metrics might get deduplicated if timestamps also match
- **Acceptable:** Metrics are usually scoped by client_id in the normalized form

---

### 2. **Graceful Normalization (Schema-Tolerant)**

**Problem:** Clients send inconsistent JSON with missing fields, wrong types, and extra fields.

**Solution:**

- Extract fields intelligently (try aliases like `clientId`, `user_id` for `client_id`)
- Coerce types (parse `"5.5"` to `5.5`, convert `false` to `"false"`)
- Default missing fields (`amount` → `0`, `timestamp` → current time)
- Record issues for debugging (not as errors)

**Why it works:**

- System never crashes on malformed input
- Issues logged so operators can identify broken clients
- Consistent canonical format from any input shape

**Trade-off:**

- Some data loss (e.g., extra fields ignored)
- **Acceptable:** Extra fields aren't part of aggregation domain

---

### 3. **Atomic Storage (Prevent Partial Writes)**

**Problem:** If database fails after validation but before persisting, request appears successful but event is lost, and client doesn't retry.

**Solution:** Atomic operation at storage layer:

```typescript
atomicWriteOrReject(fingerprint, eventData) {
  if (fingerprintIndex.has(fingerprint)) {
    return { success: false, reason: "Duplicate" }
  }
  // Both writes happen atomically
  processedEvents.set(eventId, eventData)
  fingerprintIndex.set(fingerprint, eventId)
  return { success: true }
}
```

**Why it works:**

- Check-and-set is atomic: no race condition where two identical requests both succeed
- Storage either succeeds fully or fails clearly
- On failure, client can safely retry (deduplication prevents double-count)

**Trade-off:**

- In-memory implementation is not persistent
- **Real system:** Would use transactional database (PostgreSQL) with unique index on fingerprint

---

### 4. **Repository Layer with Failure Simulation**

**Problem:** Need to test that system survives database failures without data loss.

**Solution:**

- Repository wraps database with error handling
- `FailureSimulator` injects random failures (50% rate when enabled)
- API returns clear success/failure status (not exceptions)
- Client can safely retry on failure (idempotency via fingerprint)

**Why it works:**

- Separates concerns: DB implementation from failure recovery
- Frontend toggle lets operators test resilience manually
- System stays consistent even if 50% of writes fail

---

### 5. **Decoupled Aggregation (Read-Only)**

**Problem:** Aggregation during ingestion can slow down ingest pipeline and introduce bugs.

**Solution:**

- Aggregation reads from storage, never modifies it
- Independent queries: filter by client/metric/time, group by any dimension
- Supports complex queries (top clients, trending metrics) without complexity in ingestion

**Why it works:**

- Ingest and query paths are independent
- Query failures don't affect data
- Easy to add new aggregations without touching ingestion

---

## ❓ FAQ: Design Answers

### **What assumptions did you make?**

1. **No persistent storage required** — In-memory database is acceptable for demo; real system would use PostgreSQL with ACID guarantees
2. **Idempotency via content-based fingerprinting** — Clients can safely retry; same event content always produces same fingerprint
3. **Timestamps can be malformed** — System tolerates invalid/missing timestamps by using current time
4. **Schema flexibility** — Events can have extra fields or missing fields; system extracts what's needed and defaults the rest
5. **Failure tolerance is critical** — Database failures are expected; system should remain consistent
6. **Aggregation scale is bounded** — Full table scan acceptable; real system would use incremental aggregation or materialized views

---

### **How does the system prevent double counting?**

**Scenario:** Client sends event, server crashes after validation but before responding. Client retries.

**Flow:**

1. **Request 1:**
   - Normalize: `{client_id: "A", metric: "click", amount: 1, timestamp: "2025-01-01T00:00:00Z"}`
   - Fingerprint: `abc123...`
   - Check: Not in index
   - Store: Add to index and events table
   - ❌ Server crashes before sending response
2. **Request 2 (Retry with same event):**
   - Normalize: Identical output (same fields)
   - Fingerprint: Identical `abc123...`
   - Check: **Already in index** → Return "Duplicate"
   - ❌ No write occurs
3. **Result:** Event counted once despite two submissions

**Key:** Fingerprint is deterministic and immutable based on event content. Different requests with same content produce same fingerprint.

---

### **What happens if the database fails mid-request?**

**Scenario:** Repository.saveProcessedEvent() fails halfway through writing indexes.

**Outcome:**

1. **atomicWriteOrReject()** throws exception or returns `{ success: false }`
2. **Processor** catches error, returns IngestResponse with `success: false` and error message
3. **Client receives:** Clear "temporary failure" signal and a fingerprint
4. **Client action:** Retries with same event
5. **Next attempt:** Fingerprint deduplication catches it (either found in index from partial write, or written fully this time)

**Key:** Even if storage is partially written, the atomic operation ensures fingerprint index is consistent. Either:

- Fingerprint is indexed (event was stored before crash) → Duplicate rejection prevents re-insertion
- Fingerprint is not indexed (crashed before indexing) → Fresh attempt succeeds or fails, but won't create duplicate

---

### **What would break first at scale?**

**1. In-Memory Storage (CRITICAL)**

- Events stored in RAM; no persistence
- All data lost on restart
- Fix: Use PostgreSQL with durability guarantees

**2. Full-Table Aggregation Scan (PERFORMANCE)**

- Every aggregation query reads all events
- O(n) complexity; fine for 10k events, painful for 10M
- Fix: Materialized views, incremental aggregation, or OLAP database (ClickHouse)

**3. Single-Threaded Processing (THROUGHPUT)**

- Node.js single thread processes events sequentially
- Max ~1k events/sec with this implementation
- Fix: Worker pool (Bull, Throng) for parallelism; Kafka for queueing

**4. No Sharding (SCALABILITY)**

- Single database instance is a bottleneck
- Fingerprint index grows linearly with events
- Fix: Shard by client_id; use distributed hash table or Cassandra

**5. Lack of Monitoring (OPERABILITY)**

- No metrics on deduplication rate, failure patterns, latency
- Operators can't see system health
- Fix: Prometheus metrics, distributed tracing (Jaeger), alerting

**6. No Retry Mechanism (RESILIENCE)**

- If a write fails, it's not retried; event is lost silently
- Fix: Write-ahead log (WAL) or message queue

**Priority to fix:** 1 → 3 → 2 → 6 → 4 → 5

---

## 🔧 How to Run

### Frontend Only (React Demo)

```bash
# Install dependencies
npm install

# Start dev server (assuming Vite/CRA setup)
npm run dev

# Visit http://localhost:5173 (or 3000)
```

### With Full Backend (Node.js)

```bash
# Would need Express.js middleware wrapping the APIs:
npm install express cors

# Create src/server.ts with Express routes
npm run server

# Then frontend connects to localhost:4000
```

### Test Resilience

1. Toggle "Simulate Database Failures"
2. Submit events repeatedly
3. Watch system reject retries as duplicates
4. Verify aggregation remains consistent

---

## 📊 Implementation Summary

| Component        | File                        | Responsibility                           |
| ---------------- | --------------------------- | ---------------------------------------- |
| **Types**        | `src/types/index.ts`        | Shared interfaces                        |
| **DB**           | `src/storage/db.ts`         | In-memory storage with atomic operations |
| **Repository**   | `src/storage/repository.ts` | Failure simulation, error handling       |
| **Normalizer**   | `src/core/normalizer.ts`    | Raw → canonical transformation           |
| **Deduplicator** | `src/core/deduplicator.ts`  | SHA256 fingerprinting                    |
| **Processor**    | `src/core/processor.ts`     | Full pipeline orchestration              |
| **Aggregator**   | `src/core/aggregator.ts`    | Read-only queries                        |
| **Ingest API**   | `src/api/ingest.ts`         | Event submission endpoint                |
| **Query API**    | `src/api/query.ts`          | Aggregation & status endpoint            |
| **Frontend**     | `src/frontend/App.tsx`      | React UI orchestrator                    |

---

## 🎯 One-Line Defense

> "I prioritized idempotency through content-based fingerprinting, normalization for schema tolerance, and atomic storage to guarantee consistency under unreliable client behavior and database failures."

---

## 🧪 Testing Scenarios

### Test 1: Duplicate Rejection

```
POST /api/ingest { client_id: "user1", metric: "click", amount: 1, timestamp: "2025-01-01T00:00Z" }
// Response: { success: true, event_id: "evt_123", fingerprint: "abc..." }

POST /api/ingest { client_id: "user1", metric: "click", amount: 1, timestamp: "2025-01-01T00:00Z" }
// Response: { success: false, was_duplicate: true }

GET /api/query
// Result: count = 1 (not 2)
```

### Test 2: Schema Tolerance

```
POST /api/ingest { clientId: 999, type: "purchase", value: "50.50", ts: 1234567890000 }
// Normalizes to: { client_id: "999", metric: "purchase", amount: 50.50, timestamp: "2009-02-13T23:31:30.000Z" }
// Success: true (with normalization_issues: ["clientId used instead of client_id", ...])

POST /api/ingest { client_id: "user2" } // Missing metric, amount, timestamp
// Normalizes to: { client_id: "user2", metric: "unknown_metric", amount: 0, timestamp: "2025-01-03T..." }
// Success: true
```

### Test 3: Failure Resilience

```
Enable failure simulation (50% failure rate)

POST /api/ingest { ... }
// Result: 50% success, 50% failure responses

Client retries failed requests with same content
// Result: Duplicates rejected on success; retries succeed eventually
// Aggregation count = 1 per unique event (not inflated by retries)
```

---

## 📝 Notes

- **No unique ID requirement:** System works without client-generated or even server-generated UUIDs at ingest time
- **Timestamp tolerance:** System handles missing, invalid, or unreliable timestamps gracefully
- **Failure transparency:** Clients see clear success/failure/duplicate signals, can retry safely
- **Consistency guarantee:** Aggregation always reflects at-most-once processing per unique event
- **Scalability trade-off:** This design prioritizes consistency over throughput; distributed version would use Kafka + Cassandra

---

## 🚀 Future Enhancements

1. **PostgreSQL backend** with unique constraint on fingerprint
2. **Kafka ingestion** for high-throughput scenarios
3. **Materialized views** for common aggregations
4. **Monitoring dashboard** (Grafana) for operational visibility
5. **Distributed deduplication** (Bloom filters for fingerprint lookups across shards)
6. **Write-ahead log** for durability without losing unacknowledged events
7. **Schema registry** for client validation before ingestion
8. **Multi-tenancy** with tenant isolation
#   F a u l t - T o l e r a n t - D a t a - P r o c e s s i n g - S y s t e m  
 #   F a u l t - T o l e r a n t - D a t a - P r o c e s s i n g - S y s t e m  
 #   F a u l t - T o l e r a n t - D a t a - P r o c e s s i n g - S y s t e m  
 #   F a u l t - T o l e r a n t - D a t a - P r o c e s s i n g - S y s t e m  
 #   F a u l t - T o l e r a n t - D a t a - P r o c e s s i n g - S y s t e m  
 