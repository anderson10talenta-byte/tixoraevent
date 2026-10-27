import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, CheckCheck, Archive } from 'lucide-react';
import type { CheckInResultType, EventStatus, TicketStatus } from '../lib/types';

interface StatusBadgeProps {
  status: EventStatus | TicketStatus | CheckInResultType | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-bold';

  switch (status) {
    case 'valid':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 border-2 border-emerald-900 font-black shadow-xs ${sizeClasses}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>Valid</span>
        </span>
      );

    case 'completed':
    case 'event_ended':
    case 'finished':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-200 text-slate-800 border-2 border-slate-700 font-black shadow-xs ${sizeClasses}`}>
          <CheckCheck className="w-3.5 h-3.5 text-slate-700" />
          <span>Selesai</span>
        </span>
      );

    case 'completed_attended':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-100 text-indigo-900 border-2 border-indigo-900 font-black shadow-xs ${sizeClasses}`}>
          <CheckCheck className="w-3.5 h-3.5 text-indigo-700" />
          <span>Selesai (Hadir)</span>
        </span>
      );

    case 'completed_noshow':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-900 border-2 border-rose-900 font-black shadow-xs ${sizeClasses}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
          <span>Selesai (Tidak Hadir)</span>
        </span>
      );

    case 'success':
    case 'active':
    case 'confirmed':
    case 'paid':
    case 'published':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 border-2 border-emerald-900 font-bold ${sizeClasses}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>
            {status === 'success' && 'Berhasil Check-In'}
            {status === 'active' && 'Aktif'}
            {status === 'confirmed' && 'Terkonfirmasi'}
            {status === 'paid' && 'Lunas'}
            {status === 'published' && 'Tayang'}
          </span>
        </span>
      );

    case 'used':
    case 'checked_in':
    case 'already_used':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 border-2 border-amber-900 font-black shadow-xs ${sizeClasses}`}>
          <CheckCheck className="w-3.5 h-3.5 text-amber-700" />
          <span>Sudah Masuk (Used)</span>
        </span>
      );

    case 'expired':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-200 text-slate-800 border-2 border-slate-700 font-black shadow-xs ${sizeClasses}`}>
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          <span>Selesai (Kadaluarsa)</span>
        </span>
      );

    case 'draft':
    case 'pending':
    case 'awaiting_approval':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-yellow-100 text-yellow-900 border-2 border-yellow-800 font-bold ${sizeClasses}`}>
          <Clock className="w-3.5 h-3.5 text-yellow-700" />
          <span>
            {status === 'draft'
              ? 'Draf'
              : status === 'awaiting_approval'
              ? 'Menunggu Verifikasi Admin'
              : 'Menunggu Pembayaran'}
          </span>
        </span>
      );

    case 'cancelled':
    case 'refunded':
    case 'failed':
    case 'suspended':
    case 'invalid':
    case 'unauthorized':
    case 'wrong_event':
    case 'rejected':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-900 border-2 border-rose-900 font-bold ${sizeClasses}`}>
          <XCircle className="w-3.5 h-3.5 text-rose-700" />
          <span>
            {status === 'cancelled' && 'Dibatalkan'}
            {status === 'rejected' && 'Ditolak'}
            {status === 'refunded' && 'Dikembalikan (Refund)'}
            {status === 'failed' && 'Gagal'}
            {status === 'suspended' && 'Ditangguhkan'}
            {status === 'invalid' && 'Tidak Valid'}
            {status === 'unauthorized' && 'Tanpa Akses'}
            {status === 'wrong_event' && 'Event Berbeda'}
          </span>
        </span>
      );

    default:
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-800 border border-slate-300 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};
