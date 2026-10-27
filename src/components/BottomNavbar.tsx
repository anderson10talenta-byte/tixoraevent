import React from 'react';
import { Home, Ticket, Calendar, QrCode, LayoutDashboard, Shield, Sparkles } from 'lucide-react';
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
      id: 'home',
      label: 'Beranda',
      icon: Home,
      route: 'home',
      activeBg: 'bg-yellow-300 text-slate-900 border-slate-900',
    },
    {
      id: 'events',
      label: 'Jelajah',
      icon: Calendar,
      route: 'events',
      activeBg: 'bg-indigo-100 text-indigo-900 border-indigo-900',
    },
    {
      id: 'my-tickets',
      label: 'Tiket Saya',
      icon: Ticket,
      route: 'my-tickets',
      activeBg: 'bg-emerald-100 text-emerald-900 border-emerald-900',
    },
    {
      id: 'check-in',
      label: 'Gerbang',
      icon: QrCode,
      route: 'check-in',
      activeBg: 'bg-purple-100 text-purple-900 border-purple-900',
    },
    isSuperAdmin
      ? {
          id: 'admin',
          label: 'Admin',
          icon: Shield,
          route: 'admin',
          activeBg: 'bg-rose-100 text-rose-900 border-rose-900',
        }
      : {
          id: 'dashboard',
          label: 'Organizer',
          icon: LayoutDashboard,
          route: 'dashboard',
          activeBg: 'bg-amber-100 text-amber-900 border-amber-900',
        },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t-2.5 border-slate-900 shadow-[0_-4px_20px_rgba(15,23,42,0.1)] px-1.5 py-1.5"
      style={{ paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))' }}
      aria-label="Navigasi Bawah Mobile"
    >
      <div className="flex items-center justify-around max-w-md mx-auto gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.route === 'home'
              ? activeRoute === 'home'
              : activeRoute === item.route || activeRoute.startsWith(item.route);

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.route)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-150 cursor-pointer min-h-[48px] select-none ${
                isActive
                  ? `${item.activeBg} border-2 font-black shadow-[2px_2px_0px_0px_#0f172a] -translate-y-0.5`
                  : 'text-slate-600 hover:text-slate-900 active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-4.5 h-4.5 transition-transform duration-150 ${
                    isActive ? 'scale-110 text-slate-900 stroke-[2.5]' : 'text-slate-600'
                  }`}
                />
                {item.id === 'check-in' && hasStaffAccess && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-black text-slate-900' : 'font-bold'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
