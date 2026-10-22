import React, { useEffect, useState } from 'react';
import { TixoraLogo } from './TixoraLogo';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface SplashScreenProps {
  /** Optional callback when splash screen completes */
  onComplete?: () => void;
  /** Minimum duration in ms before fading out */
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  durationMs = 1500,
}) => {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Progress animation to simulate mobile app initialization
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.floor(Math.random() * 25 + 15);
      });
    }, 200);

    // Fade out sequence
    const timer = setTimeout(() => {
      setProgress(100);
      setFading(true);
      const closeTimer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 450);
      return () => clearTimeout(closeTimer);
    }, durationMs);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [durationMs, onComplete]);

  if (!visible) return null;

  return (
    <div
      onClick={() => {
        setFading(true);
        setTimeout(() => {
          setVisible(false);
          onComplete?.();
        }, 300);
      }}
      className={`fixed inset-0 z-100 flex flex-col items-center justify-between p-8 bg-white transition-opacity duration-500 select-none cursor-pointer ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #eef2ff 100%)',
      }}
    >
      {/* Top ambient decor */}
      <div className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 max-w-sm pt-4 opacity-75">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Verified Event Pass</span>
        </span>
        <span className="font-mono text-[10px]">TIXORA MOBILE</span>
      </div>

      {/* Center Branded Animated Emblem */}
      <div className="flex flex-col items-center justify-center space-y-6 my-auto">
        {/* Glow Aura */}
        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-to-tr from-indigo-500/20 via-blue-400/20 to-violet-500/10 rounded-full blur-2xl animate-pulse" />

          {/* Large Logo Emblem */}
          <div className="relative animate-in zoom-in-75 duration-700 ease-out flex flex-col items-center">
            <TixoraLogo size={110} showText={false} layout="vertical" />
          </div>
        </div>

        {/* Wordmark with PRO badge and Tagline */}
        <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <div className="flex items-center justify-center gap-2">
            <h1
              className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            >
              Tixora
            </h1>
            <span className="inline-flex items-center justify-center bg-amber-400 text-slate-950 font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_#0f172a] uppercase tracking-wide">
              PRO
            </span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-600 max-w-xs mx-auto">
            Platform Tiket & Gate Pass Resmi
          </p>
        </div>

        {/* Mobile App Loading Progress Bar */}
        <div className="w-48 sm:w-56 space-y-2 pt-2 animate-in fade-in duration-500 delay-300">
          <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out shadow-xs"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
            <span>Menyiapkan aplikasi...</span>
            <span className="font-mono">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer Notice */}
      <div className="text-center pb-4 text-[11px] font-semibold text-slate-400">
        <p>© 2026 Tixora • Siap Digunakan di Ponsel</p>
      </div>
    </div>
  );
};
