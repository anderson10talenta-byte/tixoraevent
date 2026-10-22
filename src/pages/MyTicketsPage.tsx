import React, { useEffect, useState } from 'react';
import { Ticket as TicketIcon, Calendar, MapPin, QrCode, ArrowRight, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
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
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets/my', {
        headers: {
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error('Error fetching my tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [currentProfile]);

  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - new Date(currentProfile?.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tiket Digital Saya
            </h1>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              🗓️ Hari ke-{daysActive} Menggunakan Tixora
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Akses kode QR tiket Anda untuk diperiksa oleh petugas di pintu masuk acara.
          </p>
        </div>

        <button
          onClick={fetchTickets}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition self-start cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500 font-medium">Memuat tiket Anda...</p>
        </div>
      ) : tickets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tickets.map((t) => {
            const dateStr = t.eventStartsAt
              ? new Date(t.eventStartsAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'TBA';

            return (
              <div
                key={t.id}
                onClick={() => onSelectTicket(t.id)}
                className="group bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                      {t.ticketNumber}
                    </span>
                    <StatusBadge
                      status={
                        t.status === 'checked_in'
                          ? 'used'
                          : t.eventEndsAt && new Date(t.eventEndsAt).getTime() < Date.now()
                          ? 'expired'
                          : t.status
                      }
                      size="sm"
                    />
                  </div>

                  <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-indigo-600 transition line-clamp-1">
                    {t.eventTitle || 'Event Tixora'}
                  </h3>

                  <p className="text-xs font-semibold text-indigo-600 mt-1">
                    Kategori: {t.ticketTypeName || 'Tiket Masuk'}
                  </p>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{t.eventVenue || 'Venue Utama'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                    <QrCode className="w-4 h-4" />
                    <span>Lihat QR Code Tiket</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <TicketIcon className="w-8 h-8 stroke-1" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Belum Ada Tiket</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Anda belum memiliki tiket acara. Jelajahi event seru kami dan dapatkan tiket gratis atau berbayar sekarang.
            </p>
          </div>
          <button
            onClick={onExploreEvents}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            Jelajahi Event Sekarang
          </button>
        </div>
      )}
    </div>
  );
};
