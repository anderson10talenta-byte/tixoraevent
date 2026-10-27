import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Printer,
  Calendar,
  MapPin,
  Building2,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { TicketFirestoreQRCode } from '../components/TicketFirestoreQRCode';
import { StatusBadge } from '../components/StatusBadge';
import type { Profile } from '../lib/types';

interface TicketDetailPageProps {
  ticketId: string;
  currentProfile: Profile | null;
  onBack: () => void;
}

export const TicketDetailPage: React.FC<TicketDetailPageProps> = ({
  ticketId,
  currentProfile,
  onBack,
}) => {
  const [ticketData, setTicketData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTicket = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          headers: {
            'x-user-id': currentProfile?.id || '',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setTicketData(data);
        }
      } catch (err) {
        console.error('Error fetching ticket detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketId, currentProfile]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-12 text-center bg-white rounded-3xl border border-slate-200">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-500 font-medium">Menyiapkan tiket digital...</p>
      </div>
    );
  }

  if (!ticketData) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white rounded-3xl border border-slate-200 space-y-4">
        <p className="text-slate-700 font-bold">Tiket tidak ditemukan</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          Kembali
        </button>
      </div>
    );
  }

  const { event, ticketType, registration, rawToken, ticketNumber, status, checkedInAt } = ticketData;

  // Determine actual status based on ticket status and event completion
  const isEventCompleted = (event?.endsAt && new Date(event.endsAt).getTime() < Date.now()) || event?.status === 'completed' || ticketData.isEventCompleted;
  const isCancelled = status === 'cancelled';
  const isCheckedIn = status === 'checked_in' || status === 'already_used' || !!checkedInAt;

  const effectiveStatus = isCancelled
    ? 'cancelled'
    : isEventCompleted
    ? isCheckedIn
      ? 'completed_attended'
      : ticketData.noShow || status === 'expired'
      ? 'completed_noshow'
      : 'completed'
    : isCheckedIn
    ? 'used'
    : 'valid';

  const startDate = event ? new Date(event.startsAt) : new Date();
  const formattedDate = startDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime =
    startDate.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';

  return (
    <div className="max-w-md mx-auto space-y-6 pb-16">
      {/* Action buttons & Print */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer print:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Tiket</span>
        </button>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer print:hidden"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Cetak / PDF</span>
        </button>
      </div>

      {/* Ticket Boarding Pass Card */}
      <div
        className={`bg-white rounded-3xl border shadow-xl overflow-hidden print:shadow-none transition-all duration-300 ${
          effectiveStatus === 'valid'
            ? 'border-emerald-300 ring-2 ring-emerald-100'
            : effectiveStatus === 'used'
            ? 'border-amber-300 ring-2 ring-amber-100'
            : isEventCompleted
            ? 'border-slate-300 ring-2 ring-slate-100'
            : 'border-rose-300 ring-2 ring-rose-100'
        }`}
      >
        {/* Ticket Header Banner */}
        <div
          className={`p-6 text-white relative transition-colors duration-300 ${
            effectiveStatus === 'valid'
              ? 'bg-slate-900 border-b-4 border-emerald-500'
              : effectiveStatus === 'used'
              ? 'bg-slate-900 border-b-4 border-amber-500'
              : isEventCompleted
              ? 'bg-slate-900 border-b-4 border-slate-500'
              : 'bg-slate-900 border-b-4 border-rose-500'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300">
              E-Ticket Resmi • Tixora
            </span>
            {/* Color-Coded Status Badge */}
            <StatusBadge status={effectiveStatus} size="md" />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight leading-snug">
            {event?.title || 'Event Tixora'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Kategori: {ticketType?.name || 'Tiket'}</span>
          </p>
        </div>

        {/* Unique Firestore Ticket QR Code Component */}
        <div className="p-6 bg-slate-50/50 flex flex-col items-center relative">
          <div className="relative">
            <TicketFirestoreQRCode
              ticketId={ticketData.id || ticketId}
              ticketNumber={ticketNumber}
              eventId={event?.id}
              eventTitle={event?.title}
              attendeeName={registration?.fullName}
              status={isEventCompleted || isCancelled ? 'expired' : isCheckedIn ? 'used' : 'valid'}
              checkedInAt={checkedInAt}
              rawToken={rawToken}
              size={220}
            />

            {/* If event is finished, overlay QR code so it cannot be scanned */}
            {isEventCompleted && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-4 text-center text-white border-2 border-slate-700">
                <Clock className="w-10 h-10 text-amber-400 mb-2" />
                <p className="font-black text-sm uppercase tracking-wide">Acara Selesai</p>
                <p className="text-[11px] text-slate-300 max-w-[180px] mt-1 leading-tight">
                  Tiket ditutup dan tidak dapat digunakan untuk check-in.
                </p>
              </div>
            )}

            {/* If ticket was cancelled, overlay QR code */}
            {isCancelled && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-4 text-center text-white border-2 border-rose-700">
                <AlertTriangle className="w-10 h-10 text-rose-400 mb-2" />
                <p className="font-black text-sm uppercase tracking-wide">Tiket Dibatalkan</p>
                <p className="text-[11px] text-slate-300 max-w-[180px] mt-1 leading-tight">
                  Tiket ini telah dibatalkan oleh pengguna.
                </p>
              </div>
            )}
          </div>

          {/* Contextual Guidance Notice */}
          <div className="mt-3 text-center">
            {effectiveStatus === 'valid' && (
              <p className="text-xs text-emerald-800 font-semibold max-w-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                Tiket Siap Digunakan. Tunjukkan kode QR kepada petugas di pintu gerbang masuk.
              </p>
            )}

            {effectiveStatus === 'used' && (
              <p className="text-xs text-amber-900 font-semibold max-w-xs bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                Tiket ini telah diverifikasi masuk sebelumnya. Tidak dapat digunakan kembali.
              </p>
            )}

            {isEventCompleted && (
              <p className="text-xs text-slate-700 font-semibold max-w-xs bg-slate-200/80 px-3 py-1.5 rounded-xl border border-slate-300">
                Acara telah selesai. Tiket ini tetap tersimpan sebagai arsip dan tidak dapat di-scan lagi.
              </p>
            )}

            {isCancelled && (
              <p className="text-xs text-rose-800 font-semibold max-w-xs bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                Tiket telah dibatalkan.
                {ticketData.cancellationPenalty ? ` Penalti credit score: -${ticketData.cancellationPenalty} poin.` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Perforated separator line */}
        <div className="relative border-b-2 border-dashed border-slate-200">
          <div className="absolute -left-3 -top-3 w-6 h-6 bg-slate-50 rounded-full border-r border-slate-300"></div>
          <div className="absolute -right-3 -top-3 w-6 h-6 bg-slate-50 rounded-full border-l border-slate-300"></div>
        </div>

        {/* Attendee & Event Metadata */}
        <div className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Nama Pemegang Tiket
              </span>
              <span className="font-bold text-slate-800 text-sm">
                {registration?.fullName || 'Pengunjung'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Email Terdaftar
              </span>
              <span className="font-semibold text-slate-700 truncate block">
                {registration?.email || '-'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 gap-2">
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Waktu Acara
              </span>
              <span className="font-bold text-slate-800">{formattedDate}</span>
              <span className="text-slate-500 block">{formattedTime}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Lokasi Acara
              </span>
              <span className="font-bold text-slate-800">{event?.venueName}</span>
              <span className="text-slate-500 block">{event?.venueAddress}</span>
            </div>
          </div>

          {/* Audit Check-In Record if ticket is used */}
          {(effectiveStatus === 'used' || checkedInAt) && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Catatan Gerbang Masuk:
              </span>
              <p className="text-[11px] text-amber-800">
                Tercatat check-in pada: {checkedInAt ? new Date(checkedInAt).toLocaleString('id-ID') : 'Sesi gerbang terkini'}
              </p>
            </div>
          )}

          {/* Expired / Completed Record notice */}
          {isEventCompleted && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-rose-600" />
                Acara Telah Berakhir:
              </span>
              <p className="text-[11px] text-rose-800">
                Pintu gerbang untuk acara ini telah ditutup permanen.
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>SHA-256 Verified Opaque Token</span>
            </span>
            <span>Non-transferable</span>
          </div>
        </div>
      </div>
    </div>
  );
};
