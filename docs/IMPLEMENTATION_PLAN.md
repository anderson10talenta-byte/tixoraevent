# Implementation Plan — Tixora

## Execution Phases & Milestones

### Phase 1 — Repository & Infrastructure (Completed)
- [x] Inspect existing repo structure, configure dependencies (`qrcode`, `jsqr`, `zod`, `cookie`).
- [x] Setup Tailwind CSS and typography (`Plus Jakarta Sans`, `JetBrains Mono`).
- [x] Configure `metadata.json` with camera permission and sync `index.html`.
- [x] Prepare Supabase PostgreSQL migration (`supabase/migrations/20261016000001_tixora_schema.sql`) and seed data (`supabase/seed.sql`).

### Phase 2 — Authentication & Multi-Tenant Authorization
- [x] Session cookie and token handling.
- [x] Fast role switching for testing: Attendee, Organizer Owner, Check-in Staff, Super Admin.
- [x] Role-Based Access Control (RBAC) middleware for all API routes.
- [x] Tenant data isolation between organizations.

### Phase 3 — Public Event Discovery & Catalog
- [x] Responsive Hero, Search, Category Filter (`all`, `music`, `technology`, `food`, etc.).
- [x] Event Cards with date badge, price badge, venue, and organizer details.
- [x] Public Event detail page (`/events/:orgSlug/:eventSlug`) with ticket tiers, sales progress, and venue maps/info.
- [x] Organization public profiles (`/organizations/:slug`).

### Phase 4 — Booking Engine & Capacity Management
- [x] Atomic ticket reservation and capacity validation.
- [x] Enforce maximum tickets per order.
- [x] Order creation with unique human-readable order number (e.g. `ORD-2026-XXXXX`).
- [x] Free ticket instantaneous confirmation.
- [x] Paid checkout simulation with sandbox / payment provider abstraction.

### Phase 5 — Digital Ticket Issuance & Cryptographic QR
- [x] Generate cryptographically secure random token (CSPRNG).
- [x] Store ONLY SHA-256 hash in database (`tickets.token_hash`).
- [x] Render high-contrast QR code with embedded token URL/code.
- [x] Attendee `/my-tickets` and single ticket view with print / save capability.

### Phase 6 — Mobile Camera QR Scanner & Atomic Check-In
- [x] Real-time video camera stream with `jsqr` barcode decoding.
- [x] Event assignment authorization: check that scanner user is assigned to event.
- [x] Manual ticket code entry fallback for low-light or damaged screens.
- [x] Audio/haptic feedback and high-visibility status screens (Success, Reused, Invalid, Wrong Event).
- [x] Immediate check-in count increment.

### Phase 7 — Organizer & Super Admin Dashboards
- [x] Organizer dashboard with sales overview, revenue, tickets issued, and check-in percentage.
- [x] Event creator and editor with ticket tier manager.
- [x] Registrants table with CSV export.
- [x] Event staff assignment management (assign/revoke staff by email).
- [x] Platform Super Admin portal with organization audit and event status controls.

### Phase 8 — Automated Testing & Verification
- [x] Node test runner suite (`node --test`) for pure logic (hashing, capacity, check-in state machine, webhook verification).
- [x] Visual and functional browser verification using `playwright-cli`.
