import React from 'react';
import type { CheckInResultType, EventStatus, TicketStatus } from '../lib/types';

interface StatusBadgeProps {
  status: EventStatus | TicketStatus | CheckInResultType | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  switch (status) {
    // Ticket / Check-in statuses
    case 'valid':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold shadow-xs ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Valid</span>
        </span>
      );

    case 'success':
    case 'active':
    case 'confirmed':
    case 'paid':
    case 'published':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {status === 'success' && 'Berhasil Check-In'}
          {status === 'active' && 'Aktif'}
          {status === 'confirmed' && 'Terkonfirmasi'}
          {status === 'paid' && 'Lunas'}
          {status === 'published' && 'Tayang (Published)'}
        </span>
      );

    case 'used':
    case 'checked_in':
    case 'already_used':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-bold shadow-xs ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Used</span>
        </span>
      );

    case 'expired':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300 font-bold shadow-xs ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          <span>Expired</span>
        </span>
      );

    case 'draft':
    case 'pending':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          {status === 'draft' ? 'Draf' : 'Menunggu Pembayaran'}
        </span>
      );

    case 'cancelled':
    case 'refunded':
    case 'failed':
    case 'suspended':
    case 'invalid':
    case 'unauthorized':
    case 'wrong_event':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          {status === 'cancelled' && 'Dibatalkan'}
          {status === 'refunded' && 'Dikembalikan (Refund)'}
          {status === 'failed' && 'Gagal'}
          {status === 'suspended' && 'Ditangguhkan'}
          {status === 'invalid' && 'Tidak Valid'}
          {status === 'unauthorized' && 'Tidak Memiliki Akses'}
          {status === 'wrong_event' && 'Event Berbeda'}
        </span>
      );

    default:
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};
