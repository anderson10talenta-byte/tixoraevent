import React, { useState, useEffect } from 'react';
import { Search, Calendar, MapPin, Building2, Filter, ArrowRight, Tag } from 'lucide-react';
import { EventCard } from '../components/EventCard';
import type { Event, TicketType, EventCategory } from '../lib/types';
import { DEFAULT_CATEGORIES, getCategoryIcon } from '../lib/categoryIcons';

interface EventWithDetails extends Event {
  organizationName?: string;
  lowestPriceMinor?: number;
  ticketTypes?: TicketType[];
}

interface EventsPageProps {
  events: EventWithDetails[];
  onSelectEvent: (event: EventWithDetails) => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({ events, onSelectEvent }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'price'>('date');
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

  // Filter out completed / finished events immediately from public discovery
  const activeEvents = events.filter((e) => {
    if (e.isCompleted || (e as any).status === 'completed') return false;
    if (e.endsAt && new Date(e.endsAt).getTime() < Date.now()) return false;
    return true;
  });

  let filtered = activeEvents.filter((e) => {
    const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
    const matchesSearch =
      !search.trim() ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.venueName.toLowerCase().includes(search.toLowerCase()) ||
      (e.organizationName && e.organizationName.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (sortBy === 'date') {
    filtered.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  } else if (sortBy === 'price') {
    filtered.sort((a, b) => (a.lowestPriceMinor || 0) - (b.lowestPriceMinor || 0));
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Page Title & Search Filter */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Katalog Event</h1>
          <p className="text-sm text-slate-500 mt-1">
            Temukan tiket acara favorit Anda dengan kepastian validasi gerbang tercepat.
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari berdasarkan judul event, venue, atau organizer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
            <span className="text-slate-500 font-semibold">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
            >
              <option value="date">Tanggal Terdekat</option>
              <option value="price">Harga Termurah</option>
            </select>
          </div>
        </div>

        {/* Category Pills (Clean Lucide Icons, Zero Emojis) */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {events.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-slate-900 mx-auto flex items-center justify-center shadow-[2px_2px_0px_0px_#0f172a]">
            <Calendar className="w-7 h-7 text-indigo-600" />
          </div>
          <p className="text-slate-900 font-black text-base">Belum Ada Event Aktif</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            Belum ada event yang dipublikasikan saat ini. Penyelenggara yang telah diverifikasi dapat mulai membuat event baru dari Dashboard.
          </p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((evt) => (
            <EventCard key={evt.id} event={evt} onSelect={onSelectEvent} />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <p className="text-slate-600 font-bold">Tidak Ada Event Ditemukan</p>
          <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau pilih kategori lain.</p>
        </div>
      )}
    </div>
  );
};
