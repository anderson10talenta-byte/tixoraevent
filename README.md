# Tixora — Multi-Organizer Event Ticketing & Check-In Platform

Tixora is a production-oriented MVP web application for event ticketing, digital QR delivery, mobile camera gate check-in, and multi-tenant organizer management.

## 🚀 Key Features

- **Multi-Organizer Architecture:** Independent organizations with multi-member role hierarchy (Owner, Manager, Assigned Staff).
- **Event Discovery & Public Catalog:** Discover music festivals, tech summits, workshops, and exhibitions with category filters and rich event pages.
- **Booking & Capacity Engine:** Atomic capacity reservation, free instant pass generation, and paid checkout simulation with idempotency.
- **Digital QR Tickets:** Cryptographically secure opaque tokens hashed with SHA-256 before storage. High-contrast QR codes for gate scanning.
- **Mobile Camera Gate Scanner:** Fast real-time camera scanning using `jsqr`, audio/visual validation feedback, manual token fallback, and atomic database state transitions.
- **Double-Entry & Concurrency Prevention:** Enforces single-entry semantics via conditional atomic updates (`status = 'valid' -> 'checked_in'`).
- **Payment Webhook Verification:** Signature checking, deduplication across `payment_webhook_events`, and idempotent ticket issuance.
- **Organizer & Super Admin Portals:** Sales performance, registrant lists, CSV export, staff delegation, and platform audit logs.

## 🛠 Technology Stack

- **Frontend:** React 19, TypeScript (strict mode), Tailwind CSS 4, Lucide Icons, Canvas Confetti.
- **Backend:** Express API, Node.js 22, CSPRNG token generator, SHA-256 hashing.
- **Database Architecture:** PostgreSQL / Supabase with Row Level Security (RLS) migrations and atomic stored procedures.
- **Testing:** Node.js native test runner (`node:test`, `node:assert/strict`) and Playwright browser verification.

## 📁 Repository Structure

```
├── docs/
│   ├── PRD.md                     # Product Requirements Document
│   ├── ARCHITECTURE.md            # System Architecture & Threat Model
│   ├── IMPLEMENTATION_PLAN.md     # Milestones & Checklist
│   ├── SECURITY.md                # Security Hardening & Concurrency Specs
│   └── ACCEPTANCE_TESTS.md        # Test Scenarios & Verification Matrix
├── supabase/
│   ├── migrations/                # PostgreSQL RLS migrations & functions
│   └── seed.sql                   # Realistic development and test seed data
├── src/
│   ├── components/                # Reusable UI (Navbar, Scanner, QR, Badges)
│   ├── lib/                       # Pure logic, validation schemas, token utils
│   ├── pages/                     # Full-featured view pages
│   └── types/                     # Shared TypeScript models
├── server.ts                      # Express API, DB engine & Vite middleware
└── package.json
```

## 🏃 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack dev server (port 3000)
npm run dev

# 3. Run automated tests
npm test

# 4. Compile / Lint
npm run build
npm run lint
```

## 🔑 Demo Personas & Fast Switching

Tixora provides a convenient Role Switcher bar at the top of the application to test the exact experience of all 4 key user roles:
1. **Attendee:** Budi Santoso (`budi@example.com`)
2. **Organizer Owner:** Rian Pratama (`rian@kinarya.id`)
3. **Check-in Staff:** Siti Rahma (`siti.staff@kinarya.id`)
4. **Super Admin:** Administrator (`admin@tixora.id`)
