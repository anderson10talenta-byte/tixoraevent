import React from 'react';
import { Calendar, MapPin, Building2, ArrowRight, Sparkles } from 'lucide-react';
import { formatCurrencyIDR } from '../lib/capacity';
import type { Event, TicketType } from '../lib/types';

interface EventWithDetails extends Event {
  organizationName?: string;
  lowestPriceMinor?: number;
  ticketTypes?: TicketType[];
}

interface EventCardProps {
  event: EventWithDetails;
  onSelect: (event: EventWithDetails) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onSelect }) => {
  const startDateStr = event.startsAt || (event as any).startDate || new Date().toISOString();
  const startDate = new Date(startDateStr);
  const formattedDate = startDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime =
    startDate.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';

  const categoryLabels: Record<string, string> = {
    music: 'Musik & Festival',
    technology: 'Teknologi & AI',
    business: 'Bisnis & Karir',
    food: 'Kuliner & F&B',
    art: 'Seni & Budaya',
    community: 'Komunitas',
    'Seni & Animasi': 'Seni & Animasi',
    'Musik & Konser': 'Musik & Konser',
    'Teknologi & Sains': 'Teknologi & Sains',
  };

  const imageSrc =
    (event as any).coverImageUrl ||
    (event as any).bannerUrl ||
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80';

  const lowestPrice =
    event.lowestPriceMinor ??
    (event.ticketTypes && event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((t) => t.priceMinor))
      : 0);

  return (
    <div
      onClick={() => onSelect(event)}
      className="cartoon-card bg-white overflow-hidden flex flex-col cursor-pointer group"
    >
      {/* Cover Image with Cartoon Stickers */}
      <div className="relative aspect-16/10 bg-indigo-50 overflow-hidden border-b-2.5 border-slate-900">
        <img
          src={imageSrc}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* Category Cartoon Badge */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="cartoon-badge px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-yellow-300 text-slate-900">
            {categoryLabels[event.category] || event.category}
          </span>
        </div>

        {/* Fun Cartoon Sticker */}
        <div className="absolute top-3 right-3">
          <span className="cartoon-badge px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-400 text-white flex items-center gap-1 shadow-xs">
            <Sparkles className="w-3 h-3" />
            <span>Resmi</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Organizer */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-extrabold mb-1.5">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span className="truncate">{event.organizationName || 'Tixora Official'}</span>
          </div>

          {/* Title */}
          <h3 className="font-black text-lg text-slate-900 group-hover:text-indigo-600 transition line-clamp-2 leading-snug">
            {event.title}
          </h3>

          {/* Date & Location */}
          <div className="mt-3.5 space-y-1.5 text-xs text-slate-700 font-bold">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{formattedDate} • {formattedTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="truncate">{event.venueName}</span>
            </div>
          </div>
        </div>

        {/* Footer: Cartoon Price and CTA Button */}
        <div className="mt-5 pt-4 border-t-2 border-dashed border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">
              Mulai Dari
            </span>
              {lowestPrice === 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Sparkles className="w-4 h-4" /> Gratis
                </span>
              ) : (
                formatCurrencyIDR(lowestPrice)
              )}
          </div>
          <span className="cartoon-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-yellow-300 text-slate-900">
            <span>Pesan Tiket</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </div>
  );
};
