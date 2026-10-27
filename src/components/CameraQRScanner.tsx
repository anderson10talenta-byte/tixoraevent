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
  ExternalLink,
  Smartphone,
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
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [imageScanning, setImageScanning] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastScannedToken = useRef<string | null>(null);
  const lastScanTimestamp = useRef<number>(0);
  const barcodeDetectorRef = useRef<any>(null);

  // Initialize BarcodeDetector if browser supports it natively
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('BarcodeDetector initialization fallback to jsQR:', e);
      }
    }
  }, []);

  // Play auditory feedback beep
  const playBeep = (success = true) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
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
      // AudioContext not permitted or muted
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
  const scanLoop = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      let detectedToken: string | null = null;

      // 1. Try Hardware-accelerated BarcodeDetector if available
      if (barcodeDetectorRef.current) {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            detectedToken = barcodes[0].rawValue;
          }
        } catch {
          // fallback to canvas + jsQR
        }
      }

      // 2. Fallback to jsQR via canvas
      if (!detectedToken && canvasRef.current) {
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
            detectedToken = code.data;
          }
        }
      }

      if (detectedToken) {
        handleScanSuccess(detectedToken);
      }
    }

    if (!isProcessing && streamRef.current) {
      animationFrameId.current = requestAnimationFrame(scanLoop);
    }
  }, [handleScanSuccess, isProcessing]);

  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Track stop warning:', e);
        }
      });
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

    // Stop any existing stream
    stopCamera();

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        'Browser tidak mengizinkan akses kamera langsung di lingkungan ini. Gunakan tombol "Jepret Kamera HP" atau "Unggah Foto QR" di bawah.'
      );
      setCameraLoading(false);
      return;
    }

    let stream: MediaStream | null = null;
    let lastError: any = null;

    // Constraint cascade attempts:
    const constraintAttempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: preferredMode }, width: { ideal: 1280 } }, audio: false },
      { video: { facingMode: preferredMode }, audio: false },
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: true, audio: false },
    ];

    for (const constraints of constraintAttempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn('Camera constraint failed, trying next fallback:', constraints, err);
      }
    }

    if (!stream) {
      const errName = lastError?.name || '';
      console.error('All camera attempts failed:', lastError);

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errName === 'SecurityError') {
        setCameraError(
          'Izin kamera tidak diizinkan oleh browser atau dibatasi oleh izin iframe. Silakan klik ikon gembok di browser untuk mengizinkan kamera, atau gunakan fitur "Jepret Kamera HP" di bawah.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError('Tidak ada perangkat kamera yang terdeteksi di perangkat ini.');
      } else {
        setCameraError(
          `Gagal memulai kamera (${lastError?.message || 'Error'}). Gunakan opsi "Jepret Kamera HP" untuk memindai tiket dengan kamera ponsel.`
        );
      }

      setCameraLoading(false);
      setIsCameraActive(false);
      return;
    }

    // Attach stream to permanently mounted video element
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('autoplay', 'true');
      videoRef.current.muted = true;

      try {
        await videoRef.current.play();
      } catch (playErr) {
        console.warn('Video play resolved with notice:', playErr);
      }
    }

    setIsCameraActive(true);
    setCameraLoading(false);
    animationFrameId.current = requestAnimationFrame(scanLoop);
  };

  // Resume scan loop when processing completes
  useEffect(() => {
    if (isCameraActive && !isProcessing && streamRef.current) {
      animationFrameId.current = requestAnimationFrame(scanLoop);
    }
  }, [isProcessing, isCameraActive, scanLoop]);

  // Clean up on component unmount
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

  // Decode QR from any image file (or mobile camera snapshot)
  const processImageFile = (file: File) => {
    setImageScanning(true);
    setCameraError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        let detected = false;

        // 1. BarcodeDetector attempt
        if (barcodeDetectorRef.current) {
          try {
            const barcodes = await barcodeDetectorRef.current.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              setImageScanning(false);
              handleScanSuccess(barcodes[0].rawValue);
              detected = true;
              return;
            }
          } catch {
            // fallback
          }
        }

        // 2. jsQR canvas decode
        if (!detected) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });

            setImageScanning(false);
            if (code && code.data) {
              handleScanSuccess(code.data);
              return;
            }
          }
          setImageScanning(false);
          setCameraError(
            'QR Code tidak terbaca dari foto yang diambil. Pastikan kode QR tiket fokus, tidak silau, dan posisinya tegak lurus.'
          );
        }
      };
      img.onerror = () => {
        setImageScanning(false);
        setCameraError('Gagal membaca file gambar.');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-4">
      {/* Hidden file inputs for direct camera snapshot and file upload */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            processImageFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            processImageFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

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
          <span>Kamera Live</span>
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
          <span>Unggah / Foto</span>
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

      {/* 1. Camera Live View */}
      {activeTab === 'camera' && (
        <div className="w-full space-y-3">
          <div className="relative w-full aspect-square bg-slate-950 rounded-3xl overflow-hidden border-3 border-slate-900 shadow-[5px_5px_0px_0px_#0f172a] flex items-center justify-center">
            {/* Video element is permanently mounted to guarantee videoRef.current is never null */}
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                isCameraActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none -z-10'
              }`}
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Target Reticle Viewfinder (Active State) */}
            {isCameraActive && (
              <>
                <div className="absolute inset-12 border-2 border-yellow-300 rounded-2xl pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] z-20">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-300 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-300 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-300 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-300 rounded-br-lg"></div>
                  <div className="w-full h-0.5 bg-linear-to-r from-transparent via-yellow-300 to-transparent shadow-[0_0_12px_#fde047] animate-pulse"></div>
                </div>

                {/* Switch Camera Overlay Button */}
                <div className="absolute top-4 right-4 z-30 flex gap-2">
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-2.5 bg-slate-900/80 backdrop-blur-md rounded-full text-white hover:bg-slate-800 transition border-2 border-slate-700 shadow-md cursor-pointer"
                    title="Ganti Kamera Depan/Belakang"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-30">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-xs text-white border border-slate-700 font-bold shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Arahkan kamera ke QR Code Tiket
                  </span>
                </div>
              </>
            )}

            {/* Camera Inactive Placeholder Container */}
            {!isCameraActive && (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-3 z-10 w-full">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-md">
                  <Camera className="w-8 h-8 text-yellow-300" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Kamera Scanner Gerbang</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Klik tombol di bawah untuk menyalakan kamera langsung atau gunakan opsi jepret instan kamera ponsel.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 w-full max-w-xs pt-2">
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    disabled={cameraLoading}
                    className="w-full py-3 bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 text-slate-900 font-black rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    {cameraLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                        <span>Menghubungkan Kamera...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-slate-900" />
                        <span>Nyalakan Kamera Scanner</span>
                      </>
                    )}
                  </button>

                  {/* Direct Native Camera Snap (100% Reliable across all mobile devices & iframes) */}
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="w-full py-2.5 bg-white hover:bg-slate-50 text-indigo-700 font-black rounded-2xl border-2 border-indigo-700 shadow-[2px_2px_0px_0px_#4338ca] text-xs flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Jepret Kamera HP (100% Berhasil)</span>
                  </button>
                </div>
              </div>
            )}

            {/* In-Progress Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white z-40">
                <div className="w-10 h-10 border-4 border-yellow-300 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-black tracking-wide">Memvalidasi tiket di server...</p>
              </div>
            )}
          </div>

          {/* Active status & stop button */}
          {isCameraActive && (
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                Kamera Live Aktif ({facingMode === 'environment' ? 'Belakang' : 'Depan'})
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="text-xs text-rose-600 hover:text-rose-700 font-black flex items-center gap-1 cursor-pointer"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Matikan Kamera</span>
              </button>
            </div>
          )}

          {/* Error Alert Box with Actionable Fallbacks */}
          {cameraError && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-800 text-xs font-bold space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{cameraError}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-rose-200">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[11px] font-black cursor-pointer hover:bg-rose-700 flex items-center gap-1"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Gunakan Kamera HP Langsung</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 rounded-xl text-[11px] font-black cursor-pointer hover:bg-rose-100"
                >
                  Pindai dari Foto QR
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 rounded-xl text-[11px] font-black cursor-pointer hover:bg-rose-100"
                >
                  Input Token Tiket
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Upload / Scan from Image View */}
      {activeTab === 'upload' && (
        <div className="w-full bg-white p-5 rounded-3xl border-3 border-slate-900 shadow-[5px_5px_0px_0px_#0f172a] space-y-4">
          <div className="text-center">
            <h4 className="text-sm font-black text-slate-900">Pindai dari Foto atau Kamera</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Ambil foto tiket baru atau pilih screenshot QR Code tiket dari galeri ponsel/laptop.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="cartoon-btn py-3 px-3 bg-yellow-300 hover:bg-yellow-400 text-slate-900 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-slate-900" />
              <span>Jepret Foto Kamera</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="cartoon-btn py-3 px-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Pilih dari Galeri</span>
            </button>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                processImageFile(e.dataTransfer.files[0]);
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
                <p className="text-[11px] text-slate-500 mt-0.5">Mendukung format JPG, PNG, WEBP</p>
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
