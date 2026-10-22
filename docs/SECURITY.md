# Security Specification — Tixora

## 1. Threat Model & Mitigations

### Threat 1: QR Ticket Forgery or Guessing
- **Risk:** Malicious actors attempt to iterate sequential IDs or predict QR code values.
- **Mitigation:**
  - Ticket tokens are generated with 192 bits of entropy via `crypto.randomBytes(24)`.
  - Database stores ONLY the 256-bit SHA-256 hash.
  - An attacker with read-only database access cannot reverse the token to produce valid QR codes.
  - Zero PII (name, phone, credit card) is stored in the QR code payload.

### Threat 2: Double-Entry / Replay Attack at Venue Gates
- **Risk:** An attendee sends a screenshot of their QR code to friends, and they attempt to enter through different gates simultaneously.
- **Mitigation:**
  - Atomic database conditional update:
    ```sql
    UPDATE tickets SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = $1
    WHERE token_hash = $2 AND status = 'valid';
    ```
  - Only 1 database transaction can succeed. Subsequent or concurrent attempts immediately fail with `already_used` and log the audit entry.

### Threat 3: Cross-Tenant Data Leakage (Organizers)
- **Risk:** Organizer A manipulates request parameters to view Organizer B's financial records, ticket sales, or attendee rosters.
- **Mitigation:**
  - Server-side authorization checks query the user's active membership in `organization_members`.
  - Supabase RLS policies enforce isolation directly at the database engine level.
  - Public endpoints only expose published events; draft and internal metrics require verified membership.

### Threat 4: Unauthorized Staff Privilege Escalation
- **Risk:** A temporary check-in volunteer attempts to view event gross revenue, edit ticket pricing, or issue refunds.
- **Mitigation:**
  - Check-in staff are only granted access to `POST /api/check-in` and minimal attendee identification for verification (name + ticket type name).
  - Staff assignments are event-scoped in `event_staff_assignments`.
  - Financial dashboards and exports are restricted strictly to `owner` and `manager` roles.

### Threat 5: Webhook Replay & Fraud
- **Risk:** Malicious actor replays a payment webhook to generate free tickets or manipulate orders.
- **Mitigation:**
  - Webhooks enforce HMAC signature verification (`X-Signature` or provider header).
  - Webhook IDs are recorded in `payment_webhook_events` with a UNIQUE constraint (`provider, provider_event_id`).
  - Ticket issuance executes inside an idempotent handler that checks if the order is already confirmed.
