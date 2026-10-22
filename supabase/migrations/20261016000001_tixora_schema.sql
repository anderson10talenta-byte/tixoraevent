-- TIXORA: Multi-Event & Multi-Organizer Ticketing Platform Schema
-- Supabase PostgreSQL Migration with RLS and Atomic Functions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    contact_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 4. EVENTS
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'technology',
    cover_image_url TEXT,
    venue_name TEXT NOT NULL,
    venue_address TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    sales_starts_at TIMESTAMPTZ NOT NULL,
    sales_ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, slug),
    CONSTRAINT valid_event_dates CHECK (ends_at > starts_at),
    CONSTRAINT valid_sales_dates CHECK (sales_ends_at > sales_starts_at)
);

-- 5. TICKET TYPES
CREATE TABLE IF NOT EXISTS ticket_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_minor BIGINT NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
    reserved_count INTEGER NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
    sales_starts_at TIMESTAMPTZ,
    sales_ends_at TIMESTAMPTZ,
    max_per_order INTEGER NOT NULL DEFAULT 5 CHECK (max_per_order > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT capacity_not_exceeded CHECK (sold_count + reserved_count <= capacity)
);

-- 6. ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    attendee_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    subtotal_minor BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
    fees_minor BIGINT NOT NULL DEFAULT 0 CHECK (fees_minor >= 0),
    total_minor BIGINT NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'refunded')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
    line_total_minor BIGINT NOT NULL CHECK (line_total_minor >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. REGISTRATIONS
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    attendee_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    registration_data JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TICKETS
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
    ticket_number TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of opaque token, NEVER plaintext
    status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('pending', 'valid', 'cancelled', 'checked_in', 'refunded')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_reference TEXT NOT NULL UNIQUE,
    amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PAYMENT WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'processed' CHECK (processing_status IN ('received', 'processed', 'failed', 'ignored')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    UNIQUE(provider, provider_event_id)
);

-- 12. EVENT STAFF ASSIGNMENTS
CREATE TABLE IF NOT EXISTS event_staff_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- 13. CHECK-IN LOGS
CREATE TABLE IF NOT EXISTS check_in_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    checked_in_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    result TEXT NOT NULL CHECK (result IN ('success', 'already_used', 'invalid', 'cancelled', 'unpaid', 'wrong_event')),
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scanner_metadata JSONB DEFAULT '{}'::jsonb
);

-- 14. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(attendee_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_event ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_order ON registrations(order_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_token_hash ON tickets(token_hash);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_staff_assignment ON event_staff_assignments(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_check_in_logs_event ON check_in_logs(event_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND is_super_admin = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_org_member(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = org_id AND user_id = user_id AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_event_staff(evt_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM event_staff_assignments 
        WHERE event_id = evt_id AND user_id = user_id AND status = 'active'
    ) OR EXISTS (
        SELECT 1 FROM events e
        JOIN organization_members om ON e.organization_id = om.organization_id
        WHERE e.id = evt_id AND om.user_id = user_id AND om.status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS POLICIES

-- Profiles: Users can view and edit their own profile; Super Admins can view all
CREATE POLICY profiles_select_self ON profiles FOR SELECT USING (auth.uid() = id OR is_super_admin(auth.uid()));
CREATE POLICY profiles_update_self ON profiles FOR UPDATE USING (auth.uid() = id);

-- Organizations: Public can view active organizations; Members and Super Admins can manage
CREATE POLICY org_select_public ON organizations FOR SELECT USING (status = 'active' OR is_org_member(id, auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY org_insert_auth ON organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY org_update_members ON organizations FOR UPDATE USING (is_org_member(id, auth.uid()) OR is_super_admin(auth.uid()));

-- Events: Public can view published events from active orgs
CREATE POLICY events_select_public ON events FOR SELECT USING (
    status = 'published' 
    OR is_org_member(organization_id, auth.uid()) 
    OR is_event_staff(id, auth.uid()) 
    OR is_super_admin(auth.uid())
);
CREATE POLICY events_modify_org ON events FOR ALL USING (
    is_org_member(organization_id, auth.uid()) OR is_super_admin(auth.uid())
);

-- Ticket Types: Visible to public for published events
CREATE POLICY ticket_types_select ON ticket_types FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = ticket_types.event_id AND events.status = 'published')
    OR EXISTS (SELECT 1 FROM events WHERE events.id = ticket_types.event_id AND is_org_member(events.organization_id, auth.uid()))
);
CREATE POLICY ticket_types_modify ON ticket_types FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = ticket_types.event_id AND is_org_member(events.organization_id, auth.uid()))
);

-- Orders: Attendees see their own orders; Organizers see orders for their events
CREATE POLICY orders_select ON orders FOR SELECT USING (
    attendee_user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM events WHERE events.id = orders.event_id AND is_org_member(events.organization_id, auth.uid()))
    OR is_super_admin(auth.uid())
);

-- Tickets: Attendees see their own tickets; Assigned Staff see minimum details
CREATE POLICY tickets_select ON tickets FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM registrations r 
        WHERE r.id = tickets.registration_id AND r.attendee_user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM registrations r
        JOIN events e ON r.event_id = e.id
        WHERE r.id = tickets.registration_id AND (is_event_staff(e.id, auth.uid()) OR is_super_admin(auth.uid()))
    )
);

-- ATOMIC STORED PROCEDURE: CHECK-IN VALIDATION
CREATE OR REPLACE FUNCTION perform_atomic_check_in(
    p_event_id UUID,
    p_token_hash TEXT,
    p_staff_user_id UUID,
    p_scanner_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    result TEXT,
    ticket_number TEXT,
    full_name TEXT,
    ticket_type_name TEXT,
    scanned_at TIMESTAMPTZ
) AS $$
DECLARE
    v_ticket RECORD;
    v_event RECORD;
    v_order RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Check if staff is authorized
    IF NOT is_event_staff(p_event_id, p_staff_user_id) AND NOT is_super_admin(p_staff_user_id) THEN
        INSERT INTO check_in_logs (event_id, checked_in_by, result, scanned_at, scanner_metadata)
        VALUES (p_event_id, p_staff_user_id, 'unauthorized', v_now, p_scanner_metadata);
        RETURN QUERY SELECT 'unauthorized'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_now;
        RETURN;
    END IF;

    -- 2. Lookup ticket by token hash with row lock
    SELECT t.id, t.ticket_number, t.status, t.registration_id, t.ticket_type_id, r.event_id, r.full_name, r.order_id, tt.name as tt_name
    INTO v_ticket
    FROM tickets t
    JOIN registrations r ON t.registration_id = r.id
    JOIN ticket_types tt ON t.ticket_type_id = tt.id
    WHERE t.token_hash = p_token_hash
    FOR UPDATE OF t;

    IF NOT FOUND THEN
        INSERT INTO check_in_logs (event_id, checked_in_by, result, scanned_at, scanner_metadata)
        VALUES (p_event_id, p_staff_user_id, 'invalid', v_now, p_scanner_metadata);
        RETURN QUERY SELECT 'invalid'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_now;
        RETURN;
    END IF;

    -- 3. Verify event matches
    IF v_ticket.event_id <> p_event_id THEN
        INSERT INTO check_in_logs (ticket_id, event_id, checked_in_by, result, scanned_at, scanner_metadata)
        VALUES (v_ticket.id, p_event_id, p_staff_user_id, 'wrong_event', v_now, p_scanner_metadata);
        RETURN QUERY SELECT 'wrong_event'::TEXT, v_ticket.ticket_number, NULL::TEXT, NULL::TEXT, v_now;
        RETURN;
    END IF;

    -- 4. Check status
    IF v_ticket.status = 'checked_in' THEN
        INSERT INTO check_in_logs (ticket_id, event_id, checked_in_by, result, scanned_at, scanner_metadata)
        VALUES (v_ticket.id, p_event_id, p_staff_user_id, 'already_used', v_now, p_scanner_metadata);
        RETURN QUERY SELECT 'already_used'::TEXT, v_ticket.ticket_number, v_ticket.full_name, v_ticket.tt_name, v_now;
        RETURN;
    END IF;

    IF v_ticket.status = 'cancelled' OR v_ticket.status = 'refunded' THEN
        INSERT INTO check_in_logs (ticket_id, event_id, checked_in_by, result, scanned_at, scanner_metadata)
        VALUES (v_ticket.id, p_event_id, p_staff_user_id, 'cancelled', v_now, p_scanner_metadata);
        RETURN QUERY SELECT 'cancelled'::TEXT, v_ticket.ticket_number, v_ticket.full_name, v_ticket.tt_name, v_now;
        RETURN;
    END IF;

    -- 5. Atomically commit check-in
    UPDATE tickets
    SET status = 'checked_in',
        checked_in_at = v_now,
        checked_in_by = p_staff_user_id
    WHERE id = v_ticket.id AND status = 'valid';

    IF NOT FOUND THEN
        -- Concurrency collision
        INSERT INTO check_in_logs (ticket_id, event_id, checked_in_by, result, scanned_at, scanner_metadata)
        VALUES (v_ticket.id, p_event_id, p_staff_user_id, 'already_used', v_now, p_scanner_metadata);
        RETURN QUERY SELECT 'already_used'::TEXT, v_ticket.ticket_number, v_ticket.full_name, v_ticket.tt_name, v_now;
        RETURN;
    END IF;

    -- Record successful log
    INSERT INTO check_in_logs (ticket_id, event_id, checked_in_by, result, scanned_at, scanner_metadata)
    VALUES (v_ticket.id, p_event_id, p_staff_user_id, 'success', v_now, p_scanner_metadata);

    RETURN QUERY SELECT 'success'::TEXT, v_ticket.ticket_number, v_ticket.full_name, v_ticket.tt_name, v_now;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
