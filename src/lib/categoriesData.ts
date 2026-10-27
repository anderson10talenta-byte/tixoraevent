import type { EventCategory } from './types';

export const DEFAULT_CATEGORIES: EventCategory[] = [
  {
    id: 'music',
    name: 'Musik & Konser',
    iconName: 'Music',
    description: 'Konser langsung, festival musik, dan pertunjukan akustik',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'technology',
    name: 'Teknologi & AI',
    iconName: 'Cpu',
    description: 'Konferensi developer, peluncuran teknologi, dan pameran AI',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'business',
    name: 'Bisnis & Karir',
    iconName: 'Briefcase',
    description: 'Seminar wirausaha, expo bursa kerja, dan networking',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'food',
    name: 'Kuliner Nusantara',
    iconName: 'Utensils',
    description: 'Bazaar makanan, festival kopi, dan kuliner',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'art',
    name: 'Seni & Budaya',
    iconName: 'Palette',
    description: 'Pameran galeri seni, teater, dan pertunjukan budaya',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'community',
    name: 'Komunitas',
    iconName: 'Users',
    description: 'Temu komunitas, volunteering, dan perkumpulan hobi',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];
