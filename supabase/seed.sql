-- Tixora Seed Data for Supabase / Local Development

-- Pre-seeded test user IDs
-- Attendee: 00000000-0000-0000-0000-000000000001
-- Organizer Owner: 00000000-0000-0000-0000-000000000002
-- Check-in Staff: 00000000-0000-0000-0000-000000000003
-- Super Admin: 00000000-0000-0000-0000-000000000004

INSERT INTO profiles (id, full_name, phone, avatar_url, is_super_admin)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Budi Santoso', '+6281234567890', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', FALSE),
    ('00000000-0000-0000-0000-000000000002', 'Rian Pratama', '+6281987654321', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', FALSE),
    ('00000000-0000-0000-0000-000000000003', 'Siti Rahma (Staff)', '+6281122334455', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', FALSE),
    ('00000000-0000-0000-0000-000000000004', 'Administrator Tixora', '+6281000000000', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Organizations
INSERT INTO organizations (id, name, slug, description, contact_email, status, created_by)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Kinarya Creative', 'kinarya-creative', 'Penyelenggara festival musik, pameran seni dan konferensi kreatif nasional.', 'halo@kinarya.id', 'active', '00000000-0000-0000-0000-000000000002'),
    ('22222222-2222-2222-2222-222222222222', 'Nusantara Tech Hub', 'nusantara-tech', 'Komunitas teknologi terbesar di Indonesia, penyelenggara DevCon dan AI Summit.', 'organizer@nusantaratech.id', 'active', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Organization Members
INSERT INTO organization_members (id, organization_id, user_id, role, status)
VALUES 
    ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'owner', 'active'),
    ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'owner', 'active')
ON CONFLICT (id) DO NOTHING;

-- Events
INSERT INTO events (id, organization_id, title, slug, description, category, cover_image_url, venue_name, venue_address, starts_at, ends_at, timezone, sales_starts_at, sales_ends_at, status, created_by)
VALUES 
    (
        '44444444-4444-4444-4444-444444444441',
        '11111111-1111-1111-1111-111111111111',
        'Soundwave Jakarta 2026',
        'soundwave-jakarta-2026',
        'Festival musik indie dan pop terbesar di ibu kota menghadirkan 25+ musisi ternama nusantara dalam panggung spektakuler outdoor.',
        'music',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
        'Gelora Bung Karno Parkir Timur',
        'Jl. Pintu Satu Senayan, Gelora, Jakarta Pusat',
        '2026-11-20 15:00:00+07',
        '2026-11-20 23:30:00+07',
        'Asia/Jakarta',
        '2026-09-01 00:00:00+07',
        '2026-11-19 23:59:59+07',
        'published',
        '00000000-0000-0000-0000-000000000002'
    ),
    (
        '44444444-4444-4444-4444-444444444442',
        '22222222-2222-2222-2222-222222222222',
        'Indonesia AI & Cloud Summit 2026',
        'indonesia-ai-cloud-summit-2026',
        'Konferensi teknologi tingkat tinggi membahas kecerdasan buatan, arsitektur cloud terdistribusi, dan keamanan siber.',
        'technology',
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
        'Jakarta Convention Center (JCC) Assembly Hall',
        'Jl. Gatot Subroto No.1, Tanah Abang, Jakarta Pusat',
        '2026-11-28 09:00:00+07',
        '2026-11-28 17:00:00+07',
        'Asia/Jakarta',
        '2026-09-10 00:00:00+07',
        '2026-11-27 23:59:59+07',
        'published',
        '00000000-0000-0000-0000-000000000002'
    ),
    (
        '44444444-4444-4444-4444-444444444443',
        '11111111-1111-1111-1111-111111111111',
        'Pameran Kopi & Barista Nusantara',
        'pameran-kopi-nusantara',
        'Pameran biji kopi pilihan dari Sabang hingga Merauke, kejuaraan latte art, dan workshop roasting gratis untuk pegiat kopi.',
        'food',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
        'Mall Grand Indonesia Exhibition Hall',
        'Jl. M.H. Thamrin No.1, Jakarta Pusat',
        '2026-12-05 10:00:00+07',
        '2026-12-06 20:00:00+07',
        'Asia/Jakarta',
        '2026-10-01 00:00:00+07',
        '2026-12-04 23:59:59+07',
        'published',
        '00000000-0000-0000-0000-000000000002'
    )
ON CONFLICT (id) DO NOTHING;

-- Ticket Types
INSERT INTO ticket_types (id, event_id, name, description, price_minor, currency, capacity, sold_count, reserved_count, max_per_order, status)
VALUES 
    -- Soundwave
    ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444441', 'Presale Early Bird', 'Akses seluruh panggung & free merchandise pouch', 175000, 'IDR', 500, 1, 0, 4, 'active'),
    ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444441', 'VIP Festival Pass', 'Fast-track entry, VIP lounge area, & free flow mineral water', 450000, 'IDR', 200, 0, 0, 2, 'active'),
    -- AI Summit
    ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444442', 'Community Free Pass', 'Akses keynote session, pameran stan, & sertifikat digital', 0, 'IDR', 1000, 1, 0, 2, 'active'),
    ('55555555-5555-5555-5555-555555555554', '44444444-4444-4444-4444-444444444442', 'Professional All-Access', 'Akses seluruh workshop hands-on, sesi networking lunch & coffee break', 750000, 'IDR', 300, 0, 0, 4, 'active'),
    -- Kopi Expo
    ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444443', 'Tiket Masuk Gratis', 'Tiket masuk umum dan kupon 1x cupping session', 0, 'IDR', 2000, 0, 0, 5, 'active')
ON CONFLICT (id) DO NOTHING;

-- Staff Assignment: Siti Rahma assigned to Soundwave & AI Summit
INSERT INTO event_staff_assignments (id, event_id, user_id, assigned_by, status)
VALUES 
    ('66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'active'),
    ('66666666-6666-6666-6666-666666666662', '44444444-4444-4444-4444-444444444442', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'active')
ON CONFLICT (id) DO NOTHING;

-- Sample Pre-issued Orders and Tickets (with pre-computed SHA-256 tokens)
-- Raw token for demo ticket #1: "tix_demo_soundwave_token_2026_valid"
-- SHA-256 of "tix_demo_soundwave_token_2026_valid" = dae3508a2fb7afa5b0bf028167f79ada11fd6b59db6e0f93d367ffde55ecd464
INSERT INTO orders (id, order_number, attendee_user_id, event_id, subtotal_minor, fees_minor, total_minor, currency, status, expires_at)
VALUES 
    ('77777777-7777-7777-7777-777777777771', 'ORD-2026-SW101', '00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', 175000, 5000, 180000, 'IDR', 'confirmed', NOW() + INTERVAL '1 day'),
    ('77777777-7777-7777-7777-777777777772', 'ORD-2026-AI202', '00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444442', 0, 0, 0, 'IDR', 'confirmed', NOW() + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO registrations (id, order_id, attendee_user_id, event_id, full_name, email, phone, status)
VALUES 
    ('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', '00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', 'Budi Santoso', 'budi@example.com', '+6281234567890', 'confirmed'),
    ('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777772', '00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444442', 'Budi Santoso', 'budi@example.com', '+6281234567890', 'confirmed')
ON CONFLICT (id) DO NOTHING;

-- Sample Ticket 1: Valid Ticket for Soundwave
INSERT INTO tickets (id, registration_id, ticket_type_id, ticket_number, token_hash, status)
VALUES 
    ('99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888881', '55555555-5555-5555-5555-555555555551', 'TIX-SW-00892', 'dae3508a2fb7afa5b0bf028167f79ada11fd6b59db6e0f93d367ffde55ecd464', 'valid'),
    ('99999999-9999-9999-9999-999999999992', '88888888-8888-8888-8888-888888888882', '55555555-5555-5555-5555-555555555553', 'TIX-AI-00104', '3168fe7d34d3aa5408eb107122e0388901eb2c648dc8bbf14a2aa44c0fd2c5a0', 'valid')
ON CONFLICT (id) DO NOTHING;
