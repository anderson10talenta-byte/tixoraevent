import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  Keyboard,
  AlertCircle,
  RefreshCw,
  Upload,
  CheckCircle2,
  Sparkles,
  Zap,
} from 'lucide-react';

interface CameraQRScannerProps {
  onScan: (token: string) => void;
  isProcessing?: boolean;
}

export const CameraQRScanner: React.FC<CameraQRScannerProps> = ({
  onScan,
  isProcessing = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'upload'>('camera');
  const [imageScanning, setImageScanning] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastScannedToken = useRef<string | null>(null);
  const lastScanTimestamp = useRef<number>(0);

  // Play auditory feedback beep
  const playBeep = (success = true) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = success ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(success ? 880 : 330, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext not allowed or unsupported
    }
  };

  const handleScanSuccess = useCallback(
    (token: string) => {
      const clean = token.trim();
      if (!clean) return;

      const now = Date.now();
      // Throttle duplicate scan callbacks (minimum 2.5 seconds between identical tokens)
      if (lastScannedToken.current === clean && now - lastScanTimestamp.current < 2500) {
        return;
      }

      lastScannedToken.current = clean;
      lastScanTimestamp.current = now;
      playBeep(true);
      onScan(clean);
    },
    [onScan]
  );

  // QR Scanning Loop
  const scanLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleScanSuccess(code.data);
        }
      }
    }

    if (!isProcessing && isCameraActive) {
      animationFrameId.current = requestAnimationFrame(scanLoop);
    }
  }, [handleScanSuccess, isProcessing, isCameraActive]);

  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = async (preferredMode = facingMode) => {
    setCameraLoading(true);
    setCameraError(null);

    // Stop previous stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser ini tidak mendukung akses kamera langsung. Silakan gunakan opsi unggah gambar atau input manual.');
      setCameraLoading(false);
      return;
    }

    let stream: MediaStream | null = null;
    try {
      // 1. Try with preferred facingMode
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: preferredMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (e1) {
      console.warn('Initial camera constraint failed, retrying with simple video=true:', e1);
      try {
        // 2. Fallback to generic video
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (e2: any) {
        console.error('Camera access completely denied/unavailable:', e2);
        setCameraError(
          e2.name === 'NotAllowedError' || e2.name === 'PermissionDeniedError'
            ? 'Izin kamera ditolak. Silakan klik ikon gembok di URL browser untuk memberikan izin kamera.'
            : e2.name === 'NotFoundError'
            ? 'Perangkat kamera tidak ditemukan di laptop/komputer ini.'
            : `Gagal mengaktifkan kamera (${e2.message || 'Error'}). Silakan gunakan opsi unggah foto QR atau input manual.`
        );
        setCameraLoading(false);
        setIsCameraActive(false);
        return;
      }
    }

    if (stream && videoRef.current) {
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('autoplay', 'true');

      try {
        await videoRef.current.play();
        setIsCameraActive(true);
        setCameraLoading(false);
        animationFrameId.current = requestAnimationFrame(scanLoop);
      } catch (playErr) {
        console.warn('Video play error:', playErr);
        setIsCameraActive(true);
        setCameraLoading(false);
        animationFrameId.current = requestAnimationFrame(scanLoop);
      }
    }
  };

  // Re-run scan loop when processing finishes
  useEffect(() => {
    if (isCameraActive && !isProcessing) {
      animationFrameId.current = requestAnimationFrame(scanLoop);
    }
  }, [isProcessing, isCameraActive, scanLoop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isCameraActive) {
      await startCamera(nextMode);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    handleScanSuccess(manualToken.trim());
    setManualToken('');
  };

  // Scan QR from image file
  const handleImageFile = (file: File) => {
    setImageScanning(true);
    setCameraError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setImageScanning(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        setImageScanning(false);
        if (code && code.data) {
          handleScanSuccess(code.data);
        } else {
          setCameraError('QR Code tidak terdeteksi pada gambar yang diunggah. Pastikan barcode terlihat jelas dan tidak buram.');
        }
      };
      img.onerror = () => {
        setImageScanning(false);
        setCameraError('Gagal membaca gambar');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-4">
      {/* Mode Navigation Tabs */}
      <div className="grid grid-cols-3 gap-2 w-full p-1.5 bg-slate-100 rounded-2xl border-2 border-slate-900 text-xs font-black shadow-[3px_3px_0px_0px_#0f172a]">
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'camera'
              ? 'bg-yellow-300 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Kamera Langsung</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-yellow-300 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Unggah Foto QR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'manual'
              ? 'bg-yellow-300 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Input Manual</span>
        </button>
      </div>

      {/* 1. Camera Tab View */}
      {activeTab === 'camera' && (
        <div className="w-full space-y-3">
          <div className="relative w-full aspect-square bg-slate-950 rounded-3xl overflow-hidden border-3 border-slate-900 shadow-[5px_5px_0px_0px_#0f172a] flex items-center justify-center">
            {isCameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Target Reticle Viewfinder */}
                <div className="absolute inset-12 border-2 border-yellow-300 rounded-2xl pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-300 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-300 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-300 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-300 rounded-br-lg"></div>
                  <div className="w-full h-0.5 bg-linear-to-r from-transparent via-yellow-300 to-transparent shadow-[0_0_12px_#fde047] animate-pulse"></div>
                </div>

                {/* Switch Camera Overlay Button */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-2.5 bg-slate-900/80 backdrop-blur-md rounded-full text-white hover:bg-slate-800 transition border-2 border-slate-700 shadow-md cursor-pointer"
                    title="Ganti Kamera Depan/Belakang"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-xs text-white border border-slate-700 font-bold shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Arahkan kamera ke QR Code Tiket
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border-2 border-slate-700 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-yellow-300" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Kamera Belum Aktif</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    {cameraError || 'Klik tombol di bawah untuk mengaktifkan kamera scanner pintu gerbang venue.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => startCamera()}
                  disabled={cameraLoading}
                  className="px-6 py-3 bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 text-slate-900 font-black rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  {cameraLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                      <span>Menghubungkan Kamera...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-slate-900" />
                      <span>Nyalakan Kamera Scanner 📷</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                <div className="w-10 h-10 border-4 border-yellow-300 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-black tracking-wide">Memvalidasi tiket di server...</p>
              </div>
            )}
          </div>

          {isCameraActive && (
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                Kamera Aktif ({facingMode === 'environment' ? 'Belakang' : 'Depan'})
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
              >
                Matikan Kamera
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Upload / Scan from Image Tab View */}
      {activeTab === 'upload' && (
        <div className="w-full bg-white p-5 rounded-3xl border-3 border-slate-900 shadow-[5px_5px_0px_0px_#0f172a] space-y-4">
          <div className="text-center">
            <h4 className="text-sm font-black text-slate-900">Pindai dari Foto / Screenshot QR</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih foto kode QR tiket langsung dari galeri ponsel atau laptop petugas.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleImageFile(e.target.files[0]);
              }
            }}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageFile(e.dataTransfer.files[0]);
              }
            }}
            className="border-2.5 border-dashed border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 p-6 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition"
          >
            {imageScanning ? (
              <div className="space-y-2">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-black text-indigo-900">Menganalisis Kode Barcode...</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-900 flex items-center justify-center shadow-[2px_2px_0px_0px_#0f172a] mb-2 text-indigo-600">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-black text-slate-900">Klik atau Drag & Drop Foto QR Tiket</p>
                <p className="text-[11px] text-slate-500 mt-0.5">PNG, JPG, WEBP hingga 50MB</p>
              </>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Manual Token Entry Tab View */}
      {activeTab === 'manual' && (
        <div className="w-full bg-white p-5 rounded-3xl border-3 border-slate-900 shadow-[5px_5px_0px_0px_#0f172a] space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
            <Keyboard className="w-4 h-4 text-indigo-600" />
            <span>Ketik Kode Tiket / Token</span>
          </div>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Contoh: TIX-BAND-00101 atau token"
              disabled={isProcessing}
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm font-mono font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50"
            />
            <button
              type="submit"
              disabled={isProcessing || !manualToken.trim()}
              className="px-5 py-2.5 bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 disabled:opacity-50 text-slate-900 text-xs sm:text-sm font-black rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition cursor-pointer"
            >
              Validasi
            </button>
          </form>
          <p className="text-[11px] text-slate-500 font-medium">
            Gunakan opsi ini jika kamera terhalang atau pengunjung hanya membawa struk nomor tiket fisik.
          </p>
        </div>
      )}
    </div>
  );
};
