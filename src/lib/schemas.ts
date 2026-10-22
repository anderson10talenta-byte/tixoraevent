import { z } from 'zod';

export const createOrderSchema = z.object({
  eventId: z.string().min(1, 'Event ID wajib diisi'),
  ticketTypeId: z.string().min(1, 'Ticket Type ID wajib diisi'),
  quantity: z.number().int().min(1, 'Minimal pesan 1 tiket').max(10, 'Maksimal 10 tiket per transaksi'),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter').max(100),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(8, 'Nomor WhatsApp / telepon minimal 8 digit').max(20),
});

export const checkInRequestSchema = z.object({
  eventId: z.string().min(1, { message: 'Event ID wajib diisi' }),
  token: z.string().min(3, 'Token atau nomor tiket minimal 3 karakter'),
  idempotencyKey: z.string().optional(),
  scannerMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const createEventSchema = z.object({
  title: z.string().min(3, 'Judul event minimal 3 karakter').max(120),
  description: z.string().min(10, 'Deskripsi event minimal 10 karakter'),
  category: z.enum(['music', 'technology', 'business', 'food', 'art', 'community']),
  venueName: z.string().min(2, 'Nama venue wajib diisi'),
  venueAddress: z.string().min(5, 'Alamat venue wajib diisi'),
  coverImageUrl: z.string().optional().or(z.literal('')),
  startsAt: z.string().datetime({ message: 'Waktu mulai harus format ISO 8601' }),
  endsAt: z.string().datetime({ message: 'Waktu selesai harus format ISO 8601' }),
  salesStartsAt: z.string().optional(),
  salesEndsAt: z.string().optional(),
  ticketTypes: z.array(
    z.object({
      name: z.string().min(2, 'Nama kategori tiket wajib diisi'),
      description: z.string().optional(),
      priceMinor: z.number().int().min(0, 'Harga tiket tidak boleh negatif'),
      capacity: z.number().int().min(1, 'Kapasitas minimal 1'),
      maxPerOrder: z.number().int().min(1).max(10).default(5),
    })
  ).min(1, 'Minimal harus memiliki 1 kategori tiket'),
});

export const assignStaffSchema = z.object({
  eventId: z.string().min(1, 'Event ID wajib diisi'),
  email: z.string().email('Format email staff tidak valid'),
});
