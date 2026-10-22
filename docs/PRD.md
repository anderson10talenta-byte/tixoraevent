# Product Requirements Document (PRD) — Tixora
## Multi-Event & Multi-Organizer Ticketing Platform

### 1. Vision & Executive Summary
Tixora is a multi-organizer event ticketing and attendance platform tailored for modern events, conferences, concerts, and community workshops. Tixora bridges event discovery, frictionless registration for free and paid tiers, high-security QR ticket delivery, mobile camera scanning for venue staff, and authoritative attendance verification.

### 2. Core User Personas
1. **Attendee (Budi):** Searches events, selects ticket tiers, completes registration/checkout, receives digital ticket with secure QR code, accesses tickets from any device, and presents it for entry.
2. **Organizer Owner (Rian):** Creates and edits events, configures capacity and pricing, tracks registration revenue, assigns check-in staff, exports attendee lists to CSV, and reviews check-in percentages.
3. **Check-in Staff (Siti):** Assigned to specific events, scans attendee tickets via mobile browser camera with instant audio/haptic/visual validation, or inputs ticket codes manually under low lighting.
4. **Platform Super Admin (Admin):** Manages organizers, verifies or suspends accounts, monitors platform-wide volume, and inspects immutable audit logs.

### 3. Key Functional Modules
- **Public Discovery:** Responsive homepage with search, categories, featured events, and rich event detail pages.
- **Booking Engine & Inventory:** Atomic capacity reservations, max-tickets enforcement, expiration window (15 mins), and free vs. paid checkout.
- **Cryptographic Ticket Issuance:** Generation of unguessable random tokens, storing ONLY SHA-256 hashes in database, embedding opaque tokens in QR codes.
- **Mobile Check-In System:** Real-time camera QR reader with automatic continuous scanning, throttling, manual code fallback, and atomic database state transitions.
- **Staff Delegation:** Event-specific authorization granting scanning rights without exposing financial or sensitive organizational data.
- **Payment Gateway Webhook Handling:** Idempotent event processing, HMAC signature verification, deduplication against `payment_webhook_events`.
- **Reporting & Export:** Real-time breakdown of tickets issued, checked-in count, remaining attendees, and CSV export.

### 4. Non-Functional & Security Requirements
- **Tenant Isolation:** Organizations cannot view or modify competitor events, orders, or attendee records.
- **Concurrency & Double-Check-In Prevention:** Atomic state transition (`valid` -> `checked_in`) prevents replay or simultaneous multi-gate entry.
- **Zero Sensitive Data in QR:** No PII (names, emails, phones, payment tokens) in the QR code.
- **Locale & Accessibility:** Indonesian primary UI with universal icons, responsive mobile/desktop layout conforming to WCAG AA.
