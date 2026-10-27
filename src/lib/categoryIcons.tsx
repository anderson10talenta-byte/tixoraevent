import React from 'react';
import {
  Music,
  Cpu,
  Briefcase,
  Utensils,
  Palette,
  Users,
  Sparkles,
  Ticket,
  Film,
  Gamepad2,
  Trophy,
  BookOpen,
  Heart,
  Compass,
  Tag,
  LucideIcon,
} from 'lucide-react';
import type { EventCategory } from './types';

export const AVAILABLE_CATEGORY_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  Music: { label: 'Musik & Konser', icon: Music },
  Cpu: { label: 'Teknologi & AI', icon: Cpu },
  Briefcase: { label: 'Bisnis & Karir', icon: Briefcase },
  Utensils: { label: 'Kuliner & F&B', icon: Utensils },
  Palette: { label: 'Seni & Desain', icon: Palette },
  Users: { label: 'Komunitas & Sosial', icon: Users },
  Sparkles: { label: 'Hiburan Pop', icon: Sparkles },
  Ticket: { label: 'Festival & Acara', icon: Ticket },
  Film: { label: 'Film & Teater', icon: Film },
  Gamepad2: { label: 'Gaming & Esports', icon: Gamepad2 },
  Trophy: { label: 'Olahraga', icon: Trophy },
  BookOpen: { label: 'Workshop & Edukasi', icon: BookOpen },
  Heart: { label: 'Amal & Kesehatan', icon: Heart },
  Compass: { label: 'Wisata & Tour', icon: Compass },
  Tag: { label: 'Umum / Lainnya', icon: Tag },
};

export { DEFAULT_CATEGORIES } from './categoriesData';

export function getCategoryIcon(iconNameOrCategory?: string): LucideIcon {
  if (!iconNameOrCategory) return Tag;

  // Direct match from icon map
  if (AVAILABLE_CATEGORY_ICONS[iconNameOrCategory]) {
    return AVAILABLE_CATEGORY_ICONS[iconNameOrCategory].icon;
  }

  // Fallback by category id / name match
  const lower = iconNameOrCategory.toLowerCase();
  if (lower.includes('music') || lower.includes('musik') || lower.includes('konser')) return Music;
  if (lower.includes('tech') || lower.includes('teknologi') || lower.includes('ai') || lower.includes('sains')) return Cpu;
  if (lower.includes('business') || lower.includes('bisnis') || lower.includes('karir')) return Briefcase;
  if (lower.includes('food') || lower.includes('kuliner') || lower.includes('kopi')) return Utensils;
  if (lower.includes('art') || lower.includes('seni') || lower.includes('budaya') || lower.includes('desain')) return Palette;
  if (lower.includes('community') || lower.includes('komunitas')) return Users;
  if (lower.includes('film') || lower.includes('movie') || lower.includes('bioskop')) return Film;
  if (lower.includes('game') || lower.includes('gaming')) return Gamepad2;
  if (lower.includes('sport') || lower.includes('olahraga')) return Trophy;
  if (lower.includes('edu') || lower.includes('workshop') || lower.includes('buku')) return BookOpen;
  if (lower.includes('tour') || lower.includes('wisata')) return Compass;

  return Tag;
}
