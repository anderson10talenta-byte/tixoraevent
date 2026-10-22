# Acceptance Tests & Verification Suite — Tixora

## Test Scenarios & Results Matrix

### Suite 1: Authentication & RBAC Isolation
- **TC-1.1:** Anonymous user can view `/` and `/events` without error.
- **TC-1.2:** Attendee can view `/my-tickets` and only see tickets associated with their user profile.
- **TC-1.3:** Organizer A cannot access `/dashboard/events/:id/registrants` belonging to Organizer B. Returns 403 Forbidden.
- **TC-1.4:** Unassigned staff member attempting to check-in to an event receives `unauthorized`.

### Suite 2: Booking Engine & Capacity
- **TC-2.1 (Free Ticket):** Attendee registers for 1 Free Ticket (`price_minor = 0`). Order is created, confirmed immediately, and 1 valid ticket is generated with a unique QR code.
- **TC-2.2 (Paid Ticket):** Attendee books a paid ticket. Order is created with status `pending`. Ticket is NOT issued until verified payment confirmation.
- **TC-2.3 (Capacity Guard):** Total sold + reserved tickets cannot exceed ticket capacity.
- **TC-2.4 (Max per Order):** Attempting to order more than `max_per_order` is rejected by Zod schema and server validation.

### Suite 3: Cryptographic QR Issuance & Check-In Validation
- **TC-3.1 (Token Hashing):** Plaintext QR token is never stored in `tickets.token_hash`. Verification matches SHA-256 hash.
- **TC-3.2 (Valid Check-in):** First scan of a valid ticket succeeds, status changes to `checked_in`, timestamp and staff ID are recorded, check-in log records `success`.
- **TC-3.3 (Reused Ticket):** Second scan of the same ticket fails with `already_used`, log records duplicate attempt, ticket remains `checked_in`.
- **TC-3.4 (Wrong Event):** Valid ticket scanned under an event it was not issued for fails with `wrong_event`.
- **TC-3.5 (Invalid / Tampered Token):** Random string or tampered token fails with `invalid`.
- **TC-3.6 (Concurrency Safety):** Two simultaneous check-in requests for the same ticket result in exactly 1 `success` and 1 `already_used`.

### Suite 4: Payment Webhook Idempotency
- **TC-4.1 (Valid Webhook):** Processing a valid webhook confirms order and generates tickets.
- **TC-4.2 (Duplicate Webhook):** Processing the identical `provider_event_id` returns 200 OK with duplicate ignored, without creating additional tickets.
