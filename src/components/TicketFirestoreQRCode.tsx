import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Check,
  QrCode,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export interface TicketFirestoreQRCodeProps {
  /** The unique Firestore Document ID of the purchased ticket */
  ticketId: string;
  /** Human-readable ticket number (e.g. TIX-SW-1082) */
  ticketNumber: string;
  /** Associated Event ID */
  eventId?: string;
  /** Associated Event Title */
  eventTitle?: string;
  /** Ticket Holder / Attendee Name */
  attendeeName?: string;
  /** Ticket Status */
  status?: 'valid' | 'used' | 'expired';
  /** Check-in timestamp if already used */
  checkedInAt?: string;
  /** Fallback raw token if present */
  rawToken?: string;
  /** Custom canvas size in pixels */
  size?: number;
}

export const TicketFirestoreQRCode: React.FC<TicketFirestoreQRCodeProps> = ({
  ticketId,
  ticketNumber,
  eventId,
  eventTitle,
  attendeeName,
  status = 'valid',
  checkedInAt,
  rawToken,
  size = 230,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Single clean standard QR token: rawToken or ticketNumber
  const qrString = rawToken || ticketNumber || ticketId;

  useEffect(() => {
    if (!canvasRef.current || !qrString) return;

    QRCode.toCanvas(
      canvasRef.current,
      qrString,
      {
        width: size,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      },
      (err) => {
        if (err) {
          console.error('Failed to generate ticket QR code:', err);
          setError('Gagal merender QR Code');
        } else {
          setError(null);
        }
      }
    );
  }, [qrString, size]);

  const handleDownloadQr = () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Tiket-${ticketNumber || ticketId}.png`;
      link.href = dataUrl;
      link.click();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to download QR image:', err);
    }
  };

  const isUsed = status === 'used';
  const isExpired = status === 'expired';

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* Direct QR Canvas Box with Cartoon Styling & Status Overlays */}
      <div className="relative p-3.5 bg-white rounded-3xl border-3 border-slate-900 shadow-[5px_5px_0px_0px_#0f172a] overflow-hidden group">
        <div
          className={`transition-all duration-300 ${
            isUsed ? 'opacity-30 grayscale-50' : isExpired ? 'opacity-20 grayscale' : 'opacity-100'
          }`}
        >
          {error ? (
            <div className="flex flex-col items-center justify-center w-56 h-56 bg-slate-50 text-slate-400 text-xs">
              <QrCode className="w-10 h-10 mb-2 stroke-1 text-slate-400" />
              <p>{error}</p>
            </div>
          ) : (
            <canvas ref={canvasRef} className="rounded-2xl block" />
          )}
        </div>

        {/* Dynamic Watermark Stamp for Checked-In / Used */}
        {isUsed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
            <div className="transform -rotate-12 px-4 py-2 border-3.5 border-amber-600 bg-amber-50/95 text-amber-950 font-black text-sm tracking-wider rounded-2xl shadow-xl uppercase text-center border-dashed">
              <span>SUDAH CHECK-IN</span>
              <span className="block text-[9px] font-bold text-amber-700 tracking-normal mt-0.5">
                {checkedInAt ? new Date(checkedInAt).toLocaleTimeString('id-ID') : 'TERPAKAI DI GATE'}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Watermark Stamp for Expired */}
        {isExpired && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
            <div className="transform -rotate-12 px-4 py-2 border-3.5 border-rose-600 bg-rose-50/95 text-rose-950 font-black text-sm tracking-wider rounded-2xl shadow-xl uppercase text-center border-dashed">
              <span>KEDALUWARSA</span>
              <span className="block text-[9px] font-bold text-rose-700 tracking-normal mt-0.5">
                EXPIRED
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Number & Download Button */}
      <div className="w-full max-w-xs space-y-2.5 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800 text-xs font-mono font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>No. Tiket: {ticketNumber}</span>
        </div>

        <button
          type="button"
          onClick={handleDownloadQr}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 rounded-2xl border-2 border-slate-900 text-xs font-black flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_#0f172a] transition cursor-pointer"
        >
          {downloadSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-700">QR Tiket Tersimpan di Perangkat</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Simpan / Unduh Gambar QR</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
