import React, { useState, useEffect } from 'react';
import { Search, Sparkles, ShieldCheck, QrCode, ArrowRight, Zap, Users, PartyPopper, Calendar, Tag } from 'lucide-react';
import { EventCard } from '../components/EventCard';
import type { Event, TicketType, EventCategory } from '../lib/types';
import { DEFAULT_CATEGORIES, getCategoryIcon } from '../lib/categoryIcons';

interface EventWithDetails extends Event {
  organizationName?: string;
  lowestPriceMinor?: number;
  ticketTypes?: TicketType[];
}

interface HomePageProps {
  events: EventWithDetails[];
  onSelectEvent: (event: EventWithDetails) => void;
  onExploreAll: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ events, onSelectEvent, onExploreAll }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<EventCategory[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (data && data.length > 0) {
          setCategories(data);
        }
      })
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Filter out completed/ended events from homepage discovery
  const activeEvents = events.filter((e) => {
    if (e.isCompleted || (e as any).status === 'completed') return false;
    if (e.endsAt && new Date(e.endsAt).getTime() < Date.now()) return false;
    return true;
  });

  const filteredEvents = activeEvents.filter((e) => {
    const cat = (e.category || '').toLowerCase();
    const matchesCategory =
      selectedCategory === 'all' ||
      cat === selectedCategory.toLowerCase() ||
      cat.includes(selectedCategory.toLowerCase());

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.venueName && e.venueName.toLowerCase().includes(q)) ||
      (e.organizationName && e.organizationName.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-10 pb-16">
      {/* Cartoon Animation Hero Banner */}
      <section className="relative overflow-hidden bg-amber-100 rounded-3xl border-3 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] p-6 sm:p-10 lg:p-14">
        {/* Playful background decorative shapes */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-yellow-300 rounded-full border-3 border-slate-900 opacity-60 pointer-events-none transform rotate-12"></div>
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-pink-300 rounded-full border-3 border-slate-900 opacity-60 pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl">
          {/* Animated Cartoon Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow-300 text-slate-900 border-2 border-slate-900 text-xs font-black mb-5 shadow-[2px_2px_0px_0px_#0f172a] animate-bounce-pop">
            <PartyPopper className="w-4 h-4 text-rose-500" />
            <span>Platform Tiket Event & Gate Scanner Paling Seru!</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Nonton Event Impian,{' '}
            <span className="inline-block bg-yellow-300 px-2 py-0.5 rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] -rotate-1">
              Bebas Tiket Palsu!
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-800 font-bold leading-relaxed">
            Pesan tiket resmi secepat kilat dengan kode QR digital SHA-256. Masuk ke gerbang venue tinggal scan kamera HP petugas, no ribet, 100% aman!
          </p>

          {/* Cartoon Search Bar */}
          <div className="mt-7 flex flex-col sm:flex-row gap-2.5 bg-white p-2.5 rounded-2xl border-2.5 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari konser musik, pameran seni, expo teknologi..."
                className="w-full pl-11 pr-4 py-2.5 text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>
            <button
              onClick={onExploreAll}
              className="cartoon-btn px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs sm:text-sm font-black rounded-xl transition"
            >
              Cari Event
            </button>
          </div>
        </div>
      </section>

      {/* Cartoon Feature Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="cartoon-card p-6 bg-yellow-50 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-300 border-2 border-slate-900 text-slate-900 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_#0f172a]">
            <ShieldCheck className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-sm">QR Code Kriptografi Asli</h4>
            <p className="mt-1 text-xs text-slate-700 font-medium leading-relaxed">
              Diverifikasi otomatis dengan hash kriptografi. Anti screenshot bajakan dan anti calo nakal.
            </p>
          </div>
        </div>

        <div className="cartoon-card p-6 bg-emerald-50 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-300 border-2 border-slate-900 text-slate-900 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_#0f172a]">
            <Zap className="w-6 h-6 text-emerald-950" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-sm">Check-In HP Sat-Set</h4>
            <p className="mt-1 text-xs text-slate-700 font-medium leading-relaxed">
              Scanner kamera responsif langsung dari browser. Tiket otomatis ditandai 'Used' dalam milidetik.
            </p>
          </div>
        </div>

        <div className="cartoon-card p-6 bg-purple-50 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-300 border-2 border-slate-900 text-slate-900 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_#0f172a]">
            <Users className="w-6 h-6 text-purple-950" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-sm">Akses Staff Lewat Email</h4>
            <p className="mt-1 text-xs text-slate-700 font-medium leading-relaxed">
              Organizer cukup ketik email staff untuk kasih izin scan pintu gerbang tanpa bongkar data penjualan!
            </p>
          </div>
        </div>
      </section>

      {/* Events Grid Header & Category Filter */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                Event Pilihan Terpopuler
              </span>
              <span className="cartoon-badge px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-400 text-white">
                Live
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-bold mt-1">
              Pilih event favoritmu, booking tiket sekarang sebelum kuota habis!
            </p>
          </div>

          {/* Category Badges with Lucide Icons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-yellow-300 text-slate-900 border-2 border-slate-900 shadow-[2.5px_2.5px_0px_0px_#0f172a] -translate-y-0.5'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-2 border-slate-300'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Semua Kategori</span>
            </button>
            {categories.map((cat) => {
              const IconComp = getCategoryIcon(cat.iconName);
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-yellow-300 text-slate-900 border-2 border-slate-900 shadow-[2.5px_2.5px_0px_0px_#0f172a] -translate-y-0.5'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-2 border-slate-300'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid of Events */}
        {events.length === 0 ? (
          <div className="cartoon-card p-12 text-center bg-white space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border-2.5 border-slate-900 mx-auto flex items-center justify-center shadow-[3px_3px_0px_0px_#0f172a]">
              <Calendar className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Belum Ada Event Terjadwal</h3>
              <p className="text-xs text-slate-600 font-semibold max-w-md mx-auto">
                Platform Tixora telah bersih dan siap digunakan! Penyelenggara yang telah disetujui melalui verifikasi KYC dapat mempublikasikan event pertama mereka sekarang.
              </p>
            </div>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((evt) => (
              <EventCard key={evt.id} event={evt} onSelect={onSelectEvent} />
            ))}
          </div>
        ) : (
          <div className="cartoon-card p-12 text-center bg-white space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-slate-900 text-indigo-700 flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_#0f172a]">
              <Search className="w-7 h-7" />
            </div>
            <p className="text-base font-black text-slate-900">Event tidak ditemukan</p>
            <p className="text-xs text-slate-600 font-bold max-w-sm mx-auto">
              Tidak ada event yang cocok dengan filter atau pencarian Anda saat ini.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="cartoon-btn px-4 py-2 rounded-xl bg-yellow-300 hover:bg-yellow-400 text-slate-900 text-xs font-black transition cursor-pointer"
            >
              Reset Filter & Pencarian
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
