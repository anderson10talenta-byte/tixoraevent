import type { CheckInResultType, Ticket, EventStaffAssignment } from './types.ts';

export interface CheckInEvaluationInput {
  targetEventId: string;
  staffUserId: string;
  isSuperAdmin: boolean;
  staffAssignments: EventStaffAssignment[];
  ticket: Ticket | null;
  ticketBelongsToEventId?: string;
  orderPaidOrFree: boolean;
}

export interface CheckInEvaluationResult {
  result: CheckInResultType;
  allowed: boolean;
  message: string;
}

/**
 * Pure evaluation function for check-in state machine.
 */
export function evaluateCheckIn(input: CheckInEvaluationInput): CheckInEvaluationResult {
  const {
    targetEventId,
    staffUserId,
    isSuperAdmin,
    staffAssignments,
    ticket,
    ticketBelongsToEventId,
    orderPaidOrFree,
  } = input;

  // 1. Authorization check
  const isAssigned = staffAssignments.some(
    (sa) => sa.eventId === targetEventId && sa.userId === staffUserId && sa.status === 'active'
  );

  if (!isSuperAdmin && !isAssigned) {
    return {
      result: 'unauthorized',
      allowed: false,
      message: 'Petugas tidak memiliki otorisasi untuk memindai tiket event ini.',
    };
  }

  // 2. Existence check
  if (!ticket) {
    return {
      result: 'invalid',
      allowed: false,
      message: 'Token tiket tidak valid atau tidak ditemukan dalam sistem.',
    };
  }

  // 3. Event matching check
  if (ticketBelongsToEventId && ticketBelongsToEventId !== targetEventId) {
    return {
      result: 'wrong_event',
      allowed: false,
      message: 'Tiket terdaftar untuk event lain, bukan untuk event ini.',
    };
  }

  // 4. Payment status check
  if (!orderPaidOrFree) {
    return {
      result: 'unpaid',
      allowed: false,
      message: 'Pembayaran tiket belum terkonfirmasi.',
    };
  }

  // 5. Ticket status checks
  if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
    return {
      result: 'cancelled',
      allowed: false,
      message: `Tiket telah dibatalkan (${ticket.status}).`,
    };
  }

  if (ticket.status === 'checked_in') {
    return {
      result: 'already_used',
      allowed: false,
      message: `Tiket sudah pernah digunakan pada ${ticket.checkedInAt || 'sebelumnya'}.`,
    };
  }

  if (ticket.status === 'valid') {
    return {
      result: 'success',
      allowed: true,
      message: 'Check-in berhasil! Selamat menikmati acara.',
    };
  }

  return {
    result: 'invalid',
    allowed: false,
    message: 'Status tiket tidak valid untuk check-in.',
  };
}
