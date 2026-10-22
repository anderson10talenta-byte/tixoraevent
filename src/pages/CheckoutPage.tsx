import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Lock,
  AlertCircle,
  Copy,
  Check,
  Download,
  Upload,
  Clock,
  Trash2,
  FileText,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { formatCurrencyIDR } from '../lib/capacity';
import type { Event, TicketType, Profile } from '../lib/types';

interface CheckoutPageProps {
  event: Event;
  ticketType: TicketType;
  quantity: number;
  currentProfile: Profile | null;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  event,
  ticketType,
  quantity,
  currentProfile,
  onBack,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState(currentProfile?.fullName || 'Budi Santoso');
  const [email, setEmail] = useState(currentProfile?.email || 'budi@example.com');
  const [phone, setPhone] = useState(currentProfile?.phone || '+6281234567890');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checkout Steps: 'details' -> 'qris_payment' -> 'proof_submitted'
  const [step, setStep] = useState<'details' | 'qris_payment' | 'proof_submitted'>('details');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string>('');

  // Screenshot proof state
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [fileSizeMB, setFileSizeMB] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderBank, setSenderBank] = useState('BCA');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Copy helpers
  const [copiedNominal, setCopiedNominal] = useState(false);
  const [copiedOrder, setCopiedOrder] = useState(false);

  const subtotalMinor = ticketType.priceMinor * quantity;
  const isFree = subtotalMinor === 0;
  const feesMinor = isFree ? 0 : 5000;
  const totalMinor = subtotalMinor + feesMinor;

  // The official GoPay Merchant QRIS asset path
  const QRIS_IMAGE_PATH = '/assets/aistudio/WhatsApp_Image_2026-10-21_at_23.48.01_840ca9f1.jpeg';

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || email || '',
          'x-user-name': currentProfile?.fullName || fullName || '',
        },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeId: ticketType.id,
          quantity,
          fullName,
          email,
          phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pesanan');
      }

      if (isFree) {
        // Free ticket is immediately confirmed!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        onSuccess(data.order.id);
      } else {
        // Paid ticket proceeds to QRIS payment & screenshot proof upload
        setPendingOrderId(data.order.id);
        setOrderNumber(data.order.orderNumber || data.order.id);
        setSenderName(fullName);
        setStep('qris_payment');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  // Image upload handling for payment proof (Max 50MB)
  const processImageFile = (file: File) => {
    setError(null);
    const MAX_SIZE_BYTES = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Ukuran file screenshot terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maksimal 50MB.`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, atau WEBP).');
      return;
    }

    setFileName(file.name);
    setFileSizeMB((file.size / (1024 * 1024)).toFixed(2));

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawBase64 = e.target?.result as string;

      // Compress preview resolution to max 1280px for optimal speed
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setPaymentProofUrl(compressed);
        } else {
          setPaymentProofUrl(rawBase64);
        }
      };
      img.onerror = () => {
        setPaymentProofUrl(rawBase64);
      };
      img.src = rawBase64;
    };
    reader.onerror = () => {
      setError('Gagal membaca file gambar screenshot.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingOrderId) return;
    if (!paymentProofUrl) {
      setError('Silakan unggah foto screenshot bukti transfer terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${pendingOrderId}/payment-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || email || '',
          'x-user-name': currentProfile?.fullName || fullName || '',
        },
        body: JSON.stringify({
          paymentProofUrl,
          senderName,
          senderBank,
          notes: paymentNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim bukti pembayaran');
      }

      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 },
      });
      setStep('proof_submitted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim bukti pembayaran');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyNominal = () => {
    navigator.clipboard.writeText(totalMinor.toString());
    setCopiedNominal(true);
    setTimeout(() => setCopiedNominal(false), 2000);
  };

  const handleCopyOrder = () => {
    if (!orderNumber) return;
    navigator.clipboard.writeText(orderNumber);
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-slate-700 hover:text-slate-900 transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Detail Event</span>
      </button>

      <div className="cartoon-card bg-white overflow-hidden">
        {/* Header Banner */}
        <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-3 border-slate-900">
          <div>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-yellow-300">
              Checkout & Pembayaran Tiket
            </span>
            <h2 className="text-xl sm:text-2xl font-black mt-0.5">{event.title}</h2>
          </div>
          <div className="text-left sm:text-right bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-300 block">Kategori Tiket</span>
            <span className="font-black text-yellow-300 text-xs sm:text-sm">
              {ticketType.name} ({quantity}x)
            </span>
          </div>
        </div>

        {error && (
          <div className="m-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-3 text-rose-700 text-xs sm:text-sm font-bold shadow-xs">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <p>{error}</p>
          </div>
        )}

        {/* STEP 1: Attendee Information */}
        {step === 'details' && (
          <form onSubmit={handleCreateOrder} className="p-6 sm:p-8 space-y-6">
            <div className="space-y-4">
              <h3 className="font-black text-slate-900 text-base">Informasi Pemesan / Pemegang Tiket</h3>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  Nama Lengkap (sesuai identitas KTP/Paspor) *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1.5">
                    Alamat Email (E-Ticket dikirim ke sini) *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1.5">
                    Nomor WhatsApp / Telepon *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="p-5 bg-amber-50/70 rounded-2xl border-2 border-slate-900 space-y-2 text-xs sm:text-sm font-bold shadow-[3px_3px_0px_0px_#0f172a]">
              <div className="flex justify-between text-slate-700">
                <span>
                  Harga Tiket ({ticketType.name} x {quantity})
                </span>
                <span>{isFree ? 'Gratis' : formatCurrencyIDR(subtotalMinor)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Biaya Platform & Layanan</span>
                <span>{isFree ? 'Rp 0' : formatCurrencyIDR(feesMinor)}</span>
              </div>
              <div className="pt-2 border-t-2 border-slate-900 flex justify-between font-black text-base text-slate-900">
                <span>Total Pembayaran</span>
                <span className="text-indigo-700">{isFree ? 'Gratis' : formatCurrencyIDR(totalMinor)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Transaksi diamankan dengan reservasi kapasitas dan verifikasi bukti transfer manual.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="cartoon-btn w-full py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 text-slate-900 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>
                  {isFree
                    ? 'Konfirmasi Pendaftaran Gratis'
                    : `Lanjut ke Pembayaran QRIS (${formatCurrencyIDR(totalMinor)})`}
                </span>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: DYNAMIC QRIS PAYMENT & SCREENSHOT PROOF UPLOAD */}
        {step === 'qris_payment' && (
          <div className="p-6 sm:p-8 space-y-8">
            {/* Dynamic Nominal Alert Card */}
            <div className="bg-amber-100 rounded-3xl border-3 border-slate-900 p-5 sm:p-6 shadow-[5px_5px_0px_0px_#0f172a] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-yellow-300 rounded-xl border-2 border-slate-900">
                    <Smartphone className="w-5 h-5 text-slate-900" />
                  </span>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm sm:text-base">
                      Pindai QRIS & Bayar Sesuai Nominal
                    </h3>
                    <p className="text-[11px] font-bold text-slate-700">
                      NMID: <span className="font-mono text-slate-900">ID1024358579737</span> • SOLVERSTUDIO.ID
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white px-3 py-1 rounded-xl border-2 border-slate-900 text-xs font-black text-amber-900">
                  <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                  <span>Batas Waktu: 15 Menit</span>
                </div>
              </div>

              {/* Dynamic Amount with Copy Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border-2.5 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a]">
                <div>
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                    Total Nominal Pas
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
                    {formatCurrencyIDR(totalMinor)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyNominal}
                  className="cartoon-btn px-4 py-2 bg-yellow-300 hover:bg-yellow-400 text-slate-900 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  {copiedNominal ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Nominal Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-900" />
                      <span>Salin Nominal</span>
                    </>
                  )}
                </button>
              </div>

              {/* Order Reference Number */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                <span>
                  No. Pesanan:{' '}
                  <span className="font-mono font-black text-slate-900">{orderNumber}</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyOrder}
                  className="text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedOrder ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedOrder ? 'Tersalin' : 'Salin No. Pesanan'}</span>
                </button>
              </div>
            </div>

            {/* QRIS Code Graphic Image Display (Solverstudio.id GoPay Merchant) */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative p-3 bg-white rounded-3xl border-3 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] max-w-sm w-full overflow-hidden">
                <img
                  src={QRIS_IMAGE_PATH}
                  alt="QRIS Solverstudio.id"
                  className="w-full h-auto rounded-2xl block object-contain"
                />

                <div className="mt-3 text-center">
                  <a
                    href={QRIS_IMAGE_PATH}
                    download="QRIS-Solverstudio-Tixora.jpeg"
                    target="_blank"
                    rel="noreferrer"
                    className="cartoon-btn w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl inline-flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4 text-yellow-300" />
                    <span>Unduh Gambar QRIS (Bayar via Galeri)</span>
                  </a>
                </div>
              </div>

              <p className="text-xs text-slate-600 font-bold max-w-md text-center leading-relaxed">
                Mendukung pembayaran dari semua aplikasi: <br />
                <span className="font-black text-slate-900">
                  GoPay, BCA Mobile, Livin Mandiri, BRImo, BNI, OVO, Dana, ShopeePay, LinkAja.
                </span>
              </p>
            </div>

            {/* --- UPLOAD SCREENSHOT BUKTI TRANSFER --- */}
            <form onSubmit={handleSubmitProof} className="space-y-5 pt-4 border-t-3 border-slate-900">
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <span>Unggah Bukti Screenshot Pembayaran *</span>
                </h4>
                <p className="text-xs font-bold text-slate-600">
                  Setelah selesai transfer di aplikasi m-banking atau e-wallet Anda, unggah tangkapan layarnya di bawah
                  ini agar admin memverifikasi pesanan Anda.
                </p>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processImageFile(e.target.files[0]);
                  }
                }}
              />

              {/* Dropzone / Preview */}
              {paymentProofUrl ? (
                <div className="relative rounded-2xl border-2.5 border-slate-900 overflow-hidden shadow-[4px_4px_0px_0px_#0f172a] bg-slate-950 p-3 group">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={paymentProofUrl}
                      alt="Bukti Transfer"
                      className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-xl border border-slate-700 shrink-0"
                    />
                    <div className="flex-1 text-white space-y-1.5 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-400 font-black text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Screenshot Bukti Berhasil Dimuat</span>
                      </div>
                      <p className="text-xs font-mono font-bold text-slate-300 truncate max-w-xs">{fileName}</p>
                      {fileSizeMB && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">
                          {fileSizeMB} MB
                        </span>
                      )}

                      <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Ganti Foto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentProofUrl('');
                            setFileName('');
                            setFileSizeMB('');
                          }}
                          className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                  className={`border-3 border-dashed rounded-3xl p-8 text-center cursor-pointer transition ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-50/70 scale-[0.99]'
                      : 'border-slate-400 bg-amber-50/30 hover:bg-amber-50/60'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-yellow-300 border-2.5 border-slate-900 mx-auto flex items-center justify-center shadow-[3px_3px_0px_0px_#0f172a] text-slate-900 mb-3">
                    <Upload className="w-8 h-8 text-indigo-700" />
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    Klik atau Tarik & Letakkan Foto Screenshot Bukti Transfer
                  </p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Maksimal 50MB (JPG, PNG, WEBP)</p>
                </div>
              )}

              {/* Sender Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">
                    Nama Pemilik Rekening / Akun E-Wallet *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">
                    Metode / Bank yang Digunakan *
                  </label>
                  <select
                    value={senderBank}
                    onChange={(e) => setSenderBank(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50"
                  >
                    <option value="GoPay">GoPay</option>
                    <option value="BCA">BCA Mobile / myBCA</option>
                    <option value="Mandiri">Livin' by Mandiri</option>
                    <option value="BRI">BRImo</option>
                    <option value="BNI">BNI Mobile Banking</option>
                    <option value="OVO">OVO</option>
                    <option value="Dana">DANA</option>
                    <option value="ShopeePay">ShopeePay</option>
                    <option value="Lainnya">Bank / E-Wallet Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Transfer jam 14:30 WIB"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50"
                />
              </div>

              {/* Submit Proof Button */}
              <button
                type="submit"
                disabled={loading || !paymentProofUrl}
                className="cartoon-btn w-full py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 disabled:opacity-50 text-slate-900 transition flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_#0f172a]"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-slate-900" />
                    <span>Kirim Bukti Pembayaran & Tunggu Verifikasi Admin 🚀</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: PROOF SUBMITTED CONFIRMATION */}
        {step === 'proof_submitted' && (
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 border-3 border-slate-900 mx-auto flex items-center justify-center shadow-[4px_4px_0px_0px_#0f172a]">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <span className="inline-block px-3 py-1 rounded-full bg-yellow-300 text-slate-900 border-2 border-slate-900 text-xs font-black">
                Status: Menunggu Persetujuan Admin 🛡️
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Bukti Pembayaran Berhasil Dikirim!
              </h3>
              <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
                Terima kasih! Bukti transfer untuk pesanan{' '}
                <span className="font-mono text-slate-900 font-black">{orderNumber}</span> telah diterima. Admin
                akan segera memverifikasi nominal Anda.
              </p>
              <div className="p-4 bg-amber-50 rounded-2xl border-2 border-slate-900 text-left text-xs font-bold text-slate-800 space-y-1 mt-4">
                <p className="flex items-center gap-1.5 text-indigo-700 font-black">
                  <Sparkles className="w-4 h-4" />
                  <span>Kapan QR Tiket Muncul?</span>
                </p>
                <p className="text-slate-600">
                  Begitu bukti pembayaran disetujui oleh admin, barcode / QR Code tiket digital Anda akan langsung
                  muncul otomatis di menu <span className="font-black text-slate-900">"Tiket Digital Saya"</span>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSuccess(pendingOrderId || '')}
              className="cartoon-btn px-8 py-3.5 bg-yellow-300 hover:bg-yellow-400 text-slate-900 font-black text-xs sm:text-sm rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] transition cursor-pointer"
            >
              Lihat Status di Menu Tiket Saya 🎟️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
