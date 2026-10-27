import React, { useEffect, useState } from 'react';
import {
  Ticket as TicketIcon,
  Calendar,
  MapPin,
  QrCode,
  ArrowRight,
  RefreshCw,
  Clock,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Ban,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { CreditScoreBadge } from '../components/CreditScoreBadge';
import { formatCurrencyIDR } from '../lib/capacity';
import type { Profile } from '../lib/types';

interface MyTicketsPageProps {
  currentProfile: Profile | null;
  onSelectTicket: (ticketId: string) => void;
  onExploreEvents: () => void;
}

export const MyTicketsPage: React.FC<MyTicketsPageProps> = ({
  currentProfile,
  onSelectTicket,
  onExploreEvents,
}) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // Cancellation State
  const [cancellingTicket, setCancellingTicket] = useState<any | null>(null);
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchTicketsAndOrders = async () => {
    setLoading(true);
    try {
      const headers = {
        'x-user-id': currentProfile?.id || '',
        'x-user-email': currentProfile?.email || '',
        'x-user-name': currentProfile?.fullName || '',
      };

      const [ticketsRes, ordersRes] = await Promise.all([
        fetch('/api/tickets/my', { headers }),
        fetch('/api/orders/my', { headers }),
      ]);

      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(data);
      }
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching tickets and orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsAndOrders();
  }, [currentProfile]);

  const handleCancelTicket = async () => {
    if (!cancellingTicket) return;
    setCancellingLoading(true);
    try {
      const res = await fetch(`/api/tickets/${cancellingTicket.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
        },
      });

      const data = await res.json();
      if (res.ok) {
        setCancelFeedback({
          type: 'success',
          message: data.message || 'Tiket berhasil dibatalkan.',
        });
        setCancellingTicket(null);
        window.dispatchEvent(new CustomEvent('tixora-score-updated'));
        fetchTicketsAndOrders();
      } else {
        setCancelFeedback({
          type: 'error',
          message: data.error || 'Gagal membatalkan tiket.',
        });
      }
    } catch (err) {
      console.error('Cancel ticket error:', err);
      setCancelFeedback({
        type: 'error',
        message: 'Terjadi kesalahan saat membatalkan tiket.',
      });
    } finally {
      setCancellingLoading(false);
    }
  };

  const getCancelPenaltyEstimate = (startsAtStr?: string) => {
    if (!startsAtStr) return { penalty: 0, label: 'Bebas penalti (>H-5)' };
    const diffMs = new Date(startsAtStr).getTime() - Date.now();
    const daysUntil = diffMs / (1000 * 60 * 60 * 24);
    if (daysUntil <= 1) {
      return { penalty: 3, label: 'H-1 acara: pemotongan 3 poin credit score' };
    } else if (daysUntil <= 3) {
      return { penalty: 2, label: 'H-3 acara: pemotongan 2 poin credit score' };
    } else if (daysUntil <= 5) {
      return { penalty: 1, label: 'H-5 acara: pemotongan 1 poin credit score' };
    } else {
      return { penalty: 0, label: 'Lebih dari H-5 acara: tidak ada pemotongan poin (0 poin)' };
    }
  };

  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - new Date(currentProfile?.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  const pendingOrders = orders.filter(
    (o) => o.status === 'awaiting_approval' || o.status === 'rejected'
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Toast Feedback */}
      {cancelFeedback && (
        <div
          className={`fixed top-24 right-4 z-50 px-5 py-3.5 rounded-2xl border-2.5 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] font-black text-xs flex items-center gap-2.5 animate-in slide-in-from-top-3 ${
            cancelFeedback.type === 'success' ? 'bg-yellow-300 text-slate-900' : 'bg-rose-500 text-white'
          }`}
        >
          {cancelFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-700" /> : <AlertTriangle className="w-4 h-4 text-white" />}
          <span>{cancelFeedback.message}</span>
          <button onClick={() => setCancelFeedback(null)} className="ml-2 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Tiket Digital Saya
            </h1>
            <span className="text-[11px] font-black text-slate-900 bg-yellow-300 px-3 py-0.5 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] inline-flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-900" />
              <span>Hari ke-{daysActive} di Tixora</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-bold mt-1">
            Akses kode QR resmi untuk check-in di gerbang venue atau pantau status persetujuan bukti transfer QRIS Anda.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
          <CreditScoreBadge currentProfile={currentProfile} onScoreUpdate={fetchTicketsAndOrders} />
          <button
            onClick={fetchTicketsAndOrders}
            className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-900 text-xs font-black shadow-xs cursor-pointer transition shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="cartoon-card p-12 text-center bg-white space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-500">Memuat tiket & status pesanan...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. SECTION: PENDING / REJECTED ORDERS WAITING FOR ADMIN APPROVAL */}
          {pendingOrders.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-yellow-300 rounded-lg border-2 border-slate-900 shadow-[1px_1px_0px_0px_#0f172a]">
                  <Clock className="w-4 h-4 text-slate-900" />
                </span>
                <h2 className="text-base font-black text-slate-900">
                  Status Verifikasi Pembayaran QRIS ({pendingOrders.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {pendingOrders.map((o) => {
                  const isAwaiting = o.status === 'awaiting_approval';
                  const isRejected = o.status === 'rejected';

                  return (
                    <div
                      key={o.id}
                      className={`cartoon-card p-5 ${
                        isAwaiting ? 'bg-amber-50/80 border-amber-400' : 'bg-rose-50/80 border-rose-400'
                      } space-y-4`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-900/10 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-slate-900">{o.orderNumber}</span>
                            <span className="font-black text-xs text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-slate-300">
                              {o.eventTitle}
                            </span>
                            <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-300">
                              {o.ticketTypeName} ({o.quantity}x)
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 block mt-1">
                            Dipesan pada {new Date(o.createdAt).toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div>
                          {isAwaiting ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-yellow-300 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-800" />
                              <span>Menunggu Persetujuan Admin</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Pembayaran Ditolak</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white/90 rounded-2xl border-2 border-slate-900 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-black text-slate-400 block">Total Nominal</span>
                          <span className="text-base font-black text-indigo-700">
                            {formatCurrencyIDR(o.totalMinor)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 block mt-0.5">
                            Metode: QRIS SOLVERSTUDIO
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-black text-slate-400 block">Pengirim Transfer</span>
                          <span className="font-bold text-slate-900">{o.senderName || o.attendeeName || '-'}</span>
                          <span className="text-slate-600 block text-[11px]">Via: {o.senderBank || 'QRIS'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">
                            Bukti Screenshot
                          </span>
                          {o.paymentProofUrl ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={o.paymentProofUrl}
                                alt="Bukti Transfer"
                                onClick={() => setPreviewProofUrl(o.paymentProofUrl)}
                                className="w-12 h-12 object-cover rounded-xl border-2 border-slate-900 cursor-pointer hover:opacity-80 transition"
                              />
                              <button
                                type="button"
                                onClick={() => setPreviewProofUrl(o.paymentProofUrl)}
                                className="text-xs font-black text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat Bukti</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada foto</span>
                          )}
                        </div>
                      </div>

                      {isAwaiting && (
                        <div className="p-3 bg-white/90 rounded-xl border border-amber-300 text-xs font-bold text-slate-700 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Admin sedang memverifikasi bukti transfer Anda. Begitu disetujui, QR Code tiket digital resmi Anda akan otomatis terbit dan aktif di bawah ini.
                          </span>
                        </div>
                      )}

                      {isRejected && (
                        <div className="p-3 bg-white/90 rounded-xl border border-rose-300 text-xs font-bold text-rose-800 space-y-1">
                          <p className="font-black">Alasan Penolakan: {o.rejectionReason || 'Bukti transfer tidak sesuai.'}</p>
                          <p className="text-slate-600 font-medium">
                            Silakan lakukan pemesanan ulang atau hubungi penyelenggara acara jika membutuhkan bantuan.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. SECTION: ACTIVE CONFIRMED DIGITAL TICKETS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-yellow-300 rounded-lg border-2 border-slate-900 shadow-[1px_1px_0px_0px_#0f172a]">
                  <TicketIcon className="w-4 h-4 text-slate-900" />
                </span>
                <h2 className="text-base font-black text-slate-900">
                  Tiket Resmi Aktif ({tickets.length})
                </h2>
              </div>
            </div>

            {tickets.length === 0 ? (
              <div className="cartoon-card p-12 text-center bg-white space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-yellow-300 border-2.5 border-slate-900 mx-auto flex items-center justify-center shadow-[3px_3px_0px_0px_#0f172a] text-slate-900">
                  <TicketIcon className="w-8 h-8 text-indigo-700" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-900 font-black text-lg">Belum Ada Tiket yang Terbit</p>
                  <p className="text-xs sm:text-sm text-slate-500 font-bold max-w-sm mx-auto">
                    {pendingOrders.length > 0
                      ? 'Bukti transfer QRIS Anda sedang menunggu persetujuan admin. Tiket akan muncul otomatis setelah disetujui.'
                      : 'Anda belum memesan tiket acara apapun. Mulai jelajahi event favorit dan dapatkan tiket Anda sekarang!'}
                  </p>
                </div>
                <button
                  onClick={onExploreEvents}
                  className="cartoon-btn px-6 py-3 bg-yellow-300 hover:bg-yellow-400 text-slate-900 font-black text-xs sm:text-sm rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] transition cursor-pointer"
                >
                  Jelajahi Event Seru
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tickets.map((t) => {
                  const dateStr = t.eventStartsAt
                    ? new Date(t.eventStartsAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'TBA';

                  const isFinished = t.isEventCompleted || (t.eventEndsAt && new Date(t.eventEndsAt).getTime() < Date.now());
                  const isCancelled = t.status === 'cancelled';
                  const isCheckedIn = t.status === 'checked_in';

                  const badgeStatus = isCancelled
                    ? 'cancelled'
                    : isFinished
                    ? isCheckedIn
                      ? 'completed_attended'
                      : t.noShow
                      ? 'completed_noshow'
                      : 'completed'
                    : isCheckedIn
                    ? 'used'
                    : 'valid';

                  return (
                    <div
                      key={t.id}
                      className={`cartoon-card p-6 flex flex-col justify-between transition-all ${
                        isFinished ? 'bg-slate-50 border-slate-300' : 'bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="font-mono text-xs font-black text-slate-800 bg-yellow-300 border border-slate-900 px-2.5 py-1 rounded-lg shadow-[1px_1px_0px_0px_#0f172a]">
                            {t.ticketNumber}
                          </span>
                          <StatusBadge status={badgeStatus} size="sm" />
                        </div>

                        <h3 className="font-black text-slate-900 text-lg line-clamp-1">
                          {t.eventTitle}
                        </h3>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-600 font-bold">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{dateStr}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{t.eventVenue}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t-2 border-slate-100 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-500">Kategori</span>
                          <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            {t.ticketTypeName}
                          </span>
                        </div>

                        {/* Event Finished Notice */}
                        {isFinished && (
                          <div className="mt-3 p-2.5 bg-slate-200/80 rounded-xl text-[11px] font-bold text-slate-700 border border-slate-300 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>Acara telah selesai. Tiket tersimpan sebagai riwayat dan tidak dapat di-scan lagi.</span>
                          </div>
                        )}

                        {/* Cancelled Notice */}
                        {isCancelled && (
                          <div className="mt-3 p-2.5 bg-rose-50 rounded-xl text-[11px] font-bold text-rose-800 border border-rose-200 flex items-center gap-2">
                            <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>
                              Tiket dibatalkan
                              {t.cancellationPenalty ? ` (Penalti credit score: -${t.cancellationPenalty} poin)` : ' (Bebas penalti)'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t-2 border-slate-900 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectTicket(t.id)}
                          className="flex items-center gap-1.5 text-xs font-black text-indigo-700 hover:text-indigo-900 cursor-pointer"
                        >
                          <QrCode className="w-4 h-4 text-indigo-600" />
                          <span>Lihat Tiket Digital</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-900 ml-0.5" />
                        </button>

                        {!isFinished && !isCancelled && !isCheckedIn && (
                          <button
                            type="button"
                            onClick={() => setCancellingTicket(t)}
                            className="cartoon-btn px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-black rounded-xl border border-rose-400 cursor-pointer"
                          >
                            Batalkan Tiket
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal: Batalkan Tiket */}
      {cancellingTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="cartoon-card bg-white p-5 sm:p-7 max-w-md w-full my-auto space-y-4 shadow-[8px_8px_0px_0px_#0f172a] animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 border-2.5 border-slate-900 text-rose-600 flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_#0f172a]">
              <Ban className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900">Batalkan Tiket Ini?</h3>
              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                Anda akan membatalkan tiket untuk acara <span className="font-black text-slate-900">"{cancellingTicket.eventTitle}"</span>.
              </p>
            </div>

            {/* Credit Score Penalty Calculation Breakdown */}
            {(() => {
              const estimate = getCancelPenaltyEstimate(cancellingTicket.eventStartsAt);
              const currentScore = currentProfile?.creditScore ?? 10;
              const nextScore = Math.max(0, currentScore - estimate.penalty);

              return (
                <div className="p-3.5 bg-amber-50 rounded-2xl border-2 border-slate-900 text-xs space-y-2">
                  <span className="text-[10px] font-black uppercase text-amber-900 block">
                    Ketentuan Credit Score Pembatalan:
                  </span>
                  <div className="text-slate-800 font-bold">
                    {estimate.label}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-black">
                    <span className="text-slate-600">Skor Saat Ini: {currentScore}/10</span>
                    <span className={estimate.penalty > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                      Skor Baru: {nextScore}/10 {estimate.penalty > 0 ? `(-${estimate.penalty})` : '(Tetap)'}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={cancellingLoading}
                onClick={handleCancelTicket}
                className="cartoon-btn flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-[2px_2px_0px_0px_#0f172a] cursor-pointer flex items-center justify-center gap-2"
              >
                {cancellingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                <span>Ya, Batalkan Tiket</span>
              </button>
              <button
                type="button"
                disabled={cancellingLoading}
                onClick={() => setCancellingTicket(null)}
                className="cartoon-btn px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Screenshot Full Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full my-auto space-y-4 relative border-3 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]">
            <button
              onClick={() => setPreviewProofUrl(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-black text-slate-900 text-base">Bukti Transfer Pembayaran QRIS</h3>
            <div className="rounded-2xl overflow-hidden border-2 border-slate-300 max-h-[70vh] bg-slate-100 flex items-center justify-center">
              <img src={previewProofUrl} alt="Bukti Transfer Penuh" className="max-h-[68vh] w-auto object-contain" />
            </div>
            <div className="text-right">
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="cartoon-btn px-5 py-2 bg-slate-900 text-white text-xs font-black rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
