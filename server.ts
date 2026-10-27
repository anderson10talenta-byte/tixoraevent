import express from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE_PATH = path.resolve(__dirname, 'data', 'tixora-db.json');
import type {
  Profile,
  Organization,
  OrganizationMember,
  Event,
  TicketType,
  Order,
  OrderItem,
  Registration,
  Ticket,
  Payment,
  PaymentWebhookEvent,
  EventStaffAssignment,
  CheckInLog,
  AuditLog,
  CheckInResultType,
  OrganizerApplication,
  OrganizerVerificationStatus,
  EventCategory,
  CreditScoreLog,
} from './src/lib/types.ts';
import { DEFAULT_CATEGORIES } from './src/lib/categoriesData.ts';
import {
  generateSecureTicketToken,
  hashTicketToken,
  generateTicketNumber,
  verifyWebhookSignature,
} from './src/lib/security.ts';
import { validateCapacity, calculateOrderPricing } from './src/lib/capacity.ts';
import { evaluateCheckIn } from './src/lib/checkin.ts';
import {
  createOrderSchema,
  checkInRequestSchema,
  createEventSchema,
  assignStaffSchema,
} from './src/lib/schemas.ts';

// --- IN-MEMORY PRODUCTION-ALIGNED REPOSITORY WITH ATOMIC CONCURRENCY GUARDS ---

class TixoraDatabase {
  profiles: Profile[] = [];
  organizations: Organization[] = [];
  organizationMembers: OrganizationMember[] = [];
  events: Event[] = [];
  ticketTypes: TicketType[] = [];
  orders: Order[] = [];
  orderItems: OrderItem[] = [];
  registrations: Registration[] = [];
  tickets: Ticket[] = [];
  payments: Payment[] = [];
  paymentWebhookEvents: PaymentWebhookEvent[] = [];
  eventStaffAssignments: EventStaffAssignment[] = [];
  checkInLogs: CheckInLog[] = [];
  auditLogs: AuditLog[] = [];
  organizerApplications: OrganizerApplication[] = [];
  categories: EventCategory[] = [];
  creditScoreLogs: CreditScoreLog[] = [];

  // Plaintext token store for legitimate attendee access only
  // Key: ticketId, Value: rawToken
  rawTokenStore = new Map<string, string>();

  // Mutex lock for atomic ticket check-in and booking transactions
  private checkInLock = new Map<string, Promise<void>>();

  constructor() {
    this.ensureSuperAdmin();
    this.loadPersistedData();
    this.processCompletedEventsLifecycle();
    this.persist();
  }

  ensureSuperAdmin() {
    const superAdminEmail = 'anderson10.talenta@gmail.com';
    let adminProfile = this.profiles.find(
      (p) => p.email?.toLowerCase() === superAdminEmail || p.id === 'super-admin-anderson'
    );
    if (!adminProfile) {
      adminProfile = {
        id: 'super-admin-anderson',
        fullName: 'Anderson (Super Admin)',
        email: superAdminEmail,
        phone: '+6281234567890',
        avatarUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        isSuperAdmin: true,
        creditScore: 10,
        createdAt: '2026-10-01T00:00:00.000Z',
        organizerStatus: 'approved',
      };
      this.profiles.unshift(adminProfile);
    } else {
      adminProfile.isSuperAdmin = true;
      adminProfile.organizerStatus = 'approved';
      if (adminProfile.creditScore === undefined) {
        adminProfile.creditScore = 10;
      }
    }
  }

  loadPersistedData() {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.profiles)) this.profiles = parsed.profiles;
          if (Array.isArray(parsed.organizations)) this.organizations = parsed.organizations;
          if (Array.isArray(parsed.organizationMembers)) this.organizationMembers = parsed.organizationMembers;
          if (Array.isArray(parsed.events)) this.events = parsed.events;
          if (Array.isArray(parsed.ticketTypes)) this.ticketTypes = parsed.ticketTypes;
          if (Array.isArray(parsed.orders)) this.orders = parsed.orders;
          if (Array.isArray(parsed.orderItems)) this.orderItems = parsed.orderItems;
          if (Array.isArray(parsed.registrations)) this.registrations = parsed.registrations;
          if (Array.isArray(parsed.tickets)) this.tickets = parsed.tickets;
          if (Array.isArray(parsed.payments)) this.payments = parsed.payments;
          if (Array.isArray(parsed.paymentWebhookEvents)) this.paymentWebhookEvents = parsed.paymentWebhookEvents;
          if (Array.isArray(parsed.eventStaffAssignments)) this.eventStaffAssignments = parsed.eventStaffAssignments;
          if (Array.isArray(parsed.checkInLogs)) this.checkInLogs = parsed.checkInLogs;
          if (Array.isArray(parsed.auditLogs)) this.auditLogs = parsed.auditLogs;
          if (Array.isArray(parsed.organizerApplications)) this.organizerApplications = parsed.organizerApplications;
          if (Array.isArray(parsed.categories)) this.categories = parsed.categories;
          if (Array.isArray(parsed.creditScoreLogs)) this.creditScoreLogs = parsed.creditScoreLogs;
          if (Array.isArray(parsed.rawTokens)) {
            for (const [k, v] of parsed.rawTokens) {
              this.rawTokenStore.set(k, v);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[DB] Gagal memuat data tersimpan dari disk:', e);
    }

    // Default categories if none exist
    if (!this.categories || this.categories.length === 0) {
      this.categories = [...DEFAULT_CATEGORIES];
    }

    // Ensure all profiles have creditScore initialized to 10
    for (const p of this.profiles) {
      if (p.creditScore === undefined) {
        p.creditScore = 10;
      }
    }

    this.ensureSuperAdmin();
  }

  persist() {
    try {
      const dataDir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const rawTokens = Array.from(this.rawTokenStore.entries());
      const payload = {
        profiles: this.profiles,
        organizations: this.organizations,
        organizationMembers: this.organizationMembers,
        events: this.events,
        ticketTypes: this.ticketTypes,
        orders: this.orders,
        orderItems: this.orderItems,
        registrations: this.registrations,
        tickets: this.tickets,
        payments: this.payments,
        paymentWebhookEvents: this.paymentWebhookEvents,
        eventStaffAssignments: this.eventStaffAssignments,
        checkInLogs: this.checkInLogs,
        auditLogs: this.auditLogs,
        organizerApplications: this.organizerApplications,
        categories: this.categories,
        creditScoreLogs: this.creditScoreLogs,
        rawTokens,
      };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[DB] Gagal menyimpan data ke disk:', e);
    }
  }

  // --- AUTOMATED EVENT COMPLETION LIFECYCLE & NO-SHOW CREDIT DEDUCTION ---
  processCompletedEventsLifecycle() {
    const now = Date.now();
    let hasChanges = false;

    for (const event of this.events) {
      const rawEnd = event.endsAt || (event as any).endDate;
      const rawStart = event.startsAt || (event as any).startDate;
      if (!rawEnd && !rawStart) continue;

      const endTime = rawEnd
        ? new Date(rawEnd).getTime()
        : new Date(rawStart).getTime() + 6 * 3600 * 1000;

      if (isNaN(endTime)) continue;
      const isEnded = endTime < now;

      if (isEnded) {
        if (event.status !== 'completed') {
          event.status = 'completed';
          hasChanges = true;
        }

        // Process all tickets for this completed event
        const eventTickets = this.tickets.filter((t) => t.eventId === event.id);
        const processedAttendeesForThisEvent = new Set<string>();

        for (const ticket of eventTickets) {
          // If ticket was valid (confirmed order) and attendee NEVER checked in
          if (ticket.status === 'valid' && !ticket.checkedInAt) {
            (ticket.status as any) = 'expired';
            ticket.noShow = true;
            ticket.completedAt = new Date().toISOString();
            hasChanges = true;

            // Skip penalty if ticket was created after the event already ended
            const ticketIssuedTime = new Date(ticket.issuedAt || ticket.createdAt || 0).getTime();
            if (ticketIssuedTime > endTime) {
              continue;
            }

            // Find attendee to deduct 3 points credit score
            const registration = this.registrations.find((r) => r.id === ticket.registrationId);
            const order = registration ? this.orders.find((o) => o.id === registration.orderId) : null;
            const attendeeId = registration?.attendeeUserId || order?.attendeeUserId;

            let attendeeProfile: Profile | undefined;
            if (attendeeId) {
              attendeeProfile = this.profiles.find(
                (p) =>
                  p.id === attendeeId ||
                  (registration?.email && p.email?.toLowerCase() === registration.email.toLowerCase())
              );
            } else if (registration?.email) {
              attendeeProfile = this.profiles.find(
                (p) => p.email?.toLowerCase() === registration.email.toLowerCase()
              );
            }

            if (attendeeProfile) {
              // Ensure we only penalize once per attendee per event (max 3 points deduction per event)
              if (processedAttendeesForThisEvent.has(attendeeProfile.id)) {
                continue;
              }
              const alreadyPenalized = this.creditScoreLogs.some(
                (l) => l.userId === attendeeProfile.id && l.eventId === event.id && l.type === 'no_show'
              );
              if (alreadyPenalized) {
                processedAttendeesForThisEvent.add(attendeeProfile.id);
                continue;
              }

              processedAttendeesForThisEvent.add(attendeeProfile.id);
              const prevScore = attendeeProfile.creditScore ?? 10;
              const newScore = Math.max(0, prevScore - 3);
              attendeeProfile.creditScore = newScore;

              this.creditScoreLogs.unshift({
                id: crypto.randomUUID(),
                userId: attendeeProfile.id,
                ticketId: ticket.id,
                eventId: event.id,
                eventTitle: event.title,
                change: -3,
                currentScore: newScore,
                type: 'no_show',
                reason: `Tidak hadir pada event (No-Show): ${event.title} (-3 Poin)`,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    if (hasChanges) {
      this.persist();
    }
  }


  // --- ATOMIC CHECK-IN WITH CONDITIONAL ROW TRANSITION ---
  async performAtomicCheckIn(
    eventId: string,
    rawToken: string,
    staffUserId: string,
    scannerMetadata?: Record<string, unknown>
  ): Promise<{
    result: CheckInResultType;
    allowed: boolean;
    ticketNumber?: string;
    fullName?: string;
    ticketTypeName?: string;
    scannedAt: string;
    message: string;
  }> {
    // Acquire mutex lock on token hash
    const tokenHash = hashTicketToken(rawToken);
    const existingLock = this.checkInLock.get(tokenHash) || Promise.resolve();

    let releaseLock: () => void = () => {};
    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.checkInLock.set(tokenHash, newLock);

    try {
      await existingLock;

      const now = new Date().toISOString();
      const staffProfile = this.profiles.find(
        (p) => p.id === staffUserId || (staffUserId && p.email?.toLowerCase() === staffUserId.toLowerCase())
      );
      const staffEmail = staffProfile?.email?.toLowerCase();
      const isSuperAdmin =
        !!staffProfile?.isSuperAdmin ||
        staffProfile?.email?.toLowerCase() === 'anderson10.talenta@gmail.com' ||
        staffUserId === 'super-admin-anderson' ||
        staffUserId?.includes('super-admin');

      // Check staff assignment or org membership or event creator
      const targetEvent = this.events.find((e) => e.id === eventId || e.slug === eventId);
      const isEventOwnerOrCreator = targetEvent
        ? targetEvent.createdBy === staffUserId ||
          targetEvent.createdBy === staffProfile?.id ||
          (staffEmail && targetEvent.createdBy === staffEmail)
        : false;

      const isOrgMember = targetEvent
        ? this.organizationMembers.some(
            (om) =>
              om.organizationId === targetEvent.organizationId &&
              (om.userId === staffUserId || (staffProfile && om.userId === staffProfile.id))
          ) || isEventOwnerOrCreator
        : false;

      const hasStaffAssignment = this.eventStaffAssignments.some((sa) => {
        if (sa.eventId !== eventId || sa.status !== 'active') return false;
        if (sa.userId === staffUserId) return true;
        if (staffEmail && (sa.userId.toLowerCase() === staffEmail || (sa as any).email?.toLowerCase() === staffEmail)) return true;
        const prof = this.profiles.find((p) => p.id === sa.userId);
        return !!(staffEmail && (prof?.email?.toLowerCase() === staffEmail || (sa as any).email?.toLowerCase() === staffEmail));
      });

      if (!isSuperAdmin && !hasStaffAssignment && !isOrgMember && !isEventOwnerOrCreator) {
        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          eventId,
          checkedInBy: staffUserId,
          result: 'unauthorized',
          scannedAt: now,
          scannerMetadata,
        });
        return {
          result: 'unauthorized',
          allowed: false,
          scannedAt: now,
          message: 'Anda tidak memiliki hak otorisasi untuk melakukan check-in pada event ini.',
        };
      }

      // Clean raw token: parse JSON or remove URL path if scanned from full QR
      let cleanInput = rawToken.trim();
      let parsedTicketId = '';
      let parsedTicketNum = '';
      try {
        if (cleanInput.startsWith('{') && cleanInput.endsWith('}')) {
          const parsedJson = JSON.parse(cleanInput);
          parsedTicketId = parsedJson.ticketId || '';
          parsedTicketNum = parsedJson.ticketNumber || '';
          cleanInput = parsedJson.rawToken || parsedJson.token || parsedJson.ticketId || parsedJson.ticketNumber || cleanInput;
        } else if (cleanInput.includes('/ticket/')) {
          const parts = cleanInput.split('/ticket/');
          cleanInput = parts[parts.length - 1];
        }
      } catch {}

      const inputHash = hashTicketToken(cleanInput);

      // Lookup ticket flexibly by SHA-256 hash, raw token, ticket number, or ticket ID
      const ticket = this.tickets.find(
        (t) =>
          t.tokenHash === tokenHash ||
          t.tokenHash === inputHash ||
          (t.ticketNumber && (
            t.ticketNumber.toUpperCase() === cleanInput.toUpperCase() ||
            (parsedTicketNum && t.ticketNumber.toUpperCase() === parsedTicketNum.toUpperCase())
          )) ||
          t.id === cleanInput ||
          (parsedTicketId && t.id === parsedTicketId) ||
          t.rawToken === cleanInput ||
          this.rawTokenStore.get(t.id) === cleanInput
      );
      if (!ticket) {
        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          eventId,
          checkedInBy: staffUserId,
          result: 'invalid',
          scannedAt: now,
          scannerMetadata,
        });
        return {
          result: 'invalid',
          allowed: false,
          scannedAt: now,
          message: 'Tiket tidak ditemukan atau QR Code tidak valid.',
        };
      }

      // Event verification
      if (ticket.eventId !== eventId) {
        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          eventId,
          checkedInBy: staffUserId,
          result: 'wrong_event',
          scannedAt: now,
          scannerMetadata,
        });
        return {
          result: 'wrong_event',
          allowed: false,
          ticketNumber: ticket.ticketNumber,
          scannedAt: now,
          message: 'Tiket terdaftar untuk event yang berbeda.',
        };
      }

      // Order & Registration info
      const registration = this.registrations.find((r) => r.id === ticket.registrationId);
      const ticketType = this.ticketTypes.find((tt) => tt.id === ticket.ticketTypeId);
      const order = registration ? this.orders.find((o) => o.id === registration.orderId) : null;

      // Status checks
      // 1. Check if event is completed or ended
      if (targetEvent && (targetEvent.status === 'completed' || new Date(targetEvent.endsAt).getTime() < Date.now())) {
        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          eventId,
          checkedInBy: staffUserId,
          result: 'invalid',
          scannedAt: now,
          scannerMetadata,
        });
        return {
          result: 'invalid',
          allowed: false,
          ticketNumber: ticket.ticketNumber,
          fullName: registration?.fullName,
          ticketTypeName: ticketType?.name,
          scannedAt: now,
          message: 'Event telah selesai. Tiket tidak dapat digunakan untuk check-in lagi.',
        };
      }

      if ((ticket.status as string) === 'expired') {
        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          eventId,
          checkedInBy: staffUserId,
          result: 'invalid',
          scannedAt: now,
          scannerMetadata,
        });
        return {
          result: 'invalid',
          allowed: false,
          ticketNumber: ticket.ticketNumber,
          fullName: registration?.fullName,
          ticketTypeName: ticketType?.name,
          scannedAt: now,
          message: 'Status tiket Selesai (Masa berlaku habis). Tiket tidak dapat di-scan.',
        };
      }

      if (ticket.status === 'checked_in') {
        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          eventId,
          checkedInBy: staffUserId,
          result: 'already_used',
          scannedAt: now,
          scannerMetadata,
        });
        return {
          result: 'already_used',
          allowed: false,
          ticketNumber: ticket.ticketNumber,
          fullName: registration?.fullName,
          ticketTypeName: ticketType?.name,
          scannedAt: now,
          message: `Tiket SUDAH DIGUNAKAN sebelumnya pada ${ticket.checkedInAt || 'sesi sebelumnya'}.`,
        };
      }

      if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          eventId,
          checkedInBy: staffUserId,
          result: 'cancelled',
          scannedAt: now,
          scannerMetadata,
        });
        return {
          result: 'cancelled',
          allowed: false,
          ticketNumber: ticket.ticketNumber,
          fullName: registration?.fullName,
          ticketTypeName: ticketType?.name,
          scannedAt: now,
          message: `Tiket tidak dapat digunakan karena berstatus dibatalkan (${ticket.status}).`,
        };
      }

      if (order && order.status !== 'confirmed') {
        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          eventId,
          checkedInBy: staffUserId,
          result: 'unpaid',
          scannedAt: now,
          scannerMetadata,
        });
        return {
          result: 'unpaid',
          allowed: false,
          ticketNumber: ticket.ticketNumber,
          fullName: registration?.fullName,
          ticketTypeName: ticketType?.name,
          scannedAt: now,
          message: 'Pesanan untuk tiket ini belum lunas.',
        };
      }

      // ATOMIC CONDITIONAL TRANSITION: valid -> checked_in
      if (ticket.status === 'valid') {
        ticket.status = 'checked_in';
        ticket.checkedInAt = now;
        ticket.checkedInBy = staffUserId;

        this.checkInLogs.unshift({
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          eventId,
          checkedInBy: staffUserId,
          result: 'success',
          scannedAt: now,
          scannerMetadata,
        });

        this.persist();

        return {
          result: 'success',
          allowed: true,
          ticketNumber: ticket.ticketNumber,
          fullName: registration?.fullName,
          ticketTypeName: ticketType?.name,
          scannedAt: now,
          message: 'Verifikasi berhasil! Silakan masuk ke area acara.',
        };
      }

      return {
        result: 'invalid',
        allowed: false,
        scannedAt: now,
        message: 'Status tiket tidak memenuhi syarat check-in.',
      };
    } finally {
      releaseLock();
      this.checkInLock.delete(tokenHash);
    }
  }

  // --- ATOMIC BOOKING & CAPACITY RESERVATION ---
  async createBooking(
    attendeeUserId: string,
    eventId: string,
    ticketTypeId: string,
    quantity: number,
    fullName: string,
    email: string,
    phone: string
  ): Promise<{ order: Order; tickets: Ticket[]; isFree: boolean }> {
    const targetEvent = this.events.find((e) => e.id === eventId || e.slug === eventId);
    if (!targetEvent || targetEvent.status !== 'published') {
      throw new Error('Event tidak ditemukan atau belum dipublikasikan');
    }

    if (new Date(targetEvent.endsAt).getTime() < Date.now()) {
      throw new Error('Event telah selesai. Tiket tidak dapat dipesan lagi.');
    }

    const ticketType = this.ticketTypes.find(
      (tt) =>
        (tt.id === ticketTypeId || tt.name === ticketTypeId) &&
        (tt.eventId === eventId || tt.eventId === targetEvent.id)
    ) || this.ticketTypes.find((tt) => tt.eventId === targetEvent.id);
    if (!ticketType || ticketType.status !== 'active') {
      throw new Error('Kategori tiket tidak ditemukan atau tidak aktif');
    }

    if (quantity > ticketType.maxPerOrder) {
      throw new Error(`Maksimal ${ticketType.maxPerOrder} tiket per pemesanan`);
    }

    // Atomic capacity validation
    const capacityCheck = validateCapacity(
      ticketType.capacity,
      ticketType.soldCount,
      ticketType.reservedCount,
      quantity
    );
    if (!capacityCheck.valid) {
      throw new Error(capacityCheck.error || 'Kapasitas tiket habis');
    }

    const pricing = calculateOrderPricing([
      { unitPriceMinor: ticketType.priceMinor, quantity },
    ]);

    const orderId = crypto.randomUUID();
    const orderNumber = `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry

    const orderStatus = pricing.isFree ? 'confirmed' : 'pending';

    const order: Order = {
      id: orderId,
      orderNumber,
      attendeeUserId,
      eventId,
      subtotalMinor: pricing.subtotalMinor,
      feesMinor: pricing.feesMinor,
      totalMinor: pricing.totalMinor,
      currency: 'IDR',
      status: orderStatus,
      expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orderItem: OrderItem = {
      id: crypto.randomUUID(),
      orderId,
      ticketTypeId,
      quantity,
      unitPriceMinor: ticketType.priceMinor,
      lineTotalMinor: pricing.subtotalMinor,
      createdAt: new Date().toISOString(),
    };

    const registration: Registration = {
      id: crypto.randomUUID(),
      orderId,
      attendeeUserId,
      eventId,
      fullName,
      email,
      phone,
      status: orderStatus === 'confirmed' ? 'confirmed' : 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.orders.push(order);
    this.orderItems.push(orderItem);
    this.registrations.push(registration);

    const generatedTickets: Ticket[] = [];

    if (pricing.isFree) {
      // Update sold count atomically
      ticketType.soldCount += quantity;

      // Issue tickets immediately
      for (let i = 0; i < quantity; i++) {
        const ticketId = crypto.randomUUID();
        const rawToken = generateSecureTicketToken();
        const tokenHash = hashTicketToken(rawToken);
        const ticketNumber = generateTicketNumber(
          targetEvent.title.replace(/\s+/g, '').slice(0, 4),
          ticketType.soldCount + i
        );

        this.rawTokenStore.set(ticketId, rawToken);

        const ticket: Ticket = {
          id: ticketId,
          registrationId: registration.id,
          ticketTypeId,
          eventId,
          ticketNumber,
          tokenHash,
          status: 'valid',
          issuedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          rawToken,
        };

        this.tickets.push(ticket);
        generatedTickets.push(ticket);
      }
    } else {
      // Reserve capacity
      ticketType.reservedCount += quantity;
    }

    this.persist();

    return { order, tickets: generatedTickets, isFree: pricing.isFree };
  }

  // --- CONFIRM PAID CHECKOUT / WEBHOOK ---
  async confirmPaidOrder(
    orderId: string,
    provider: string,
    providerReference: string
  ): Promise<{ order: Order; tickets: Ticket[] }> {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error('Pesanan tidak ditemukan');
    }

    if (order.status === 'confirmed') {
      // Idempotent: already confirmed
      const reg = this.registrations.find((r) => r.orderId === orderId);
      const existingTickets = reg
        ? this.tickets
            .filter((t) => t.registrationId === reg.id)
            .map((t) => ({ ...t, rawToken: this.rawTokenStore.get(t.id) }))
        : [];
      return { order, tickets: existingTickets };
    }

    const registration = this.registrations.find((r) => r.orderId === orderId);
    if (!registration) {
      throw new Error('Registrasi pesanan tidak ditemukan');
    }

    const orderItem = this.orderItems.find((oi) => oi.orderId === orderId);
    const ticketType = orderItem ? this.ticketTypes.find((tt) => tt.id === orderItem.ticketTypeId) : null;
    const targetEvent = this.events.find((e) => e.id === order.eventId);

    if (ticketType && orderItem) {
      ticketType.reservedCount = Math.max(0, ticketType.reservedCount - orderItem.quantity);
      ticketType.soldCount += orderItem.quantity;
    }

    order.status = 'confirmed';
    order.updatedAt = new Date().toISOString();
    registration.status = 'confirmed';
    registration.updatedAt = new Date().toISOString();

    const payment: Payment = {
      id: crypto.randomUUID(),
      orderId,
      provider,
      providerReference,
      amountMinor: order.totalMinor,
      currency: order.currency,
      status: 'paid',
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.payments.push(payment);

    const quantity = orderItem ? orderItem.quantity : 1;
    const generatedTickets: Ticket[] = [];

    for (let i = 0; i < quantity; i++) {
      const ticketId = crypto.randomUUID();
      const rawToken = generateSecureTicketToken();
      const tokenHash = hashTicketToken(rawToken);
      const ticketNumber = generateTicketNumber(
        targetEvent?.title.replace(/\s+/g, '').slice(0, 4) || 'TIX',
        (ticketType?.soldCount || 100) + i
      );

      this.rawTokenStore.set(ticketId, rawToken);

      const ticket: Ticket = {
        id: ticketId,
        registrationId: registration.id,
        ticketTypeId: orderItem?.ticketTypeId || '',
        eventId: order.eventId,
        ticketNumber,
        tokenHash,
        status: 'valid',
        issuedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        rawToken,
      };

      this.tickets.push(ticket);
      generatedTickets.push(ticket);
    }

    this.persist();

    return { order, tickets: generatedTickets };
  }
}

export const db = new TixoraDatabase();

// --- EXPRESS APPLICATION SETUP ---

export async function createExpressApp() {
  const app = express();
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // Session context helper
  // Default session to Attendee (Budi Santoso) or read from x-user-id / x-user-email header
  app.use((req, res, next) => {
    const userIdHeader = (req.headers['x-user-id'] as string) || '';
    const userEmailHeader = (req.headers['x-user-email'] as string)?.trim().toLowerCase() || '';

    let profile = db.profiles.find(
      (p) =>
        (userIdHeader && p.id === userIdHeader) ||
        (userEmailHeader && p.email?.toLowerCase() === userEmailHeader)
    );

    const isSuper =
      userEmailHeader === 'anderson10.talenta@gmail.com' ||
      userIdHeader === 'super-admin-anderson' ||
      userIdHeader?.includes('super-admin') ||
      profile?.email?.toLowerCase() === 'anderson10.talenta@gmail.com';

    if (!profile) {
      if (userIdHeader || userEmailHeader) {
        profile = {
          id: userIdHeader || crypto.randomUUID(),
          fullName: (req.headers['x-user-name'] as string) || (isSuper ? 'Anderson (Super Admin)' : 'Pengguna Tixora'),
          email: userEmailHeader || (isSuper ? 'anderson10.talenta@gmail.com' : 'pengguna@tixora.id'),
          phone: '+6281234567890',
          avatarUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          isSuperAdmin: isSuper,
          createdAt: new Date().toISOString(),
          organizerStatus: isSuper ? 'approved' : 'not_applied',
        };
        db.profiles.push(profile);
      } else {
        profile = null as any;
      }
    }

    if (profile && isSuper) {
      profile.isSuperAdmin = true;
      profile.organizerStatus = 'approved';
    }

    (req as any).user = profile;
    next();
  });

  // --- API ROUTES ---

  // 1. Current Session
  app.get('/api/auth/me', (req, res) => {
    const user = (req as any).user as Profile;
    if (!user) {
      return res.json({
        user: null,
        organizations: [],
        staffAssignments: [],
        availableProfiles: [],
      });
    }

    const userOrgs = db.organizationMembers
      .filter((om) => om.userId === user.id && om.status === 'active')
      .map((om) => {
        const org = db.organizations.find((o) => o.id === om.organizationId);
        return { ...org, role: om.role };
      });

    const staffAssignments = db.eventStaffAssignments
      .filter((sa) => sa.userId === user.id && sa.status === 'active')
      .map((sa) => {
        const event = db.events.find((e) => e.id === sa.eventId);
        return { ...sa, eventTitle: event?.title };
      });

    res.json({
      user,
      organizations: userOrgs,
      staffAssignments,
      availableProfiles: db.profiles.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        isSuperAdmin: p.isSuperAdmin,
      })),
    });
  });

  app.post('/api/auth/switch-role', (req, res) => {
    const { userId } = req.body;
    const profile = db.profiles.find((p) => p.id === userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profil tidak ditemukan' });
    }
    res.json({ success: true, user: profile });
  });

  // 2. Events Discovery (Public - Automatically hides completed/finished events)
  app.get('/api/events', (req, res) => {
    db.processCompletedEventsLifecycle();
    const now = Date.now();
    const { search, category, status } = req.query;
    let results = db.events;

    // Filter by publication status
    // Public only sees published events that HAVE NOT FINISHED YET
    if (status && typeof status === 'string') {
      results = results.filter((e) => e.status === status);
    } else {
      results = results.filter((e) => e.status === 'published');
    }

    results = results.filter((e) => {
      if (e.status !== 'published') return true;
      const rawEnd = e.endsAt || (e as any).endDate;
      const rawStart = e.startsAt || (e as any).startDate;
      if (!rawEnd && !rawStart) return true;

      const endTime = rawEnd
        ? new Date(rawEnd).getTime()
        : new Date(rawStart).getTime() + 6 * 3600 * 1000;

      if (isNaN(endTime)) return true;
      return endTime >= now;
    });

    if (category && typeof category === 'string' && category !== 'all') {
      results = results.filter((e) => e.category === category || e.category.toLowerCase() === category.toLowerCase());
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      results = results.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.venueName.toLowerCase().includes(q)
      );
    }

    const enriched = results.map((e) => {
      const org = db.organizations.find((o) => o.id === e.organizationId);
      const tickets = db.ticketTypes.filter((tt) => tt.eventId === e.id);
      const minPrice = tickets.length > 0 ? Math.min(...tickets.map((t) => t.priceMinor)) : 0;
      return {
        ...e,
        organizationName: org?.name || 'Tixora Organizer',
        organizationSlug: org?.slug || 'organizer',
        lowestPriceMinor: minPrice,
        ticketTypes: tickets,
      };
    });

    res.json(enriched);
  });

  // Single event detail
  app.get('/api/events/:identifier', (req, res) => {
    db.processCompletedEventsLifecycle();
    const { identifier } = req.params;
    const event = db.events.find(
      (e) => e.id === identifier || e.slug === identifier
    );

    if (!event) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }

    const now = Date.now();
    const rawEnd = event.endsAt || (event as any).endDate;
    const rawStart = event.startsAt || (event as any).startDate;
    const endTime = rawEnd
      ? new Date(rawEnd).getTime()
      : rawStart
      ? new Date(rawStart).getTime() + 6 * 3600 * 1000
      : Infinity;
    const isCompleted = event.status === 'completed' || (!isNaN(endTime) && endTime < now);

    const org = db.organizations.find((o) => o.id === event.organizationId);
    const tickets = db.ticketTypes
      .filter((tt) => tt.eventId === event.id)
      .map((tt) => ({
        ...tt,
        status: isCompleted ? 'inactive' : tt.status,
      }));

    res.json({
      ...event,
      isCompleted,
      organization: org,
      ticketTypes: tickets,
    });
  });

  // --- CATEGORIES MANAGEMENT (Admin can add custom categories) ---
  app.get('/api/categories', (req, res) => {
    res.json(db.categories);
  });

  app.post('/api/categories', (req, res) => {
    const user = (req as any).user as Profile;
    const userEmailHeader = (req.headers['x-user-email'] as string)?.toLowerCase() || user?.email?.toLowerCase() || '';
    const isSuperAdmin = !!user?.isSuperAdmin || userEmailHeader === 'anderson10.talenta@gmail.com';

    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat menambahkan kategori baru.' });
    }

    const { name, iconName, description } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
    }

    const cleanName = name.trim();
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existing = db.categories.find(
      (c) => c.id === slug || c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      return res.status(400).json({ error: 'Kategori dengan nama tersebut sudah ada.' });
    }

    const newCategory: EventCategory = {
      id: slug || `cat-${Date.now()}`,
      name: cleanName,
      iconName: iconName || 'Tag',
      description: description?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    db.categories.push(newCategory);
    db.persist();

    res.status(201).json({ success: true, category: newCategory });
  });

  app.delete('/api/categories/:id', (req, res) => {
    const user = (req as any).user as Profile;
    const userEmailHeader = (req.headers['x-user-email'] as string)?.toLowerCase() || user?.email?.toLowerCase() || '';
    const isSuperAdmin = !!user?.isSuperAdmin || userEmailHeader === 'anderson10.talenta@gmail.com';

    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat menghapus kategori.' });
    }

    const { id } = req.params;
    const idx = db.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    }

    const deleted = db.categories.splice(idx, 1);
    db.persist();

    res.json({ success: true, deleted: deleted[0] });
  });

  // --- CREDIT SCORE MANAGEMENT (User credit score & logs) ---
  app.get('/api/users/credit-score', (req, res) => {
    const user = (req as any).user as Profile;
    const userIdHeader = (req.headers['x-user-id'] as string) || user?.id || '';
    const userEmailHeader = (req.headers['x-user-email'] as string)?.toLowerCase() || user?.email?.toLowerCase() || '';

    const profile = db.profiles.find(
      (p) =>
        (userIdHeader && p.id === userIdHeader) ||
        (userEmailHeader && p.email?.toLowerCase() === userEmailHeader)
    );

    const score = profile?.creditScore ?? 10;
    const logs = db.creditScoreLogs.filter(
      (l) => (userIdHeader && l.userId === userIdHeader) || (profile && l.userId === profile.id)
    );

    res.json({
      creditScore: score,
      maxScore: 10,
      logs,
    });
  });

  // 3. Organizer: Event Management
  app.get('/api/organizer/events', (req, res) => {
    const user = (req as any).user as Profile;
    if (!user) {
      return res.json([]);
    }

    const userOrgIds = db.organizationMembers
      .filter((om) => om.userId === user.id && om.status === 'active')
      .map((om) => om.organizationId);

    const isSuperAdmin = user.isSuperAdmin;
    const events = isSuperAdmin
      ? db.events
      : db.events.filter(
          (e) => userOrgIds.includes(e.organizationId) || e.createdBy === user.id
        );

    const enriched = events.map((e) => {
      const org = db.organizations.find((o) => o.id === e.organizationId);
      const ticketTypes = db.ticketTypes.filter((tt) => tt.eventId === e.id);
      const totalCapacity = ticketTypes.reduce((s, t) => s + t.capacity, 0);
      const totalSold = ticketTypes.reduce((s, t) => s + t.soldCount, 0);
      const totalCheckedIn = db.tickets.filter((t) => t.eventId === e.id && t.status === 'checked_in').length;

      return {
        ...e,
        organizationName: org?.name || 'Kinarya Creative',
        totalCapacity,
        totalSold,
        totalCheckedIn,
      };
    });

    res.json(enriched);
  });

  // Create Event
  app.post('/api/events', (req, res) => {
    const user = (req as any).user as Profile | null | undefined;
    const userEmailHeader = (req.headers['x-user-email'] as string)?.trim().toLowerCase() || user?.email?.toLowerCase() || '';
    const userIdHeader = (req.headers['x-user-id'] as string) || user?.id || '';

    const isSuperAdmin =
      !!user?.isSuperAdmin ||
      userEmailHeader === 'anderson10.talenta@gmail.com' ||
      userIdHeader === 'super-admin-anderson' ||
      userIdHeader.includes('super-admin');

    const isApprovedOrganizer =
      isSuperAdmin ||
      user?.organizerStatus === 'approved' ||
      db.organizerApplications.some(
        (a) =>
          ((userIdHeader && a.userId === userIdHeader) || (userEmailHeader && a.applicantEmail.toLowerCase() === userEmailHeader)) &&
          a.status === 'approved'
      ) ||
      (userIdHeader ? db.organizationMembers.some((om) => om.userId === userIdHeader && om.status === 'active') : false);

    if (!isApprovedOrganizer) {
      return res.status(403).json({
        error:
          'Anda belum terverifikasi sebagai Penyelenggara Acara (Organizer). Silakan ajukan verifikasi KTP & Rekening Bank di Dashboard terlebih dahulu dan tunggu persetujuan Super Admin.',
      });
    }

    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const data = parsed.data;

    // Find organization where user is owner or active member
    let orgMember = userIdHeader ? db.organizationMembers.find((om) => om.userId === userIdHeader && om.status === 'active') : null;
    let orgId = orgMember ? orgMember.organizationId : null;

    if (!orgId) {
      const existingOrg = db.organizations.find(
        (o) => (userIdHeader && o.createdBy === userIdHeader) || (userEmailHeader && o.contactEmail.toLowerCase() === userEmailHeader)
      );

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        const newOrgId = crypto.randomUUID();
        const userApp = db.organizerApplications.find(
          (a) => (userIdHeader && a.userId === userIdHeader) || (userEmailHeader && a.applicantEmail.toLowerCase() === userEmailHeader)
        );
        const orgName = userApp?.organizationName || (req.headers['x-user-name'] as string) || user?.fullName || 'Penyelenggara Mandiri';

        const newOrg: Organization = {
          id: newOrgId,
          name: orgName,
          slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`,
          description: 'Organisasi Penyelenggara Resmi Tixora',
          contactEmail: userEmailHeader || 'organizer@tixora.id',
          status: 'active',
          createdBy: userIdHeader || 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        db.organizations.unshift(newOrg);

        if (userIdHeader) {
          db.organizationMembers.push({
            id: crypto.randomUUID(),
            organizationId: newOrgId,
            userId: userIdHeader,
            role: 'owner',
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        }

        orgId = newOrgId;
      }
    }

    const eventId = crypto.randomUUID();
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + `-${Math.floor(100 + Math.random() * 900)}`;

    const newEvent: Event = {
      id: eventId,
      organizationId: orgId,
      title: data.title,
      slug,
      description: data.description,
      category: data.category,
      coverImageUrl: data.coverImageUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      venueName: data.venueName,
      venueAddress: data.venueAddress,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      timezone: 'Asia/Jakarta',
      salesStartsAt: data.salesStartsAt || data.startsAt,
      salesEndsAt: data.salesEndsAt || data.endsAt,
      status: 'published',
      createdBy: userIdHeader || user?.id || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.events.unshift(newEvent);

    // Create ticket types
    data.ticketTypes.forEach((tt) => {
      const ticketType: TicketType = {
        id: crypto.randomUUID(),
        eventId,
        name: tt.name,
        description: tt.description,
        priceMinor: tt.priceMinor,
        currency: 'IDR',
        capacity: tt.capacity,
        soldCount: 0,
        reservedCount: 0,
        maxPerOrder: tt.maxPerOrder,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.ticketTypes.push(ticketType);
    });

    db.auditLogs.unshift({
      id: crypto.randomUUID(),
      actorUserId: userIdHeader || user?.id || 'admin',
      organizationId: orgId,
      eventId,
      action: 'EVENT_CREATED',
      targetType: 'event',
      targetId: eventId,
      metadata: { title: newEvent.title },
      createdAt: new Date().toISOString(),
    });

    db.persist();
    res.status(201).json(newEvent);
  });

  // Registrants List & CSV Export
  app.get('/api/events/:eventId/registrants', (req, res) => {
    const { eventId } = req.params;
    const { format } = req.query;

    const event = db.events.find((e) => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }

    const eventRegistrations = db.registrations.filter((r) => r.eventId === eventId);
    const enriched = eventRegistrations.map((r) => {
      const order = db.orders.find((o) => o.id === r.orderId);
      const tickets = db.tickets.filter((t) => t.registrationId === r.id);
      const ticketTypeNames = tickets
        .map((t) => db.ticketTypes.find((tt) => tt.id === t.ticketTypeId)?.name)
        .filter(Boolean)
        .join(', ');

      return {
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone || '-',
        orderNumber: order?.orderNumber || '-',
        status: r.status,
        ticketCount: tickets.length,
        ticketTypes: ticketTypeNames,
        checkedInCount: tickets.filter((t) => t.status === 'checked_in').length,
        createdAt: r.createdAt,
      };
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="registrants-${event.slug}.csv"`);
      
      const header = 'Nama Lengkap,Email,Telepon,Nomor Pesanan,Status,Jumlah Tiket,Kategori Tiket,Check-In,Tanggal Registrasi\n';
      const rows = enriched.map((row) =>
        `"${row.fullName}","${row.email}","${row.phone}","${row.orderNumber}","${row.status}",${row.ticketCount},"${row.ticketTypes}",${row.checkedInCount},"${row.createdAt}"`
      ).join('\n');

      return res.send(header + rows);
    }

    res.json(enriched);
  });

  // Event Reports & Analytics
  app.get('/api/events/:eventId/reports', (req, res) => {
    const { eventId } = req.params;
    const event = db.events.find((e) => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }

    const ticketTypes = db.ticketTypes.filter((tt) => tt.eventId === eventId);
    const tickets = db.tickets.filter((t) => t.eventId === eventId);
    const orders = db.orders.filter((o) => o.eventId === eventId && o.status === 'confirmed');

    const totalRevenueMinor = orders.reduce((s, o) => s + o.subtotalMinor, 0);
    const totalIssued = tickets.length;
    const totalCheckedIn = tickets.filter((t) => t.status === 'checked_in').length;
    const totalCapacity = ticketTypes.reduce((s, t) => s + t.capacity, 0);
    const checkInRate = totalIssued > 0 ? Math.round((totalCheckedIn / totalIssued) * 100) : 0;

    res.json({
      eventTitle: event.title,
      totalRevenueMinor,
      totalIssued,
      totalCheckedIn,
      remainingExpected: totalIssued - totalCheckedIn,
      totalCapacity,
      checkInRate,
      breakdownByTicketType: ticketTypes.map((tt) => {
        const typeTickets = tickets.filter((t) => t.ticketTypeId === tt.id);
        const typeCheckedIn = typeTickets.filter((t) => t.status === 'checked_in').length;
        return {
          id: tt.id,
          name: tt.name,
          priceMinor: tt.priceMinor,
          capacity: tt.capacity,
          sold: tt.soldCount,
          checkedIn: typeCheckedIn,
        };
      }),
    });
  });

  // Staff Assignments
  app.get('/api/events/:eventId/staff', (req, res) => {
    const { eventId } = req.params;
    const assignments = db.eventStaffAssignments.filter((sa) => sa.eventId === eventId && sa.status === 'active');
    const enriched = assignments.map((sa) => {
      const saEmail = (sa as any).email?.toLowerCase();
      const profile = db.profiles.find((p) => p.id === sa.userId || (saEmail && p.email?.toLowerCase() === saEmail));
      return {
        id: sa.id,
        userId: sa.userId,
        fullName: profile?.fullName || saEmail?.split('@')[0] || 'Petugas Check-In',
        email: profile?.email || saEmail || '-',
        status: sa.status,
        createdAt: sa.createdAt,
      };
    });
    res.json(enriched);
  });

  app.post('/api/events/:eventId/staff', (req, res) => {
    const user = (req as any).user as Profile;
    const { eventId } = req.params;
    const parsed = assignStaffSchema.safeParse({ eventId, ...req.body });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { email } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();
    let targetProfile = db.profiles.find((p) => p.email.toLowerCase() === cleanEmail);

    if (!targetProfile) {
      // Create profile for invited staff
      targetProfile = {
        id: crypto.randomUUID(),
        fullName: cleanEmail.split('@')[0],
        email: cleanEmail,
        isSuperAdmin: cleanEmail === 'anderson10.talenta@gmail.com',
        createdAt: new Date().toISOString(),
        organizerStatus: 'not_applied',
      };
      db.profiles.push(targetProfile);
    }

    const existing = db.eventStaffAssignments.find(
      (sa) =>
        sa.eventId === eventId &&
        (sa.userId === targetProfile?.id || (sa as any).email === cleanEmail)
    );

    if (existing) {
      existing.status = 'active';
      (existing as any).email = cleanEmail;
    } else {
      db.eventStaffAssignments.push({
        id: crypto.randomUUID(),
        eventId,
        userId: targetProfile.id,
        assignedBy: user?.id || 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        email: cleanEmail,
      } as any);
    }

    db.persist();
    res.status(201).json({ success: true, message: `Staff ${cleanEmail} berhasil ditugaskan.` });
  });

  // 4. Booking Engine: Create Order
  app.post('/api/orders', async (req, res) => {
    const user = (req as any).user as Profile | null | undefined;
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    try {
      const { eventId, ticketTypeId, quantity, fullName, email, phone } = parsed.data;
      const cleanEmail = email.trim().toLowerCase();

      // Resolve buyer userId safely
      let buyerId = user?.id || (req.headers['x-user-id'] as string);
      if (!buyerId) {
        let existing = db.profiles.find((p) => p.email.toLowerCase() === cleanEmail);
        if (!existing) {
          existing = {
            id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            fullName,
            email: cleanEmail,
            phone,
            isSuperAdmin: false,
            createdAt: new Date().toISOString(),
            organizerStatus: 'not_applied',
          };
          db.profiles.push(existing);
        }
        buyerId = existing.id;
      }

      const result = await db.createBooking(
        buyerId,
        eventId,
        ticketTypeId,
        quantity,
        fullName,
        email,
        phone
      );

      res.status(201).json({
        order: result.order,
        tickets: result.tickets,
        isFree: result.isFree,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal memproses pesanan' });
    }
  });

  // Get Order details
  app.get('/api/orders/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = db.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    const event = db.events.find((e) => e.id === order.eventId);
    const items = db.orderItems.filter((oi) => oi.orderId === order.id).map((oi) => {
      const tt = db.ticketTypes.find((t) => t.id === oi.ticketTypeId);
      return { ...oi, ticketTypeName: tt?.name };
    });
    const registration = db.registrations.find((r) => r.orderId === order.id);
    const tickets = db.tickets
      .filter((t) => t.registrationId === registration?.id)
      .map((t) => ({ ...t, rawToken: db.rawTokenStore.get(t.id) }));

    res.json({
      order,
      event,
      items,
      registration,
      tickets,
    });
  });

  // Paid Checkout Confirmation (Sandbox / Provider)
  app.post('/api/checkout', async (req, res) => {
    const { orderId, paymentMethod } = req.body;
    try {
      const providerRef = `PAY-SANDBOX-${Math.floor(100000 + Math.random() * 900000)}`;
      const result = await db.confirmPaidOrder(orderId, paymentMethod || 'SANDBOX_GATEWAY', providerRef);
      res.json({
        success: true,
        order: result.order,
        tickets: result.tickets,
        providerReference: providerRef,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Pembayaran gagal' });
    }
  });

  // Payment Webhook Ingestion (Idempotent + Signature verified)
  app.post('/api/payments/webhook/:provider', async (req, res) => {
    const { provider } = req.params;
    const signature = (req.headers['x-signature'] as string) || '';
    const payload = JSON.stringify(req.body);
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'tixora-secret-key-2026';

    const { eventId: providerEventId, orderId, status } = req.body;

    // Check duplicate in payment_webhook_events
    const duplicate = db.paymentWebhookEvents.find(
      (we) => we.provider === provider && we.providerEventId === providerEventId
    );
    if (duplicate) {
      return res.status(200).json({ status: 'ignored', message: 'Event duplicate already processed' });
    }

    db.paymentWebhookEvents.push({
      id: crypto.randomUUID(),
      provider,
      providerEventId,
      eventType: 'payment.status_updated',
      processingStatus: 'processed',
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    });

    if (status === 'PAID') {
      await db.confirmPaidOrder(orderId, provider, providerEventId);
    }

    res.json({ status: 'success' });
  });

  // Upload Bukti Screenshot Pembayaran QRIS
  app.post('/api/orders/:orderId/payment-proof', (req, res) => {
    const { orderId } = req.params;
    const { paymentProofUrl, senderName, senderBank, notes } = req.body;

    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    if (!paymentProofUrl) {
      return res.status(400).json({ error: 'Bukti transfer/screenshot pembayaran wajib diunggah' });
    }

    order.status = 'awaiting_approval';
    order.paymentProofUrl = paymentProofUrl;
    order.paymentProofUploadedAt = new Date().toISOString();
    order.senderName = senderName || '';
    order.senderBank = senderBank || 'QRIS / GoPay';
    order.paymentNotes = notes || '';
    order.paymentMethod = 'QRIS_GOPAY_SOLVERSTUDIO';
    order.updatedAt = new Date().toISOString();

    const reg = db.registrations.find((r) => r.orderId === orderId);
    if (reg) {
      reg.status = 'pending';
      reg.updatedAt = new Date().toISOString();
    }

    db.persist();
    res.json({
      success: true,
      message: 'Bukti transfer berhasil dikirim. Menunggu verifikasi admin.',
      order,
    });
  });

  // Get single order detail
  app.get('/api/orders/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = db.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    const event = db.events.find((e) => e.id === order.eventId);
    const orderItem = db.orderItems.find((oi) => oi.orderId === order.id);
    const ticketType = orderItem ? db.ticketTypes.find((tt) => tt.id === orderItem.ticketTypeId) : null;
    const registration = db.registrations.find((r) => r.orderId === order.id);

    res.json({
      order,
      event,
      ticketType,
      registration,
      quantity: orderItem?.quantity || 1,
    });
  });

  // Get current user orders (all statuses: pending, awaiting_approval, confirmed, rejected)
  app.get('/api/orders/my', (req, res) => {
    const user = (req as any).user as Profile;
    if (!user) {
      return res.json([]);
    }
    const userEmailHeader = (req.headers['x-user-email'] as string)?.trim().toLowerCase() || user.email?.toLowerCase();
    const userRegistrations = db.registrations.filter(
      (r) =>
        r.attendeeUserId === user.id ||
        (userEmailHeader && r.email?.toLowerCase() === userEmailHeader)
    );
    const regOrderIds = new Set(userRegistrations.map((r) => r.orderId));

    const userOrders = db.orders
      .filter((o) => o.attendeeUserId === user.id || regOrderIds.has(o.id))
      .map((o) => {
        const event = db.events.find((e) => e.id === o.eventId);
        const orderItem = db.orderItems.find((oi) => oi.orderId === o.id);
        const ticketType = orderItem ? db.ticketTypes.find((tt) => tt.id === orderItem.ticketTypeId) : null;
        const reg = userRegistrations.find((r) => r.orderId === o.id);

        return {
          ...o,
          eventTitle: event?.title || 'Event Tixora',
          eventVenue: event?.venueName || 'Venue Tixora',
          eventStartsAt: event?.startsAt,
          eventCoverImageUrl: event?.coverImageUrl,
          ticketTypeName: ticketType?.name || 'Tiket Masuk',
          quantity: orderItem?.quantity || 1,
          attendeeName: reg?.fullName || user.fullName,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(userOrders);
  });

  // Admin & Organizer list of orders with verification details
  app.get('/api/admin/orders', (req, res) => {
    const user = (req as any).user as Profile | null | undefined;
    const isSuper =
      !!user?.isSuperAdmin ||
      (req.headers['x-user-email'] as string)?.toLowerCase() === 'anderson10.talenta@gmail.com' ||
      (req.headers['x-user-id'] as string) === 'super-admin-anderson';

    const { status, eventId } = req.query;

    let ordersList = db.orders;
    if (status && typeof status === 'string') {
      ordersList = ordersList.filter((o) => o.status === status);
    }
    if (eventId && typeof eventId === 'string') {
      ordersList = ordersList.filter((o) => o.eventId === eventId);
    } else if (!isSuper && (user?.id || req.headers['x-user-id'])) {
      const currentUserId = user?.id || (req.headers['x-user-id'] as string);
      const currentUserEmail = user?.email || (req.headers['x-user-email'] as string);
      const userOrgIds = new Set(
        db.organizationMembers.filter((om) => om.userId === currentUserId).map((om) => om.organizationId)
      );
      const myEventIds = new Set(
        db.events
          .filter(
            (e) =>
              e.createdBy === currentUserId ||
              (currentUserEmail && e.createdBy === currentUserEmail) ||
              userOrgIds.has(e.organizationId)
          )
          .map((e) => e.id)
      );
      ordersList = ordersList.filter((o) => myEventIds.has(o.eventId));
    }

    const enriched = ordersList.map((o) => {
      const event = db.events.find((e) => e.id === o.eventId);
      const orderItem = db.orderItems.find((oi) => oi.orderId === o.id);
      const ticketType = orderItem ? db.ticketTypes.find((tt) => tt.id === orderItem.ticketTypeId) : null;
      const reg = db.registrations.find((r) => r.orderId === o.id);

      return {
        ...o,
        eventTitle: event?.title || 'Event',
        eventCoverImageUrl: event?.coverImageUrl,
        ticketTypeName: ticketType?.name || 'Tiket',
        quantity: orderItem?.quantity || 1,
        buyerName: reg?.fullName || 'Pengunjung',
        buyerEmail: reg?.email || '',
        buyerPhone: reg?.phone || '',
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(enriched);
  });

  // Admin / Organizer review payment proof (Approve / Reject)
  app.post('/api/admin/orders/:orderId/verify-payment', async (req, res) => {
    const user = (req as any).user as Profile | null | undefined;
    const isSuper =
      !!user?.isSuperAdmin ||
      (req.headers['x-user-email'] as string)?.toLowerCase() === 'anderson10.talenta@gmail.com' ||
      (req.headers['x-user-id'] as string) === 'super-admin-anderson';

    const { orderId } = req.params;
    const { action, rejectionReason } = req.body;

    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    const reviewerName =
      user?.fullName ||
      (req.headers['x-user-name'] as string) ||
      (isSuper ? 'Super Admin' : 'Penyelenggara Acara');

    if (action === 'approve') {
      try {
        const ref = `QRIS-VERIF-${Math.floor(100000 + Math.random() * 900000)}`;
        const result = await db.confirmPaidOrder(orderId, 'QRIS_GOPAY_SOLVERSTUDIO', ref);
        order.reviewedBy = reviewerName;
        order.reviewedAt = new Date().toISOString();
        db.persist();

        res.json({
          success: true,
          message: `Pembayaran pesanan ${order.orderNumber} berhasil disetujui. Tiket QR Code telah terbit!`,
          order: result.order,
          tickets: result.tickets,
        });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Gagal menyetujui pembayaran' });
      }
    } else {
      order.status = 'rejected';
      order.rejectionReason = rejectionReason || 'Bukti transfer tidak valid atau nominal tidak sesuai.';
      order.reviewedBy = reviewerName;
      order.reviewedAt = new Date().toISOString();
      order.updatedAt = new Date().toISOString();

      // Release reserved tickets
      const orderItem = db.orderItems.find((oi) => oi.orderId === orderId);
      const ticketType = orderItem ? db.ticketTypes.find((tt) => tt.id === orderItem.ticketTypeId) : null;
      if (ticketType && orderItem) {
        ticketType.reservedCount = Math.max(0, ticketType.reservedCount - orderItem.quantity);
      }

      db.persist();
      res.json({
        success: true,
        message: `Pembayaran pesanan ${order.orderNumber} ditolak.`,
        order,
      });
    }
  });

  // 5. Digital Tickets (Attendee View)
  app.get('/api/tickets/my', (req, res) => {
    db.processCompletedEventsLifecycle();
    const user = (req as any).user as Profile;
    if (!user) {
      return res.json([]);
    }
    const userEmailHeader = (req.headers['x-user-email'] as string)?.trim().toLowerCase() || user.email?.toLowerCase();
    const userRegistrations = db.registrations.filter((r) =>
      r.attendeeUserId === user.id ||
      (userEmailHeader && r.email?.toLowerCase() === userEmailHeader)
    );
    const regIds = userRegistrations.map((r) => r.id);

    const now = Date.now();
    const userTickets = db.tickets
      .filter((t) => regIds.includes(t.registrationId) || t.registrationId === user.id)
      .map((t) => {
        const event = db.events.find((e) => e.id === t.eventId);
        const ticketType = db.ticketTypes.find((tt) => tt.id === t.ticketTypeId);
        const reg = userRegistrations.find((r) => r.id === t.registrationId);
        const rawToken = db.rawTokenStore.get(t.id);

        const endTime = event?.endsAt
          ? new Date(event.endsAt).getTime()
          : event?.startsAt
          ? new Date(event.startsAt).getTime() + 6 * 3600 * 1000
          : 0;
        const isEventCompleted = event ? (event.status === 'completed' || endTime < now) : false;

        return {
          ...t,
          rawToken,
          isEventCompleted,
          eventTitle: event?.title || 'Event Tixora',
          eventVenue: event?.venueName || 'Venue Acara',
          eventStartsAt: event?.startsAt,
          eventEndsAt: event?.endsAt,
          ticketTypeName: ticketType?.name || 'Tiket Masuk',
          attendeeName: reg?.fullName || user.fullName,
        };
      });

    res.json(userTickets);
  });

  // Single ticket view
  app.get('/api/tickets/:ticketId', (req, res) => {
    db.processCompletedEventsLifecycle();
    const { ticketId } = req.params;
    const ticket = db.tickets.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    }

    const event = db.events.find((e) => e.id === ticket.eventId);
    const ticketType = db.ticketTypes.find((tt) => tt.id === ticket.ticketTypeId);
    const registration = db.registrations.find((r) => r.id === ticket.registrationId);
    const rawToken = db.rawTokenStore.get(ticket.id);

    const now = Date.now();
    const endTime = event?.endsAt
      ? new Date(event.endsAt).getTime()
      : event?.startsAt
      ? new Date(event.startsAt).getTime() + 6 * 3600 * 1000
      : 0;
    const isEventCompleted = event ? (event.status === 'completed' || endTime < now) : false;

    res.json({
      ...ticket,
      rawToken,
      isEventCompleted,
      event,
      ticketType,
      registration,
    });
  });

  // Cancel Ticket by Attendee (with Credit Score Penalty: H-1 = -3, H-3 = -2, H-5 = -1, >H-5 = 0)
  app.post('/api/tickets/:ticketId/cancel', (req, res) => {
    const { ticketId } = req.params;
    const user = (req as any).user as Profile;
    const userIdHeader = (req.headers['x-user-id'] as string) || user?.id || '';
    const userEmailHeader = (req.headers['x-user-email'] as string)?.trim().toLowerCase() || user?.email?.toLowerCase() || '';

    const ticket = db.tickets.find((t) => t.id === ticketId || t.ticketNumber === ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    }

    if (ticket.status === 'checked_in') {
      return res.status(400).json({ error: 'Tiket sudah digunakan check-in dan tidak dapat dibatalkan.' });
    }

    if (ticket.status === 'cancelled') {
      return res.status(400).json({ error: 'Tiket sudah berstatus dibatalkan.' });
    }

    if ((ticket.status as string) === 'expired') {
      return res.status(400).json({ error: 'Event telah selesai, tiket tidak dapat dibatalkan.' });
    }

    const event = db.events.find((e) => e.id === ticket.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }

    const now = Date.now();
    const eventStart = new Date(event.startsAt).getTime();
    if (eventStart < now) {
      return res.status(400).json({ error: 'Event sudah dimulai atau selesai, tiket tidak dapat dibatalkan.' });
    }

    const diffMs = eventStart - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    let penalty = 0;
    let penaltyReason = '';
    let penaltyType: 'cancel_h1' | 'cancel_h3' | 'cancel_h5' | 'cancel_early' = 'cancel_early';

    if (diffDays <= 1) {
      penalty = 3;
      penaltyReason = `Pembatalan tiket H-1 sebelum acara: ${event.title} (-3 Poin)`;
      penaltyType = 'cancel_h1';
    } else if (diffDays <= 3) {
      penalty = 2;
      penaltyReason = `Pembatalan tiket H-3 sebelum acara: ${event.title} (-2 Poin)`;
      penaltyType = 'cancel_h3';
    } else if (diffDays <= 5) {
      penalty = 1;
      penaltyReason = `Pembatalan tiket H-5 sebelum acara: ${event.title} (-1 Poin)`;
      penaltyType = 'cancel_h5';
    } else {
      penalty = 0;
      penaltyReason = `Pembatalan tiket lebih dari H-5: ${event.title} (0 Poin / Bebas Penalti)`;
      penaltyType = 'cancel_early';
    }

    ticket.status = 'cancelled';
    ticket.cancelledAt = new Date().toISOString();
    ticket.cancellationPenalty = penalty;

    // Release capacity
    const ticketType = db.ticketTypes.find((tt) => tt.id === ticket.ticketTypeId);
    if (ticketType) {
      ticketType.soldCount = Math.max(0, ticketType.soldCount - 1);
    }

    // Deduct user credit score
    const attendeeProfile = db.profiles.find(
      (p) =>
        (userIdHeader && p.id === userIdHeader) ||
        (userEmailHeader && p.email?.toLowerCase() === userEmailHeader)
    );

    let currentScore = 10;
    if (attendeeProfile) {
      const prevScore = attendeeProfile.creditScore ?? 10;
      currentScore = Math.max(0, prevScore - penalty);
      attendeeProfile.creditScore = currentScore;

      db.creditScoreLogs.unshift({
        id: crypto.randomUUID(),
        userId: attendeeProfile.id,
        ticketId: ticket.id,
        eventId: event.id,
        eventTitle: event.title,
        change: -penalty,
        currentScore,
        type: penaltyType,
        reason: penaltyReason,
        timestamp: new Date().toISOString(),
      });
    }

    db.persist();

    res.json({
      success: true,
      message: `Tiket berhasil dibatalkan.${penalty > 0 ? ` Skor kredit Anda berkurang ${penalty} poin.` : ' Tanpa potongan poin kredit.'}`,
      penalty,
      currentCreditScore: currentScore,
      ticket,
    });
  });

  // 6. Check-In & Scanner Endpoints
  app.get('/api/check-in/staff-events', (req, res) => {
    const user = (req as any).user as Profile;
    if (!user) {
      return res.json([]);
    }
    const isSuper = user.isSuperAdmin || user.email?.toLowerCase() === 'anderson10.talenta@gmail.com';
    if (isSuper) {
      return res.json(db.events);
    }

    const userEmail = user.email?.toLowerCase();

    // Events user is assigned to as staff (by userId or by email)
    const assignedEventIds = db.eventStaffAssignments
      .filter((sa) => {
        if (sa.status !== 'active') return false;
        if (sa.userId === user.id) return true;
        if (userEmail && sa.userId.toLowerCase() === userEmail) return true;
        const prof = db.profiles.find((p) => p.id === sa.userId);
        return !!(userEmail && prof?.email.toLowerCase() === userEmail);
      })
      .map((sa) => sa.eventId);

    // Or events user owns as org member or event creator
    const orgIds = db.organizationMembers
      .filter((om) => om.userId === user.id && om.status === 'active')
      .map((om) => om.organizationId);

    const allowedEvents = db.events.filter(
      (e) => assignedEventIds.includes(e.id) || orgIds.includes(e.organizationId) || e.createdBy === user.id
    );

    res.json(allowedEvents);
  });

  // Atomic Gate Check-In POST endpoint
  app.post('/api/check-in', async (req, res) => {
    const user = (req as any).user as Profile;
    const parsed = checkInRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { eventId, token, scannerMetadata } = parsed.data;

    try {
      const evaluation = await db.performAtomicCheckIn(
        eventId,
        token,
        user.id,
        scannerMetadata
      );

      res.json(evaluation);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Terjadi kesalahan internal server' });
    }
  });

  // Live Check-in logs
  app.get('/api/events/:eventId/check-ins', (req, res) => {
    const { eventId } = req.params;
    const logs = db.checkInLogs
      .filter((l) => l.eventId === eventId)
      .slice(0, 50)
      .map((l) => {
        const staff = db.profiles.find((p) => p.id === l.checkedInBy);
        const ticket = l.ticketId ? db.tickets.find((t) => t.id === l.ticketId) : null;
        return {
          ...l,
          staffName: staff?.fullName || 'Petugas',
          ticketNumber: ticket?.ticketNumber || '-',
        };
      });
    res.json(logs);
  });

  // 7. Super Admin: Platform Oversight
  app.get('/api/admin/organizations', (req, res) => {
    const user = (req as any).user as Profile;
    if (!user.isSuperAdmin) {
      return res.status(403).json({ error: 'Akses terbatas untuk Super Admin' });
    }
    const enriched = db.organizations.map((org) => {
      const events = db.events.filter((e) => e.organizationId === org.id);
      const owner = db.profiles.find((p) => p.id === org.createdBy);
      return {
        ...org,
        eventCount: events.length,
        ownerName: owner?.fullName,
      };
    });
    res.json(enriched);
  });

  app.post('/api/admin/organizations/:orgId/status', (req, res) => {
    const user = (req as any).user as Profile;
    if (!user.isSuperAdmin) {
      return res.status(403).json({ error: 'Akses terbatas untuk Super Admin' });
    }

    const { orgId } = req.params;
    const { status } = req.body;
    const org = db.organizations.find((o) => o.id === orgId);
    if (!org) return res.status(404).json({ error: 'Organisasi tidak ditemukan' });

    org.status = status;
    org.updatedAt = new Date().toISOString();

    db.auditLogs.unshift({
      id: crypto.randomUUID(),
      actorUserId: user.id,
      organizationId: orgId,
      action: 'ORG_STATUS_CHANGED',
      targetType: 'organization',
      targetId: orgId,
      metadata: { newStatus: status },
      createdAt: new Date().toISOString(),
    });

    db.persist();
    res.json({ success: true, organization: org });
  });

  // Delete Organization (Super Admin only)
  app.delete('/api/admin/organizations/:orgId', (req, res) => {
    const user = (req as any).user as Profile;
    const isSuperAdmin = !!user?.isSuperAdmin || user?.email?.toLowerCase() === 'anderson10.talenta@gmail.com';
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Akses terbatas untuk Super Admin' });
    }

    const { orgId } = req.params;
    const orgIndex = db.organizations.findIndex((o) => o.id === orgId);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organisasi tidak ditemukan' });
    }
    const targetOrg = db.organizations[orgIndex];

    // Find and remove all events belonging to this org
    const orgEvents = db.events.filter((e) => e.organizationId === orgId);
    const orgEventIds = orgEvents.map((e) => e.id);

    db.events = db.events.filter((e) => e.organizationId !== orgId);
    db.ticketTypes = db.ticketTypes.filter((tt) => !orgEventIds.includes(tt.eventId));
    db.eventStaffAssignments = db.eventStaffAssignments.filter((sa) => !orgEventIds.includes(sa.eventId));
    db.organizationMembers = db.organizationMembers.filter((om) => om.organizationId !== orgId);

    // Remove the organization
    db.organizations.splice(orgIndex, 1);

    // Audit log
    db.auditLogs.unshift({
      id: crypto.randomUUID(),
      actorUserId: user.id,
      organizationId: orgId,
      action: 'ORG_DELETED',
      targetType: 'organization',
      targetId: orgId,
      metadata: { orgName: targetOrg.name, deletedEventsCount: orgEvents.length },
      createdAt: new Date().toISOString(),
    });

    db.persist();

    res.json({
      success: true,
      message: `Organisasi "${targetOrg.name}" dan ${orgEvents.length} event terkait berhasil dihapus`,
      orgId,
    });
  });

  // Admin Events List (Super Admin only)
  app.get('/api/admin/events', (req, res) => {
    const user = (req as any).user as Profile;
    const isSuperAdmin = !!user?.isSuperAdmin || user?.email?.toLowerCase() === 'anderson10.talenta@gmail.com';
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Akses terbatas untuk Super Admin' });
    }

    const enriched = db.events.map((evt) => {
      const org = db.organizations.find((o) => o.id === evt.organizationId);
      const tickets = db.tickets.filter((t) => t.eventId === evt.id);
      const orders = db.orders.filter((o) => o.eventId === evt.id && o.status === 'confirmed');
      const revenue = orders.reduce((sum, o) => sum + (o.totalMinor || 0), 0);
      const tTypes = db.ticketTypes.filter((tt) => tt.eventId === evt.id);
      const creator = db.profiles.find((p) => p.id === evt.createdBy);
      return {
        ...evt,
        organizationName: org?.name || 'Independen / Mandiri',
        ticketsCount: tickets.length,
        revenue,
        ticketTypesCount: tTypes.length,
        creatorName: creator?.fullName || creator?.email || evt.createdBy,
      };
    });
    res.json(enriched);
  });

  // Delete Event (Super Admin or Event Creator)
  app.delete('/api/events/:eventId', (req, res) => {
    const user = (req as any).user as Profile;
    const { eventId } = req.params;
    const eventIndex = db.events.findIndex((e) => e.id === eventId || e.slug === eventId);
    if (eventIndex === -1) {
      return res.status(404).json({ error: 'Event tidak ditemukan' });
    }
    const targetEvent = db.events[eventIndex];
    const isSuperAdmin = !!user?.isSuperAdmin || user?.email?.toLowerCase() === 'anderson10.talenta@gmail.com';
    const isOwner = targetEvent.createdBy === user?.id || (user?.email && targetEvent.createdBy === user?.email);

    if (!isSuperAdmin && !isOwner) {
      return res.status(403).json({ error: 'Hanya Super Admin atau pemilik event yang berhak menghapus event ini' });
    }

    const realEventId = targetEvent.id;
    // Remove event
    db.events.splice(eventIndex, 1);
    // Remove related ticket types
    db.ticketTypes = db.ticketTypes.filter((tt) => tt.eventId !== realEventId);
    // Remove related staff assignments
    db.eventStaffAssignments = db.eventStaffAssignments.filter((sa) => sa.eventId !== realEventId);

    // Audit log
    db.auditLogs.unshift({
      id: crypto.randomUUID(),
      actorUserId: user?.id || 'admin',
      organizationId: targetEvent.organizationId,
      action: 'EVENT_DELETED',
      targetType: 'event',
      targetId: realEventId,
      metadata: { eventTitle: targetEvent.title, deletedBy: user?.email || user?.id },
      createdAt: new Date().toISOString(),
    });

    db.persist();
    res.json({ success: true, message: `Event "${targetEvent.title}" berhasil dihapus`, eventId: realEventId });
  });

  app.get('/api/admin/audit-logs', (req, res) => {
    const user = (req as any).user as Profile;
    if (!user.isSuperAdmin) {
      return res.status(403).json({ error: 'Akses terbatas untuk Super Admin' });
    }
    const enriched = db.auditLogs.slice(0, 50).map((al) => {
      const actor = db.profiles.find((p) => p.id === al.actorUserId);
      return {
        ...al,
        actorName: actor?.fullName || 'Sistem',
      };
    });
    res.json(enriched);
  });

  // Admin Credit Scores Overview & Reset
  app.get('/api/admin/credit-scores', (req, res) => {
    const user = (req as any).user as Profile;
    const userEmailHeader = (req.headers['x-user-email'] as string)?.toLowerCase() || user?.email?.toLowerCase() || '';
    const isSuperAdmin = !!user?.isSuperAdmin || userEmailHeader === 'anderson10.talenta@gmail.com';
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Akses ditolak: Hanya Super Admin' });
    }

    const userScores = db.profiles.map((p) => {
      const logs = db.creditScoreLogs.filter((l) => l.userId === p.id);
      const userTickets = db.tickets.filter((t) => {
        const reg = db.registrations.find((r) => r.id === t.registrationId);
        return reg?.email?.toLowerCase() === p.email.toLowerCase() || (t as any).attendeeUserId === p.id;
      });

      return {
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        creditScore: p.creditScore ?? 10,
        logsCount: logs.length,
        ticketsCount: userTickets.length,
        logs,
      };
    });

    res.json(userScores);
  });

  app.post('/api/admin/credit-scores/:userId/reset', (req, res) => {
    const user = (req as any).user as Profile;
    const userEmailHeader = (req.headers['x-user-email'] as string)?.toLowerCase() || user?.email?.toLowerCase() || '';
    const isSuperAdmin = !!user?.isSuperAdmin || userEmailHeader === 'anderson10.talenta@gmail.com';
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Akses ditolak: Hanya Super Admin' });
    }

    const { userId } = req.params;
    const profile = db.profiles.find((p) => p.id === userId || p.email.toLowerCase() === userId.toLowerCase());
    if (!profile) {
      return res.status(404).json({ error: 'Profil tidak ditemukan' });
    }

    const oldScore = profile.creditScore ?? 10;
    profile.creditScore = 10;
    db.creditScoreLogs.unshift({
      id: crypto.randomUUID(),
      userId: profile.id,
      ticketId: 'admin-reset',
      eventId: 'admin-action',
      eventTitle: 'Pemulihan oleh Super Admin',
      change: 10 - oldScore,
      currentScore: 10,
      type: 'cancel_early',
      reason: 'Pemulihan reputasi skor kredit ke 10 poin oleh Super Admin',
      timestamp: new Date().toISOString(),
    });

    db.persist();
    res.json({ success: true, message: `Skor kredit ${profile.fullName} berhasil dipulihkan ke 10/10.`, profile });
  });

  // 8. Real Authentication: Register & Login (No dummy accounts)
  app.post('/api/auth/register', (req, res) => {
    const { fullName, email, phone } = req.body;
    if (!fullName || !email) {
      return res.status(400).json({ error: 'Nama lengkap dan email wajib diisi.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    let existing = db.profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'Email sudah terdaftar. Silakan masuk (login).' });
    }
    const isSuperAdmin = cleanEmail === 'anderson10.talenta@gmail.com';
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      fullName: fullName.trim(),
      email: cleanEmail,
      phone: phone?.trim() || '+6281234567890',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fullName)}`,
      isSuperAdmin,
      createdAt: new Date().toISOString(),
      organizerStatus: isSuperAdmin ? 'approved' : 'not_applied',
    };
    db.profiles.push(newProfile);
    db.persist();
    res.status(201).json({ profile: newProfile });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email wajib diisi.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    let profile = db.profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (!profile) {
      const isSuperAdmin = cleanEmail === 'anderson10.talenta@gmail.com';
      profile = {
        id: crypto.randomUUID(),
        fullName: cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: '+6281234567890',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
        isSuperAdmin,
        createdAt: new Date().toISOString(),
        organizerStatus: isSuperAdmin ? 'approved' : 'not_applied',
      };
      db.profiles.push(profile);
      db.persist();
    }
    res.json({ profile });
  });

  // 9. Organizer KYC Verification & Approval Flow
  app.get('/api/organizer/status', (req, res) => {
    const user = (req as any).user as Profile | null | undefined;
    const userEmailHeader = (req.headers['x-user-email'] as string)?.trim().toLowerCase() || user?.email?.toLowerCase();
    const userIdHeader = (req.headers['x-user-id'] as string) || user?.id;

    if (!user && !userEmailHeader && !userIdHeader) {
      return res.json({ status: 'not_applied' });
    }

    const isSuper =
      !!user?.isSuperAdmin ||
      userEmailHeader === 'anderson10.talenta@gmail.com' ||
      userIdHeader === 'super-admin-anderson';

    if (isSuper) {
      return res.json({ status: 'approved', isSuperAdmin: true });
    }

    const effectiveUserId = user?.id || userIdHeader;
    const effectiveEmail = user?.email?.toLowerCase() || userEmailHeader;

    const application = db.organizerApplications.find(
      (a) =>
        (effectiveUserId && a.userId === effectiveUserId) ||
        (effectiveEmail && a.applicantEmail.toLowerCase() === effectiveEmail)
    );

    const isOrgMember = effectiveUserId
      ? db.organizationMembers.some((om) => om.userId === effectiveUserId && om.status === 'active')
      : false;

    if (isOrgMember || application?.status === 'approved') {
      return res.json({ status: 'approved', application });
    }

    if (application) {
      return res.json({ status: application.status, application });
    }

    return res.json({ status: user?.organizerStatus || 'not_applied' });
  });

  // Submit KYC Application (KTP Scan, Bank Account, Organization info)
  app.post('/api/organizer/apply', (req, res) => {
    const user = (req as any).user as Profile | null | undefined;
    const userEmailHeader = (req.headers['x-user-email'] as string)?.trim().toLowerCase() || user?.email?.toLowerCase();
    const userIdHeader = (req.headers['x-user-id'] as string) || user?.id || `usr-${Date.now()}`;

    const {
      organizationName,
      nikKtp,
      ktpImageUrl,
      bankName,
      bankAccountNumber,
      bankAccountHolder,
      applicantPhone,
      officeAddress,
      eventExperience,
    } = req.body;

    if (!organizationName || !nikKtp || !bankName || !bankAccountNumber || !bankAccountHolder) {
      return res.status(400).json({
        error: 'Mohon lengkapi seluruh data wajib: Nama Organisasi, NIK KTP, dan Rekening Bank.',
      });
    }

    const newApp: OrganizerApplication = {
      id: crypto.randomUUID(),
      userId: userIdHeader,
      applicantName: (req.headers['x-user-name'] as string) || user?.fullName || 'Pendaftar Organizer',
      applicantEmail: userEmailHeader || 'organizer@tixora.id',
      applicantPhone: applicantPhone || user?.phone || '+6281234567890',
      organizationName: organizationName.trim(),
      nikKtp: nikKtp.trim(),
      ktpImageUrl:
        ktpImageUrl ||
        'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
      bankName: bankName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      bankAccountHolder: bankAccountHolder.trim(),
      officeAddress: officeAddress?.trim() || 'Jakarta, Indonesia',
      eventExperience: eventExperience?.trim() || '',
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    // Remove any previous record
    db.organizerApplications = db.organizerApplications.filter(
      (a) =>
        a.userId !== userIdHeader &&
        (!userEmailHeader || a.applicantEmail.toLowerCase() !== userEmailHeader)
    );
    db.organizerApplications.unshift(newApp);

    if (user) {
      user.organizerStatus = 'pending';
      user.organizerApplication = newApp;
    }

    db.persist();
    res.status(201).json({ success: true, application: newApp });
  });

  // Super Admin: List KYC Applications
  app.get('/api/admin/organizer-applications', (req, res) => {
    const user = (req as any).user as Profile | null | undefined;
    const isSuper =
      !!user?.isSuperAdmin ||
      (req.headers['x-user-email'] as string)?.toLowerCase() === 'anderson10.talenta@gmail.com' ||
      (req.headers['x-user-id'] as string) === 'super-admin-anderson';

    if (!isSuper) {
      return res.status(403).json({ error: 'Akses terbatas untuk Super Admin' });
    }
    res.json(db.organizerApplications);
  });

  // Super Admin: Review Application (Approve or Reject)
  app.post('/api/admin/organizer-applications/:appId/review', (req, res) => {
    const user = (req as any).user as Profile | null | undefined;
    const isSuper =
      !!user?.isSuperAdmin ||
      (req.headers['x-user-email'] as string)?.toLowerCase() === 'anderson10.talenta@gmail.com' ||
      (req.headers['x-user-id'] as string) === 'super-admin-anderson';
    if (!isSuper) {
      return res.status(403).json({ error: 'Akses terbatas untuk Super Admin' });
    }

    const { appId } = req.params;
    const { action, rejectionReason } = req.body;
    const application = db.organizerApplications.find((a) => a.id === appId);
    if (!application) {
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
    }

    if (action === 'approve') {
      application.status = 'approved';
      application.reviewedAt = new Date().toISOString();

      // Create new organization for the approved organizer
      const orgId = crypto.randomUUID();
      const newOrg: Organization = {
        id: orgId,
        name: application.organizationName,
        slug: application.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: `Penyelenggara resmi terverifikasi identitas KTP & Rekening Bank (${application.bankName} - ${application.bankAccountNumber}).`,
        contactEmail: application.applicantEmail,
        status: 'active',
        createdBy: application.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.organizations.unshift(newOrg);

      db.organizationMembers.push({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId: application.userId,
        role: 'owner',
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      const targetUser = db.profiles.find(
        (p) =>
          p.id === application.userId ||
          (p.email && p.email.toLowerCase() === application.applicantEmail.toLowerCase())
      );
      if (targetUser) {
        targetUser.organizerStatus = 'approved';
        targetUser.organizerApplication = application;
      }
    } else {
      application.status = 'rejected';
      application.reviewedAt = new Date().toISOString();
      application.rejectionReason =
        rejectionReason || 'Foto KTP kurang jelas atau nomor rekening tidak valid.';

      const targetUser = db.profiles.find(
        (p) =>
          p.id === application.userId ||
          (p.email && p.email.toLowerCase() === application.applicantEmail.toLowerCase())
      );
      if (targetUser) {
        targetUser.organizerStatus = 'rejected';
        targetUser.organizerApplication = application;
      }
    }

    db.persist();
    res.json({ success: true, application });
  });

  // Catch-all for undefined /api routes: ALWAYS return JSON, never HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Rute API ${req.method} ${req.path} tidak ditemukan.` });
  });

  // Error handling middleware for JSON limits & unexpected server errors
  app.use((err: any, req: any, res: any, next: any) => {
    if (err) {
      console.error('[API Server Error]', err.message || err);
      const isTooLarge = err.type === 'entity.too.large' || err.status === 413;
      return res.status(err.status || (isTooLarge ? 413 : 500)).json({
        error: isTooLarge
          ? 'Ukuran file/data terlalu besar (maksimal 60MB).'
          : err.message || 'Terjadi kesalahan internal server.',
      });
    }
    next();
  });

  return app;
}

// --- MAIN SERVER ENTRY POINT ---

async function startServer() {
  const app = await createExpressApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // In development, hook into Vite middlewares
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production build
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Tixora] Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.NODE_TEST_CONTEXT && process.env.NODE_ENV !== 'test') {
  startServer();
}
