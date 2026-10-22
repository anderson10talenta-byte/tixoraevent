# Architecture Specification — Tixora

## 1. System Overview
Tixora is built as a full-stack web application combining a React SPA frontend and a robust Node/Express + PostgreSQL/Supabase backend layer.

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  React 19 + TypeScript + Tailwind CSS                       │
│  - Public Discovery & Event Landing Pages                   │
│  - Attendee Booking & Digital QR Ticket Viewer              │
│  - Organizer Portal (Dashboard, Events, Orders, Staff)      │
│  - Check-In Staff Camera Scanner (Continuous WebCam + jsQR) │
│  - Super Admin Oversight & Audit Trail                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON REST API / HTTPS
┌──────────────────────────────▼──────────────────────────────┐
│                      Server Layer (server.ts)               │
│  Express API + Security Middlewares                         │
│  - Auth & RBAC Evaluator (Attendee, Staff, Org, Admin)      │
│  - Capacity Reservation & Booking Engine                    │
│  - Ticket Issuance Engine (CSPRNG + SHA-256 Hasher)         │
│  - Atomic Check-In Validator (Conditional Concurrency Lock) │
│  - Payment Webhook Ingestion & Idempotency Filter           │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQL & Transactions
┌──────────────────────────────▼──────────────────────────────┐
│                    Persistence & RLS Layer                  │
│  PostgreSQL / Supabase Engine                               │
│  - 14 Normalized Tables with Foreign Keys & Constraints     │
│  - Row-Level Security (RLS) Enforced at Data Level          │
│  - Stored Procedures for Atomic Check-In & Reservations     │
└─────────────────────────────────────────────────────────────┘
```

## 2. Key Architectural Decisions

### A. Opaque Token Hashing for Tickets
- Plaintext ticket tokens are never stored in the database.
- A cryptographically secure random token (e.g. `tix_live_...`) is generated using `crypto.randomBytes(24).toString('base64url')`.
- The token is hashed with SHA-256 (`crypto.createHash('sha256').update(token).digest('hex')`) before insertion into `tickets.token_hash`.
- When staff scans the QR code at the gate, the raw token is hashed and matched against `token_hash`.

### B. Atomic Check-In Concurrency Protection
To prevent race conditions where a fraudulent ticket is presented simultaneously at Gate A and Gate B:
```sql
UPDATE tickets
SET status = 'checked_in',
    checked_in_at = NOW(),
    checked_in_by = $staff_user_id
WHERE token_hash = $token_hash
  AND status = 'valid'
RETURNING id, registration_id, ticket_number;
```
If two requests execute concurrently, PostgreSQL's row locking guarantees only one transaction commits the transition from `valid` to `checked_in`. The second request returns zero updated rows and is immediately flagged as `already_used`.

### C. Financial & Ticket Capacity Precision
- Prices are stored as integer minor units (`price_minor BIGINT`) to avoid floating-point rounding errors (e.g. IDR 150,000 = `150000`).
- Database check constraints enforce `sold_count + reserved_count <= capacity`.
