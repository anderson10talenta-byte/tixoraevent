import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateSecureTicketToken, hashTicketToken, generateTicketNumber, verifyWebhookSignature } from './security.ts';
import { validateCapacity, calculateOrderPricing, formatCurrencyIDR } from './capacity.ts';
import { evaluateCheckIn } from './checkin.ts';
import type { Ticket, EventStaffAssignment } from './types.ts';

test('Security: generateSecureTicketToken produces high-entropy opaque tokens', () => {
  const token1 = generateSecureTicketToken();
  const token2 = generateSecureTicketToken();

  assert.ok(token1.startsWith('tix_live_'), 'Token should have tix_live_ prefix');
  assert.ok(token1.length >= 35, 'Token should have sufficient length');
  assert.notEqual(token1, token2, 'Two generated tokens must be distinct');
});

test('Security: hashTicketToken produces deterministic SHA-256 hex string', () => {
  const token = 'tix_demo_soundwave_token_2026_valid';
  const expectedHash = 'dae3508a2fb7afa5b0bf028167f79ada11fd6b59db6e0f93d367ffde55ecd464';
  
  const hash = hashTicketToken(token);
  assert.equal(hash, expectedHash, 'Hash must match precomputed SHA-256');
  
  // Trimming check
  assert.equal(hashTicketToken(`  ${token}  `), expectedHash, 'Hash should trim whitespace');
  assert.notEqual(hashTicketToken('different_token'), expectedHash);
});

test('Security: generateTicketNumber formats clean sequential ticket code', () => {
  assert.equal(generateTicketNumber('Soundwave', 42), 'TIX-SOUN-00042');
  assert.equal(generateTicketNumber('AI-Summit-2026', 1), 'TIX-AISU-00001');
});

test('Security: verifyWebhookSignature validates authentic HMAC-SHA256 signature', () => {
  const payload = JSON.stringify({ orderId: 'ord-123', status: 'PAID' });
  const secret = 'super-secret-webhook-key-2026';
  
  const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  
  assert.equal(verifyWebhookSignature(payload, validSignature, secret), true, 'Valid signature must pass');
  assert.equal(verifyWebhookSignature(payload, 'tampered-signature', secret), false, 'Invalid signature must fail');
  assert.equal(verifyWebhookSignature('{"tampered":true}', validSignature, secret), false, 'Tampered payload must fail');
});

test('Capacity: validateCapacity prevents overselling', () => {
  // Capacity: 100, Sold: 95, Reserved: 3 -> Remaining: 2
  const check1 = validateCapacity(100, 95, 3, 2);
  assert.equal(check1.valid, true);
  assert.equal(check1.remaining, 0);

  // Exceeds remaining
  const check2 = validateCapacity(100, 95, 3, 3);
  assert.equal(check2.valid, false);
  assert.equal(check2.remaining, 2);

  // Zero quantity invalid
  const check3 = validateCapacity(100, 50, 0, 0);
  assert.equal(check3.valid, false);
});

test('Pricing: calculateOrderPricing handles free and paid orders correctly', () => {
  // Free ticket order
  const freePricing = calculateOrderPricing([{ unitPriceMinor: 0, quantity: 2 }]);
  assert.equal(freePricing.isFree, true);
  assert.equal(freePricing.subtotalMinor, 0);
  assert.equal(freePricing.feesMinor, 0);
  assert.equal(freePricing.totalMinor, 0);

  // Paid ticket order: IDR 150,000 x 2 = 300,000 + 5,000 fee = 305,000
  const paidPricing = calculateOrderPricing([{ unitPriceMinor: 150000, quantity: 2 }]);
  assert.equal(paidPricing.isFree, false);
  assert.equal(paidPricing.subtotalMinor, 300000);
  assert.equal(paidPricing.feesMinor, 5000);
  assert.equal(paidPricing.totalMinor, 305000);
});

test('Pricing: formatCurrencyIDR formats Indonesian Rupiah representation', () => {
  assert.equal(formatCurrencyIDR(0), 'Gratis');
  const formatted = formatCurrencyIDR(150000);
  assert.ok(formatted.includes('150.000') || formatted.includes('150,000'), 'Should contain 150.000');
});

test('Check-In: evaluateCheckIn verifies all state transitions', () => {
  const eventA = 'event-uuid-a';
  const eventB = 'event-uuid-b';
  const staffId = 'staff-user-1';
  
  const staffAssignments: EventStaffAssignment[] = [
    { id: 'sa-1', eventId: eventA, userId: staffId, status: 'active', createdAt: '' }
  ];

  const validTicket: Ticket = {
    id: 'tix-1',
    registrationId: 'reg-1',
    ticketTypeId: 'tt-1',
    eventId: eventA,
    ticketNumber: 'TIX-A-00001',
    tokenHash: 'samplehash',
    status: 'valid',
    issuedAt: '',
    createdAt: '',
  };

  // Case 1: Success check-in
  const r1 = evaluateCheckIn({
    targetEventId: eventA,
    staffUserId: staffId,
    isSuperAdmin: false,
    staffAssignments,
    ticket: validTicket,
    ticketBelongsToEventId: eventA,
    orderPaidOrFree: true,
  });
  assert.equal(r1.result, 'success');
  assert.equal(r1.allowed, true);

  // Case 2: Already used ticket
  const usedTicket: Ticket = { ...validTicket, status: 'checked_in', checkedInAt: '2026-10-15 10:00:00' };
  const r2 = evaluateCheckIn({
    targetEventId: eventA,
    staffUserId: staffId,
    isSuperAdmin: false,
    staffAssignments,
    ticket: usedTicket,
    ticketBelongsToEventId: eventA,
    orderPaidOrFree: true,
  });
  assert.equal(r2.result, 'already_used');
  assert.equal(r2.allowed, false);

  // Case 3: Wrong event
  const r3 = evaluateCheckIn({
    targetEventId: eventA,
    staffUserId: staffId,
    isSuperAdmin: false,
    staffAssignments,
    ticket: validTicket,
    ticketBelongsToEventId: eventB, // Belongs to event B!
    orderPaidOrFree: true,
  });
  assert.equal(r3.result, 'wrong_event');
  assert.equal(r3.allowed, false);

  // Case 4: Unpaid ticket
  const r4 = evaluateCheckIn({
    targetEventId: eventA,
    staffUserId: staffId,
    isSuperAdmin: false,
    staffAssignments,
    ticket: validTicket,
    ticketBelongsToEventId: eventA,
    orderPaidOrFree: false,
  });
  assert.equal(r4.result, 'unpaid');
  assert.equal(r4.allowed, false);

  // Case 5: Cancelled ticket
  const cancelledTicket: Ticket = { ...validTicket, status: 'cancelled' };
  const r5 = evaluateCheckIn({
    targetEventId: eventA,
    staffUserId: staffId,
    isSuperAdmin: false,
    staffAssignments,
    ticket: cancelledTicket,
    ticketBelongsToEventId: eventA,
    orderPaidOrFree: true,
  });
  assert.equal(r5.result, 'cancelled');
  assert.equal(r5.allowed, false);

  // Case 6: Unauthorized staff
  const r6 = evaluateCheckIn({
    targetEventId: eventB, // Staff is not assigned to Event B
    staffUserId: staffId,
    isSuperAdmin: false,
    staffAssignments,
    ticket: validTicket,
    ticketBelongsToEventId: eventB,
    orderPaidOrFree: true,
  });
  assert.equal(r6.result, 'unauthorized');
  assert.equal(r6.allowed, false);

  // Case 7: Invalid / missing token
  const r7 = evaluateCheckIn({
    targetEventId: eventA,
    staffUserId: staffId,
    isSuperAdmin: false,
    staffAssignments,
    ticket: null,
    ticketBelongsToEventId: eventA,
    orderPaidOrFree: true,
  });
  assert.equal(r7.result, 'invalid');
  assert.equal(r7.allowed, false);
});
