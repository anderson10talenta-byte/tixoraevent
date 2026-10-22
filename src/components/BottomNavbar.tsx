import React from 'react';
import { Ticket, Calendar, QrCode, LayoutDashboard, Shield, Sparkles } from 'lucide-react';
import type { Profile } from '../lib/types';

interface BottomNavbarProps {
  currentProfile: Profile | null;
  activeRoute: string;
  onNavigate: (route: string) => void;
  hasStaffAccess?: boolean;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({
  currentProfile,
  activeRoute,
  onNavigate,
  hasStaffAccess = false,
}) => {
  const isSuperAdmin = !!currentProfile?.isSuperAdmin;

  const navItems = [
    {
      id: 'events',
      label: 'Jelajah',
      icon: Calendar,
      route: 'events',
      color: 'text-indigo-600',
      activeBg: 'bg-indigo-100 border-indigo-900 text-indigo-900',
    },
    {
      id: 'my-tickets',
      label: 'Tiket Saya',
      icon: Ticket,
      route: 'my-tickets',
      color: 'text-emerald-600',
      activeBg: 'bg-emerald-100 border-emerald-900 text-emerald-900',
    },
    {
      id: 'dashboard',
      label: 'Organizer',
      icon: LayoutDashboard,
      route: 'dashboard',
      color: 'text-amber-600',
      activeBg: 'bg-amber-100 border-amber-900 text-amber-900',
    },
    {
      id: 'check-in',
      label: 'Gerbang',
      icon: QrCode,
      route: 'check-in',
      color: 'text-purple-600',
      activeBg: 'bg-purple-100 border-purple-900 text-purple-900',
    },
  ];

  if (isSuperAdmin) {
    navItems.push({
      id: 'admin',
      label: 'Super Admin',
      icon: Shield,
      route: 'admin',
      color: 'text-rose-600',
      activeBg: 'bg-rose-100 border-rose-900 text-rose-900',
    });
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t-2 border-slate-900 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] px-2 py-1.5"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      aria-label="Navigasi Bawah Mobile"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeRoute === item.route ||
            (item.route !== 'home' && activeRoute.startsWith(item.route));

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.route)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? `${item.activeBg} border-2 font-bold scale-105 shadow-[2px_2px_0px_0px_#0f172a]`
                  : 'text-slate-600 hover:text-slate-900 active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110' : 'text-slate-500'
                  }`}
                />
                {item.id === 'check-in' && hasStaffAccess && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </div>
              <span className={`text-[11px] mt-0.5 tracking-tight ${isActive ? 'font-extrabold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
