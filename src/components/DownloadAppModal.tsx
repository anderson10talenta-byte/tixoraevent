import React, { useState, useEffect } from 'react';
import { X, Smartphone, Download, CheckCircle2, Share, QrCode, Sparkles } from 'lucide-react';
import { TixoraLogo } from './TixoraLogo';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const [guideHighlighted, setGuideHighlighted] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setGuideHighlighted(true);
      setTimeout(() => setGuideHighlighted(false), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
      <div className="bg-white rounded-3xl border-2.5 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] w-full max-w-md my-auto p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-white border-2.5 border-slate-900 mx-auto flex items-center justify-center shadow-[3px_3px_0px_0px_#0f172a] p-2">
            <TixoraLogo size={52} showText={false} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
            <span>Pasang Aplikasi Tixora</span>
            <Smartphone className="w-6 h-6 text-indigo-600 inline" />
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Akses tiket digital Anda langsung dari layar utama ponsel Anda, siap pakai kapan saja bahkan saat sinyal lemah.
          </p>
        </div>

        {/* Benefit cards */}
        <div className="space-y-2.5">
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-3 text-xs text-slate-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold block">Buka Tiket Tanpa Antre</span>
              <span className="text-[11px] text-slate-500">QR Code tersimpan cepat tanpa harus membuka browser lagi.</span>
            </div>
          </div>

          <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200 flex items-center gap-3 text-xs text-slate-800">
            <QrCode className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <span className="font-bold block">Scanner Gerbang Cepat untuk Petugas</span>
              <span className="text-[11px] text-slate-500">Kamera langsung aktif untuk validasi tiket penonton.</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-3">
          {isInstalled ? (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-center text-xs font-bold text-emerald-800">
              ✓ Aplikasi Tixora sudah terpasang di perangkat Anda!
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Pasang ke Layar Utama Sekarang</span>
            </button>
          )}

          {/* Platform Specific Quick Guide */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 space-y-2 text-[11px] ${
              guideHighlighted
                ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300 text-slate-900 shadow-md'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 block">Panduan Cepat Pasang Manual:</span>
              {guideHighlighted && (
                <span className="text-[10px] font-black text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                  Langkah Mudah di Browser Anda
                </span>
              )}
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-indigo-600 shrink-0">• Android Chrome:</span>
              <span>Ketuk menu titik tiga (⋮) di pojok kanan atas &gt; pilih "Install aplikasi" / "Tambahkan ke Layar Utama".</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-indigo-600 shrink-0">• iPhone / iPad (Safari):</span>
              <span>Ketuk tombol Bagikan (Share <Share className="w-3 h-3 inline" />) di bawah &gt; pilih "Tambah ke Layar Utama".</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-indigo-600 shrink-0">• Laptop / PC:</span>
              <span>Klik ikon install (<Download className="w-3 h-3 inline" />) di sebelah kanan address bar browser Anda.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
