import React, { useState } from 'react';
import { Calendar, MapPin, Building2, Clock, ShieldCheck, Ticket, Users, ArrowLeft } from 'lucide-react';
import { formatCurrencyIDR } from '../lib/capacity';
import type { Event, TicketType } from '../lib/types';

interface EventWithDetails extends Event {
  organizationName?: string;
  lowestPriceMinor?: number;
  ticketTypes?: TicketType[];
}

interface EventDetailPageProps {
  event: EventWithDetails;
  onBack: () => void;
  onProceedToCheckout: (eventId: string, ticketTypeId: string, quantity: number) => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({
  event,
  onBack,
  onProceedToCheckout,
}) => {
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>(
    event.ticketTypes && event.ticketTypes.length > 0 ? event.ticketTypes[0].id : ''
  );
  const [quantity, setQuantity] = useState<number>(1);

  const selectedTicket = event.ticketTypes?.find((tt) => tt.id === selectedTicketTypeId);

  const startDateRaw = event.startsAt || (event as any).startDate || new Date().toISOString();
  const parsedDate = new Date(startDateRaw);
  const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const formattedDate = validDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = validDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

  const subtotal = selectedTicket ? selectedTicket.priceMinor * quantity : 0;
  const isFree = subtotal === 0;

  const handleBook = () => {
    if (!selectedTicketTypeId) return;
    onProceedToCheckout(event.id, selectedTicketTypeId, quantity);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Jelajah Event</span>
      </button>

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden aspect-21/9 bg-slate-900 shadow-xl border border-slate-200">
        <img
          src={event.coverImageUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80'}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
              {event.category.toUpperCase()}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-300 font-medium bg-slate-900/80 px-2.5 py-1 rounded-full backdrop-blur-md">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              {event.organizationName || 'Tixora Organizer'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {event.title}
          </h1>
        </div>
      </div>

      {/* Main Content & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Event Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">Tanggal & Waktu</p>
                <p className="text-sm font-bold text-slate-800">{formattedDate}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {formattedTime} {event.timezone ? `(${event.timezone})` : '(WIB)'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">Lokasi / Venue</p>
                <p className="text-sm font-bold text-slate-800">{event.venueName}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{event.venueAddress}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Tentang Event Ini</h3>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>

          {/* Security & Entry Notice */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 text-xs text-slate-600">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm mb-1">Tiket Digital Kriptografis</p>
              <p>
                Setiap tiket yang diterbitkan memiliki QR Code unik yang diverifikasi secara real-time di gerbang masuk. Hindari membeli tiket dari pihak ketiga untuk mencegah tiket ganda.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Ticket Selection Box */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 p-6 bg-white rounded-3xl border border-slate-200 shadow-lg space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-lg">Pilih Kategori Tiket</h3>
              <Ticket className="w-5 h-5 text-indigo-600" />
            </div>

            {/* Ticket Options */}
            <div className="space-y-3">
              {event.ticketTypes && event.ticketTypes.length > 0 ? (
                event.ticketTypes.map((tt) => {
                  const isSelected = selectedTicketTypeId === tt.id;
                  const remaining = Math.max(0, tt.capacity - (tt.soldCount + tt.reservedCount));
                  const isSoldOut = remaining <= 0;

                  return (
                    <div
                      key={tt.id}
                      onClick={() => !isSoldOut && setSelectedTicketTypeId(tt.id)}
                      className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : isSoldOut
                          ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{tt.name}</p>
                          {tt.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{tt.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-900 text-sm">
                            {tt.priceMinor === 0 ? 'Gratis' : formatCurrencyIDR(tt.priceMinor)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>Tersedia: {remaining} tiket</span>
                        </span>
                        {isSoldOut ? (
                          <span className="text-rose-600 font-bold">Habis (Sold Out)</span>
                        ) : (
                          <span className="text-indigo-600 font-medium">Maks. {tt.maxPerOrder} / order</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500">Tidak ada kategori tiket yang tersedia saat ini.</p>
              )}
            </div>

            {/* Quantity Selector */}
            {selectedTicket && (
              <div className="pt-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Jumlah Tiket</label>
                <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 rounded-lg bg-white shadow-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-bold text-slate-900 text-sm">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(selectedTicket.maxPerOrder, quantity + 1))}
                    disabled={quantity >= selectedTicket.maxPerOrder}
                    className="w-8 h-8 rounded-lg bg-white shadow-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Total breakdown */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal ({quantity} tiket)</span>
                <span>{isFree ? 'Gratis' : formatCurrencyIDR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Biaya Layanan</span>
                <span>{isFree ? 'Rp 0' : 'Rp 5.000'}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm text-slate-900">
                <span>Total Pembayaran</span>
                <span>{isFree ? 'Gratis' : formatCurrencyIDR(subtotal + (isFree ? 0 : 5000))}</span>
              </div>
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={handleBook}
              disabled={!selectedTicketTypeId}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isFree ? 'Daftar Tiket Gratis' : 'Lanjut ke Pembayaran'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
