export type Role = 'owner' | 'manager';
export type OrgStatus = 'pending' | 'active' | 'suspended';
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type OrderStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'refunded';
export type TicketStatus = 'pending' | 'valid' | 'cancelled' | 'checked_in' | 'expired' | 'completed' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
export type CheckInResultType = 
  | 'success' 
  | 'already_used' 
  | 'invalid' 
  | 'cancelled' 
  | 'unpaid' 
  | 'wrong_event' 
  | 'unauthorized';

export type OrganizerVerificationStatus = 'not_applied' | 'pending' | 'approved' | 'rejected';

export interface OrganizerApplication {
  id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  organizationName: string;
  nikKtp: string;
  ktpImageUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  officeAddress: string;
  eventExperience?: string;
  status: OrganizerVerificationStatus;
  submittedAt: string;
  createdAt?: string;
  ktpNumber?: string;
  ktpPhotoUrl?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  creditScore?: number; // 0 to 10 points (default 10)
  createdAt: string;
  organizerStatus?: OrganizerVerificationStatus;
  organizerApplication?: OrganizerApplication;
}

export interface EventCategory {
  id: string;
  name: string;
  iconName: string;
  description?: string;
  createdAt: string;
}

export interface CreditScoreLog {
  id: string;
  userId: string;
  ticketId?: string;
  eventId?: string;
  eventTitle?: string;
  change: number; // e.g. -3, -2, -1, 0
  currentScore: number;
  type: 'cancel_h1' | 'cancel_h3' | 'cancel_h5' | 'cancel_early' | 'no_show' | 'admin_adjustment';
  reason: string;
  timestamp: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string;
  contactEmail: string;
  status: OrgStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  status: 'active' | 'invited' | 'suspended';
  createdAt: string;
}

export interface Event {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  coverImageUrl?: string;
  venueName: string;
  venueAddress: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  salesStartsAt: string;
  salesEndsAt: string;
  status: EventStatus;
  isCompleted?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  priceMinor: number;
  currency: string;
  capacity: number;
  soldCount: number;
  reservedCount: number;
  salesStartsAt?: string;
  salesEndsAt?: string;
  maxPerOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  attendeeUserId: string;
  eventId: string;
  subtotalMinor: number;
  feesMinor: number;
  totalMinor: number;
  currency: string;
  status: OrderStatus;
  paymentMethod?: string;
  paymentProofUrl?: string;
  paymentProofUploadedAt?: string;
  senderName?: string;
  senderBank?: string;
  paymentNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  ticketTypeId: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  createdAt: string;
}

export interface Registration {
  id: string;
  orderId: string;
  attendeeUserId: string;
  eventId: string;
  fullName: string;
  email: string;
  phone?: string;
  registrationData?: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  registrationId: string;
  ticketTypeId: string;
  eventId: string;
  ticketNumber: string;
  tokenHash: string;
  status: TicketStatus;
  issuedAt: string;
  checkedInAt?: string;
  checkedInBy?: string;
  cancelledAt?: string;
  cancellationPenalty?: number;
  noShow?: boolean;
  completedAt?: string;
  createdAt: string;
  // Raw token is NEVER stored in database, only temporarily provided to legitimate buyer or during gate verification
  rawToken?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  providerReference: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentWebhookEvent {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  processingStatus: 'received' | 'processed' | 'failed' | 'ignored';
  receivedAt: string;
  processedAt?: string;
  errorMessage?: string;
}

export interface EventStaffAssignment {
  id: string;
  eventId: string;
  userId: string;
  assignedBy?: string;
  status: 'active' | 'revoked';
  createdAt: string;
}

export interface CheckInLog {
  id: string;
  ticketId?: string;
  eventId: string;
  checkedInBy: string;
  result: CheckInResultType;
  scannedAt: string;
  scannerMetadata?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  actorUserId?: string;
  organizationId?: string;
  eventId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
