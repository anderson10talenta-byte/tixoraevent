import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  ticketNumber?: string;
  showTokenSnippet?: boolean;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 220,
  ticketNumber,
  showTokenSnippet = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(
        canvasRef.current,
        value,
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
            console.error('QR Code render error:', err);
            setError('Gagal memuat QR Code');
          } else {
            setError(null);
          }
        }
      );
    }
  }, [value, size]);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
      <div className="relative p-2 bg-white rounded-xl border border-slate-100 shadow-inner">
        {error ? (
          <div className="flex flex-col items-center justify-center w-52 h-52 bg-slate-50 text-slate-400 text-sm">
            <QrCode className="w-10 h-10 mb-2 stroke-1" />
            <p>{error}</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="rounded-lg" />
        )}
      </div>

      {ticketNumber && (
        <div className="mt-3 text-center">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Nomor Tiket</p>
          <p className="font-mono text-base font-bold text-slate-800">{ticketNumber}</p>
        </div>
      )}

      {showTokenSnippet && value && (
        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono text-slate-600">
          <span>Token: {value.slice(0, 12)}...{value.slice(-6)}</span>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
            title="Salin token QR"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};
