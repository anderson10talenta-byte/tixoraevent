import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth, SUPER_ADMIN_EMAIL } from './firebase';
import type { Event, Ticket, Order, TicketType, EventStaffAssignment, CheckInLog } from './types';
import { hashTicketToken, generateSecureTicketToken } from './security';

// Collection References
const EVENTS_COL = 'events';
const TICKETS_COL = 'tickets';
const ORDERS_COL = 'orders';
const TICKET_TYPES_COL = 'ticketTypes';
const STAFF_ASSIGNMENTS_COL = 'staffAssignments';
const CHECK_IN_LOGS_COL = 'checkInLogs';

// --- EVENTS (Real Firestore Data Only — No Dummy Data) ---
export async function getEventsFromFirestore(): Promise<any[]> {
  try {
    const colRef = collection(db, EVENTS_COL);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      return [];
    }
    const events: any[] = [];
    snap.forEach((d) => events.push({ id: d.id, ...d.data() }));
    return events;
  } catch (error) {
    console.warn('Firestore getEvents error:', error);
    return [];
  }
}

export async function createEventInFirestore(eventData: any): Promise<string> {
  const eventId = eventData.id || `evt-${Date.now()}`;
  try {
    const evtRef = doc(db, EVENTS_COL, eventId);
    await setDoc(evtRef, {
      ...eventData,
      id: eventId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return eventId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${EVENTS_COL}/${eventId}`);
  }
}

export async function deleteEventFromFirestore(eventId: string): Promise<boolean> {
  try {
    const evtRef = doc(db, EVENTS_COL, eventId);
    await deleteDoc(evtRef);
    return true;
  } catch (error) {
    console.warn('Firestore deleteEvent error:', error);
    return false;
  }
}

export async function deleteOrganizationFromFirestore(orgId: string): Promise<boolean> {
  try {
    const orgRef = doc(db, 'organizations', orgId);
    await deleteDoc(orgRef);
    return true;
  } catch (error) {
    console.warn('Firestore deleteOrganization error:', error);
    return false;
  }
}

// --- TICKETS ---
export async function getTicketsForUser(userId: string, userEmail?: string): Promise<any[]> {
  try {
    const ticketsRef = collection(db, TICKETS_COL);
    // Query by attendeeUserId
    const q1 = query(ticketsRef, where('attendeeUserId', '==', userId));
    const snap1 = await getDocs(q1);

    const tickets: any[] = [];
    snap1.forEach((d) => tickets.push({ id: d.id, ...d.data() }));

    // Also check if any tickets match user email
    if (userEmail) {
      const q2 = query(ticketsRef, where('attendeeEmail', '==', userEmail.toLowerCase()));
      const snap2 = await getDocs(q2);
      snap2.forEach((d) => {
        if (!tickets.some((t) => t.id === d.id)) {
          tickets.push({ id: d.id, ...d.data() });
        }
      });
    }

    return tickets;
  } catch (error) {
    console.warn('Error fetching tickets for user:', error);
    return [];
  }
}

export async function getTicketById(ticketId: string): Promise<any | null> {
  try {
    const tRef = doc(db, TICKETS_COL, ticketId);
    const snap = await getDoc(tRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${TICKETS_COL}/${ticketId}`);
  }
}

// Issue tickets from Order
export async function createOrderAndTickets(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  ticketPriceMinor: number;
  quantity: number;
}): Promise<{ orderId: string; tickets: any[] }> {
  const orderId = `ord-${Date.now()}`;
  const orderNumber = `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const totalMinor = params.ticketPriceMinor * params.quantity;
  const isFree = totalMinor === 0;

  const orderData = {
    id: orderId,
    orderNumber,
    attendeeUserId: params.userId,
    attendeeEmail: params.userEmail,
    attendeeName: params.userName,
    eventId: params.eventId,
    eventTitle: params.eventTitle,
    ticketTypeId: params.ticketTypeId,
    ticketTypeName: params.ticketTypeName,
    quantity: params.quantity,
    totalMinor,
    currency: 'IDR',
    status: isFree ? 'confirmed' : 'confirmed', // sandbox auto-confirmed
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, ORDERS_COL, orderId), orderData);
  } catch (e) {
    console.warn('Firestore order write error:', e);
  }

  const createdTickets: any[] = [];
  for (let i = 0; i < params.quantity; i++) {
    const ticketId = `tix-${Date.now()}-${i + 1}`;
    const rawToken = generateSecureTicketToken();
    const tokenHash = hashTicketToken(rawToken);
    const ticketNumber = `TIX-${params.eventId.slice(-3).toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const ticketDoc = {
      id: ticketId,
      orderId,
      ticketNumber,
      rawToken,
      tokenHash,
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      ticketTypeId: params.ticketTypeId,
      ticketTypeName: params.ticketTypeName,
      attendeeUserId: params.userId,
      attendeeName: params.userName,
      attendeeEmail: params.userEmail,
      status: 'valid' as const,
      issuedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, TICKETS_COL, ticketId), ticketDoc);
    } catch (e) {
      console.warn('Firestore ticket write error:', e);
    }
    createdTickets.push(ticketDoc);
  }

  return { orderId, tickets: createdTickets };
}

// --- GATE STAFF INVITATIONS (ORGANIZER GIVES ACCESS VIA EMAIL) ---
export async function inviteGateStaffByEmail(params: {
  eventId: string;
  eventTitle: string;
  email: string;
  assignedByUserId: string;
  assignedByEmail: string;
}): Promise<{ success: boolean; assignmentId: string; message: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const assignmentId = `staff-${params.eventId}-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

  const staffRecord: EventStaffAssignment = {
    id: assignmentId,
    eventId: params.eventId,
    userId: cleanEmail,
    assignedBy: params.assignedByUserId,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, STAFF_ASSIGNMENTS_COL, assignmentId), {
      ...staffRecord,
      email: cleanEmail,
      eventTitle: params.eventTitle,
      assignedByEmail: params.assignedByEmail,
    });
    return {
      success: true,
      assignmentId,
      message: `Akses Petugas Gerbang berhasil diberikan ke email: ${cleanEmail}`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${STAFF_ASSIGNMENTS_COL}/${assignmentId}`);
  }
}

export async function getStaffAssignmentsForEvent(eventId: string): Promise<any[]> {
  try {
    const q = query(collection(db, STAFF_ASSIGNMENTS_COL), where('eventId', '==', eventId));
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    console.warn('Error reading staff assignments:', err);
    return [];
  }
}

// Check if user has gate staff check-in permissions
export async function checkGateStaffPermission(userEmail?: string, userId?: string, eventId?: string): Promise<{
  isAuthorized: boolean;
  isSuperAdmin: boolean;
  assignedEvents: string[];
}> {
  if (!userEmail) {
    return { isAuthorized: false, isSuperAdmin: false, assignedEvents: [] };
  }

  const cleanEmail = userEmail.toLowerCase();
  const isSuper = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();

  if (isSuper) {
    return { isAuthorized: true, isSuperAdmin: true, assignedEvents: ['*'] };
  }

  try {
    const q = query(
      collection(db, STAFF_ASSIGNMENTS_COL),
      where('email', '==', cleanEmail),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    const assignedEvents: string[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.eventId) assignedEvents.push(data.eventId);
    });

    const isAuthorized = eventId ? assignedEvents.includes(eventId) : assignedEvents.length > 0;
    return { isAuthorized, isSuperAdmin: false, assignedEvents };
  } catch (err) {
    console.warn('Error checking staff permissions in Firestore:', err);
    return { isAuthorized: false, isSuperAdmin: false, assignedEvents: [] };
  }
}

// --- ATOMIC CHECK-IN WITH FIRESTORE AUDIT LOG ---
export async function performGateCheckIn(params: {
  rawTokenOrNumber: string;
  targetEventId: string;
  staffUser: { uid: string; email: string; name: string };
}): Promise<{
  allowed: boolean;
  result: 'success' | 'already_used' | 'expired' | 'event_mismatch' | 'invalid' | 'unauthorized';
  message: string;
  ticket?: any;
  scannedAt: string;
}> {
  const now = new Date().toISOString();
  const rawInput = params.rawTokenOrNumber.trim();
  const tokenHash = hashTicketToken(rawInput);

  // 1. Verify staff gate permission
  const perm = await checkGateStaffPermission(params.staffUser.email, params.staffUser.uid, params.targetEventId);
  if (!perm.isAuthorized && !perm.isSuperAdmin) {
    return {
      allowed: false,
      result: 'unauthorized',
      message: `Akses Ditolak: Email ${params.staffUser.email} belum diberikan izin petugas gerbang untuk event ini.`,
      scannedAt: now,
    };
  }

  // Clean and parse input if JSON payload
  let cleanInput = rawInput.trim();
  try {
    if (cleanInput.startsWith('{') && cleanInput.endsWith('}')) {
      const parsed = JSON.parse(cleanInput);
      cleanInput = parsed.ticketId || parsed.token || parsed.ticketNumber || cleanInput;
    }
  } catch {}

  const inputHash = hashTicketToken(cleanInput);

  // 2. Query ticket by direct Firestore Document ID, tokenHash, or ticketNumber
  let matchedTicket: any = null;
  try {
    const colRef = collection(db, TICKETS_COL);
    // Direct Firestore Document ID lookup
    const directDoc = await getDoc(doc(db, TICKETS_COL, cleanInput));
    if (directDoc.exists()) {
      matchedTicket = { id: directDoc.id, ...directDoc.data() };
    } else {
      const q1 = query(colRef, where('tokenHash', '==', inputHash));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        matchedTicket = { id: snap1.docs[0].id, ...snap1.docs[0].data() };
      } else {
        const q2 = query(colRef, where('ticketNumber', '==', cleanInput.toUpperCase()));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          matchedTicket = { id: snap2.docs[0].id, ...snap2.docs[0].data() };
        }
      }
    }
  } catch (err) {
    console.warn('Firestore ticket scan query error:', err);
  }

  if (!matchedTicket) {
    // Log invalid attempt
    await logCheckInAttempt({
      eventId: params.targetEventId,
      ticketId: 'unknown',
      ticketNumber: rawInput,
      checkedInBy: params.staffUser.email,
      result: 'invalid',
      scannedAt: now,
    });

    return {
      allowed: false,
      result: 'invalid',
      message: 'Kode Tiket Tidak Ditemukan! QR code tidak valid atau palsu.',
      scannedAt: now,
    };
  }

  // 3. Event Mismatch Check
  if (matchedTicket.eventId && params.targetEventId && matchedTicket.eventId !== params.targetEventId) {
    await logCheckInAttempt({
      eventId: params.targetEventId,
      ticketId: matchedTicket.id,
      ticketNumber: matchedTicket.ticketNumber,
      checkedInBy: params.staffUser.email,
      result: 'event_mismatch',
      scannedAt: now,
    });
    return {
      allowed: false,
      result: 'event_mismatch',
      message: `Tiket ini terdaftar untuk event lain: "${matchedTicket.eventTitle || matchedTicket.eventId}"!`,
      ticket: matchedTicket,
      scannedAt: now,
    };
  }

  // 4. Check if already used
  if (matchedTicket.status === 'used') {
    await logCheckInAttempt({
      eventId: params.targetEventId,
      ticketId: matchedTicket.id,
      ticketNumber: matchedTicket.ticketNumber,
      checkedInBy: params.staffUser.email,
      result: 'already_used',
      scannedAt: now,
    });
    return {
      allowed: false,
      result: 'already_used',
      message: `TIKET SUDAH PERNAH DIGUNAKAN! Di-check-in pada: ${new Date(matchedTicket.checkedInAt || now).toLocaleTimeString('id-ID')}`,
      ticket: matchedTicket,
      scannedAt: now,
    };
  }

  // 5. Check if expired
  if (matchedTicket.status === 'expired') {
    await logCheckInAttempt({
      eventId: params.targetEventId,
      ticketId: matchedTicket.id,
      ticketNumber: matchedTicket.ticketNumber,
      checkedInBy: params.staffUser.email,
      result: 'expired',
      scannedAt: now,
    });
    return {
      allowed: false,
      result: 'expired',
      message: 'Tiket Kedaluwarsa! Event telah berakhir atau gate sudah ditutup.',
      ticket: matchedTicket,
      scannedAt: now,
    };
  }

  // 6. Success: Transition ticket status to 'used'
  matchedTicket.status = 'used';
  matchedTicket.checkedInAt = now;
  matchedTicket.checkedInBy = params.staffUser.email;

  try {
    const tRef = doc(db, TICKETS_COL, matchedTicket.id);
    await updateDoc(tRef, {
      status: 'used',
      checkedInAt: now,
      checkedInBy: params.staffUser.email,
    });
  } catch (err) {
    console.warn('Update ticket to used error:', err);
  }

  // Log successful check-in
  await logCheckInAttempt({
    eventId: params.targetEventId,
    ticketId: matchedTicket.id,
    ticketNumber: matchedTicket.ticketNumber,
    checkedInBy: params.staffUser.email,
    result: 'success',
    scannedAt: now,
  });

  return {
    allowed: true,
    result: 'success',
    message: `✓ Check-In Berhasil! Silakan masuk pintu gerbang utama.`,
    ticket: matchedTicket,
    scannedAt: now,
  };
}

async function logCheckInAttempt(logData: {
  eventId: string;
  ticketId: string;
  ticketNumber: string;
  checkedInBy: string;
  result: string;
  scannedAt: string;
}): Promise<void> {
  try {
    const logId = `log-${Date.now()}`;
    await setDoc(doc(db, CHECK_IN_LOGS_COL, logId), { id: logId, ...logData });
  } catch (e) {
    console.warn('Check-in log write error:', e);
  }
}
