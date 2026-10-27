import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Info, X, Clock, Award, ChevronDown } from 'lucide-react';
import type { CreditScoreLog } from '../lib/types';

interface CreditScoreBadgeProps {
  score?: number;
  userId?: string;
  userEmail?: string;
  currentProfile?: { id?: string; email?: string; creditScore?: number } | null;
  onScoreUpdate?: () => void;
  className?: string;
}

export const CreditScoreBadge: React.FC<CreditScoreBadgeProps> = ({
  score,
  userId,
  userEmail,
  currentProfile,
  onScoreUpdate,
  className = '',
}) => {
  const effectiveUserId = userId || currentProfile?.id || '';
  const effectiveUserEmail = userEmail || currentProfile?.email || '';
  const initialScore = score ?? currentProfile?.creditScore ?? 10;

  const [isOpen, setIsOpen] = useState(false);
  const [currentScore, setCurrentScore] = useState(initialScore);
  const [logs, setLogs] = useState<CreditScoreLog[]>([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchScoreAndLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users/credit-score', {
        headers: {
          'x-user-id': effectiveUserId,
          'x-user-email': effectiveUserEmail,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentScore(data.creditScore ?? initialScore);
        setLogs(data.logs || []);
        if (onScoreUpdate) onScoreUpdate();
      }
    } catch (e) {
      console.warn('Gagal memuat skor kredit:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (score !== undefined) {
      setCurrentScore(score);
    } else if (currentProfile?.creditScore !== undefined) {
      setCurrentScore(currentProfile.creditScore);
    }
  }, [score, currentProfile?.creditScore]);

  useEffect(() => {
    fetchScoreAndLogs();
    const handleScoreUpdate = () => {
      fetchScoreAndLogs();
    };
    window.addEventListener('tixora-score-updated', handleScoreUpdate);
    return () => {
      window.removeEventListener('tixora-score-updated', handleScoreUpdate);
    };
  }, [effectiveUserId, effectiveUserEmail]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchScoreAndLogs();
    }
    setIsOpen(!isOpen);
  };

  // Color coding based on score out of 10
  const getBadgeStyle = () => {
    if (currentScore >= 8) {
      return 'bg-emerald-100 text-emerald-900 border-emerald-900 hover:bg-emerald-200';
    }
    if (currentScore >= 5) {
      return 'bg-amber-100 text-amber-900 border-amber-900 hover:bg-amber-200';
    }
    return 'bg-rose-100 text-rose-900 border-rose-900 hover:bg-rose-200';
  };

  return (
    <div className="relative shrink-0" ref={popoverRef}>
      {/* Trigger Button in Navbar */}
      <button
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border-2 font-black text-xs transition cursor-pointer select-none active:scale-95 shadow-[1.5px_1.5px_0px_0px_#0f172a] sm:shadow-[2px_2px_0px_0px_#0f172a] shrink-0 whitespace-nowrap ${getBadgeStyle()} ${className}`}
        title="Klik untuk membuka rincian skor kredit & reputasi akun"
        aria-expanded={isOpen}
      >
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-800" />
        <span className="font-mono text-[11px] sm:text-xs">Skor: {currentScore}/10</span>
        <ChevronDown className={`w-3 h-3 opacity-70 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Pop-up Dropdown (Anchored right below the badge, zero clipping) */}
      {isOpen && (
        <>
          {/* Click-catcher overlay for outside clicks */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />

          {/* Floating Pop-Up Card */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] bg-white border-2.5 border-slate-900 rounded-2xl sm:rounded-3xl shadow-[5px_5px_0px_0px_#0f172a] p-4 sm:p-5 space-y-4 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[82vh] overflow-y-auto">
            {/* Pop-up Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-yellow-300 rounded-xl border-2 border-slate-900 text-slate-900 shrink-0 shadow-[1px_1px_0px_#0f172a]">
                  <Award className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm text-slate-900 truncate leading-tight">
                    Skor Kredit Pengguna
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold truncate">Transparansi Reputasi Akun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
                aria-label="Tutup Pop-up"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Score Highlight Box */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                  Poin Kredit Akun Anda
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-indigo-700">{currentScore}</span>
                  <span className="text-xs font-black text-slate-600">/ 10 Poin</span>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border-2 border-slate-900 shrink-0 whitespace-nowrap ${
                  currentScore >= 8
                    ? 'bg-emerald-300 text-slate-900'
                    : currentScore >= 5
                    ? 'bg-yellow-300 text-slate-900'
                    : 'bg-rose-400 text-white'
                }`}
              >
                {currentScore >= 8 ? 'Reputasi Sangat Baik' : currentScore >= 5 ? 'Reputasi Waspada' : 'Reputasi Kritis'}
              </span>
            </div>

            {/* Aturan & Ketentuan Penalti */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700">
                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Ketentuan Pemotongan Poin</span>
              </div>

              <div className="space-y-1.5 text-xs font-bold">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-900 font-black block text-xs">Beli Tiket & Pembatalan &gt; H-5</span>
                    <span className="text-slate-500 text-[10px] font-medium block">
                      Tidak ada pengurangan skor kredit.
                    </span>
                  </div>
                  <span className="text-emerald-700 font-black shrink-0 px-2 py-0.5 rounded-lg bg-emerald-100 text-[11px]">
                    0 Poin
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-900 font-black block text-xs">Pembatalan Tiket H-5 Acara</span>
                    <span className="text-slate-500 text-[10px] font-medium block">
                      Dibatalkan 3 - 5 hari sebelum acara.
                    </span>
                  </div>
                  <span className="text-amber-700 font-black shrink-0 px-2 py-0.5 rounded-lg bg-amber-100 text-[11px]">
                    -1 Poin
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-900 font-black block text-xs">Pembatalan Tiket H-3 Acara</span>
                    <span className="text-slate-500 text-[10px] font-medium block">
                      Dibatalkan 1 - 3 hari sebelum acara.
                    </span>
                  </div>
                  <span className="text-rose-700 font-black shrink-0 px-2 py-0.5 rounded-lg bg-rose-100 text-[11px]">
                    -2 Poin
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-rose-950 font-black block text-xs">Batal H-1 atau No-Show (Tak Hadir)</span>
                    <span className="text-rose-800 text-[10px] font-medium block">
                      Batal mendadak di hari H atau tak hadir hingga acara selesai.
                    </span>
                  </div>
                  <span className="text-rose-900 font-black shrink-0 px-2 py-0.5 rounded-lg bg-rose-200 text-[11px]">
                    -3 Poin
                  </span>
                </div>
              </div>
            </div>

            {/* Riwayat Log Pemotongan */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700">
                <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Riwayat Perubahan ({logs.length})</span>
              </div>

              {loading ? (
                <div className="p-3 text-center text-xs text-slate-500 font-bold">Memuat...</div>
              ) : logs.length === 0 ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-xs text-emerald-800 font-bold">
                  Belum ada penalti skor kredit. Reputasi akun Anda masih sempurna (10/10)!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-[11px] truncate">{log.reason}</p>
                        <p className="text-[9px] text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <span className="font-black text-rose-600 text-xs shrink-0">
                        {log.change > 0 ? `+${log.change}` : log.change}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="cartoon-btn w-full py-2 bg-yellow-300 hover:bg-yellow-400 text-slate-900 font-black text-xs rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition cursor-pointer text-center"
              >
                Tutup Pop-Up
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
