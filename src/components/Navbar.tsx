import React, { useState } from 'react';
import {
  Ticket,
  Calendar,
  QrCode,
  LayoutDashboard,
  Shield,
  PlusCircle,
  LogIn,
  LogOut,
  Sparkles,
  User as UserIcon,
  ChevronDown,
  Smartphone,
  Download,
} from 'lucide-react';
import type { Profile } from '../lib/types';
import { SUPER_ADMIN_EMAIL } from '../lib/firebase';
import { DownloadAppModal } from './DownloadAppModal';
import { TixoraLogo } from './TixoraLogo';

interface NavbarProps {
  currentProfile: Profile | null;
  activeRoute: string;
  onNavigate: (route: string) => void;
  onLogin: () => void;
  onLogout: () => void;
  onSimulateSuperAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfile,
  activeRoute,
  onNavigate,
  onLogin,
  onLogout,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const isSuperAdmin = !!currentProfile?.isSuperAdmin;

  const desktopNavItems = [
    { id: 'events', label: 'Jelajah Event', icon: Calendar, route: 'events' },
    { id: 'my-tickets', label: 'Tiket Saya', icon: Ticket, route: 'my-tickets' },
    { id: 'dashboard', label: 'Organizer', icon: LayoutDashboard, route: 'dashboard' },
    { id: 'check-in', label: 'Check-In Gerbang', icon: QrCode, route: 'check-in' },
  ];

  if (isSuperAdmin) {
    desktopNavItems.push({ id: 'admin', label: 'Super Admin', icon: Shield, route: 'admin' });
  }

  const handleNav = (route: string) => {
    onNavigate(route);
    setProfileDropdownOpen(false);
  };

  const calculateDaysActive = (dateStr?: string) => {
    if (!dateStr) return 1;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-amber-50/90 backdrop-blur-md border-b-2.5 border-slate-900 shadow-[0_4px_0_0_#0f172a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Brand Logo */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => handleNav('home')}
                className="flex items-center text-left group cursor-pointer focus:outline-none"
              >
                <TixoraLogo
                  size={42}
                  showText={true}
                  showProBadge={true}
                  subtitle="Platform Tiket & Gate Pass Resmi"
                />
              </button>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-1.5 ml-4">
                {desktopNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    activeRoute === item.route ||
                    (item.route !== 'home' && activeRoute.startsWith(item.route));

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.route)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-yellow-300 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]'
                          : 'text-slate-700 hover:bg-amber-100/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-700' : 'text-slate-600'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right Action & User Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* PWA Download / Pasang App Button */}
              <button
                onClick={() => setDownloadModalOpen(true)}
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold bg-white hover:bg-slate-50 text-indigo-700 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Pasang Aplikasi</span>
              </button>

              {/* Buat Event Button (Desktop) */}
              <button
                onClick={() => {
                  if (!currentProfile) {
                    onLogin();
                  } else if (currentProfile.isSuperAdmin || currentProfile.organizerStatus === 'approved') {
                    handleNav('dashboard/new-event');
                  } else {
                    handleNav('dashboard');
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black bg-indigo-500 hover:bg-indigo-600 text-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#0f172a] transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Buat Event</span>
              </button>

              {/* User Profile or Sign In */}
              {currentProfile ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-2 p-1.5 pr-3 rounded-2xl bg-white border-2 border-slate-900 shadow-[2.5px_2.5px_0px_0px_#0f172a] hover:bg-slate-50 transition cursor-pointer"
                  >
                    <img
                      src={
                        currentProfile.avatarUrl ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                          currentProfile.fullName
                        )}`
                      }
                      alt={currentProfile.fullName}
                      className="w-8 h-8 rounded-xl object-cover border border-slate-900 bg-amber-100"
                    />
                    <div className="text-left hidden sm:block">
                      <div className="font-black text-xs text-slate-900 leading-tight max-w-[110px] truncate">
                        {currentProfile.fullName}
                      </div>
                      <div className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                        {currentProfile.isSuperAdmin ? '⭐ Super Admin' : '🎟️ Pengguna'}
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-600" />
                  </button>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border-2.5 border-slate-900 rounded-2xl shadow-[4px_4px_0px_0px_#0f172a] p-3 space-y-2 z-50 animate-in fade-in zoom-in-95">
                      <div className="p-3 bg-amber-50 rounded-xl border border-slate-900/10 mb-2">
                        <div className="font-black text-sm text-slate-900">{currentProfile.fullName}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{currentProfile.email}</div>
                        <div className="mt-1.5 flex items-center justify-between gap-1.5 flex-wrap">
                          {currentProfile.isSuperAdmin ? (
                            <span className="px-2 py-0.5 text-[10px] font-black bg-rose-200 text-rose-900 border border-rose-900 rounded-md">
                              ⭐ Super Admin
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-200 text-emerald-900 border border-emerald-900 rounded-md">
                              Pengguna Terverifikasi
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            🗓️ Hari ke-{calculateDaysActive(currentProfile.createdAt)} Aktif
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleNav('my-tickets')}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                      >
                        <Ticket className="w-4 h-4 text-indigo-600" />
                        <span>Tiket Saya</span>
                      </button>

                      <button
                        onClick={() => handleNav('dashboard')}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                      >
                        <LayoutDashboard className="w-4 h-4 text-amber-600" />
                        <span>Dashboard Penyelenggara & Staff</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setDownloadModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Smartphone className="w-4 h-4 text-indigo-600" />
                        <span>Pasang Aplikasi di Ponsel</span>
                      </button>

                      {isSuperAdmin && (
                        <button
                          onClick={() => handleNav('admin')}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border border-rose-200"
                        >
                          <Shield className="w-4 h-4 text-rose-600" />
                          <span>Panel Super Admin & KYC</span>
                        </button>
                      )}

                      <div className="pt-2 border-t border-slate-200">
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onLogout();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Keluar (Sign Out)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDownloadModalOpen(true)}
                    className="sm:hidden p-2 rounded-xl bg-white border-2 border-slate-900 text-indigo-700"
                    title="Pasang Aplikasi"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onLogin}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-black bg-yellow-300 hover:bg-yellow-400 text-slate-900 border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#0f172a] transition cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Masuk / Daftar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <DownloadAppModal isOpen={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} />
    </>
  );
};
