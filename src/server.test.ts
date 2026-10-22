import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server.ts';

test('Integration: db.createBooking issues confirmed tickets for free tier', async () => {
  const attendeeId = '00000000-0000-0000-0000-000000000001';
  const eventId = '44444444-4444-4444-4444-444444444442'; // AI Summit
  const freeTicketTypeId = '55555555-5555-5555-5555-555555555553'; // Community Free Pass

  const result = await db.createBooking(
    attendeeId,
    eventId,
    freeTicketTypeId,
    1,
    'Tes Integrasi Attendee',
    'tes.attendee@example.com',
    '+6281299998888'
  );

  assert.equal(result.isFree, true);
  assert.equal(result.order.status, 'confirmed');
  assert.equal(result.tickets.length, 1);
  assert.ok(result.tickets[0].rawToken?.startsWith('tix_live_'));
  assert.equal(result.tickets[0].status, 'valid');
});

test('Integration: performAtomicCheckIn accepts valid ticket once and rejects second scan', async () => {
  const staffUserId = '00000000-0000-0000-0000-000000000003'; // Siti Rahma (Staff)
  const eventId = '44444444-4444-4444-4444-444444444442'; // AI Summit
  const freeTicketTypeId = '55555555-5555-5555-5555-555555555553';

  // Book a fresh ticket
  const booking = await db.createBooking(
    '00000000-0000-0000-0000-000000000001',
    eventId,
    freeTicketTypeId,
    1,
    'Siti Gate Test',
    'gate.test@example.com',
    '+6281200001111'
  );

  const rawToken = booking.tickets[0].rawToken!;

  // Scan 1: Must succeed
  const scan1 = await db.performAtomicCheckIn(eventId, rawToken, staffUserId);
  assert.equal(scan1.result, 'success');
  assert.equal(scan1.allowed, true);

  // Scan 2: Must be already_used
  const scan2 = await db.performAtomicCheckIn(eventId, rawToken, staffUserId);
  assert.equal(scan2.result, 'already_used');
  assert.equal(scan2.allowed, false);
});

test('Integration: Concurrency Protection — two simultaneous scans produce exactly 1 success and 1 duplicate rejection', async () => {
  const staffUserId = '00000000-0000-0000-0000-000000000003';
  const eventId = '44444444-4444-4444-4444-444444444442';
  const freeTicketTypeId = '55555555-5555-5555-5555-555555555553';

  // Book a fresh ticket
  const booking = await db.createBooking(
    '00000000-0000-0000-0000-000000000001',
    eventId,
    freeTicketTypeId,
    1,
    'Concurrent Gate Test',
    'concurrent@example.com',
    '+6281200002222'
  );

  const rawToken = booking.tickets[0].rawToken!;

  // Fire 2 concurrent check-in promises simultaneously
  const [resA, resB] = await Promise.all([
    db.performAtomicCheckIn(eventId, rawToken, staffUserId),
    db.performAtomicCheckIn(eventId, rawToken, staffUserId),
  ]);

  const results = [resA.result, resB.result].sort();
  assert.deepEqual(
    results,
    ['already_used', 'success'],
    'Exactly one scan must succeed and one must be marked already_used'
  );
});

test('Integration: Unassigned staff or wrong event is rejected', async () => {
  const unassignedStaffId = '00000000-0000-0000-0000-000000000001'; // Budi is attendee, not staff
  const eventId = '44444444-4444-4444-4444-444444444441';

  const check = await db.performAtomicCheckIn(
    eventId,
    'tix_demo_soundwave_token_2026_valid',
    unassignedStaffId
  );
  assert.equal(check.result, 'unauthorized');
});
