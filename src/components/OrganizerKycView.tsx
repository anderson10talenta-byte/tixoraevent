import React, { useState } from 'react';
import {
  ShieldCheck,
  CreditCard,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Phone,
  MapPin,
  Camera,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type { Profile, OrganizerApplication, OrganizerVerificationStatus } from '../lib/types';
import confetti from 'canvas-confetti';

interface OrganizerKycViewProps {
  currentProfile: Profile | null;
  status: OrganizerVerificationStatus;
  application?: OrganizerApplication | null;
  onApplicationSubmitted: () => void;
  onRefreshStatus: () => void;
}

export const OrganizerKycView: React.FC<OrganizerKycViewProps> = ({
  currentProfile,
  status,
  application,
  onApplicationSubmitted,
  onRefreshStatus,
}) => {
  const [organizationName, setOrganizationName] = useState(application?.organizationName || '');
  const [nikKtp, setNikKtp] = useState(application?.nikKtp || '');
  const [ktpImageUrl, setKtpImageUrl] = useState(
    application?.ktpImageUrl ||
      'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80'
  );
  const [bankName, setBankName] = useState(application?.bankName || 'BCA');
  const [bankAccountNumber, setBankAccountNumber] = useState(application?.bankAccountNumber || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(
    application?.bankAccountHolder || currentProfile?.fullName || ''
  );
  const [applicantPhone, setApplicantPhone] = useState(
    application?.applicantPhone || currentProfile?.phone || ''
  );
  const [officeAddress, setOfficeAddress] = useState(application?.officeAddress || '');
  const [eventExperience, setEventExperience] = useState(application?.eventExperience || '');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(status === 'rejected');

  const bankOptions = [
    'BCA (Bank Central Asia)',
    'Bank Mandiri',
    'BRI (Bank Rakyat Indonesia)',
    'BNI (Bank Negara Indonesia)',
    'Bank Jago',
    'CIMB Niaga',
    'Bank Permata',
    'BSI (Bank Syariah Indonesia)',
  ];

  const handleKtpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setKtpImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (nikKtp.trim().length < 16) {
      setErrorMsg('Nomor NIK KTP harus berjumlah 16 digit angka.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/organizer/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
        body: JSON.stringify({
          organizationName,
          nikKtp,
          ktpImageUrl,
          bankName,
          bankAccountNumber,
          bankAccountHolder,
          applicantPhone,
          officeAddress,
          eventExperience,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pengajuan penyelenggara');
      }

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      setIsEditing(false);
      onApplicationSubmitted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat mengirim verifikasi.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Pending Screen (Waiting for Super Admin Approval)
  if (status === 'pending' && !isEditing) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-center p-8 sm:p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 border-2 border-amber-300 mx-auto flex items-center justify-center animate-pulse">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <span>Menunggu Verifikasi Super Admin (1x24 Jam)</span>
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Pengajuan Penyelenggara Sedang Ditinjau
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Terima kasih! Dokumen identitas KTP & rekening bank Anda telah aman tersimpan. Tim Super Admin Tixora sedang memverifikasi keabsahan data untuk mengaktifkan izin penerbitan tiket resmi.
            </p>
          </div>

          {/* Submitted Summary */}
          {application && (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Nama Organisasi:</span>
                <span className="font-bold text-slate-900">{application.organizationName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">NIK KTP Penanggung Jawab:</span>
                <span className="font-mono font-bold text-slate-800">
                  {application.nikKtp.slice(0, 6)}******{application.nikKtp.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-semibold">Rekening Penyaluran:</span>
                <span className="font-bold text-indigo-700">
                  {application.bankName} - {application.bankAccountNumber} (a.n. {application.bankAccountHolder})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Waktu Pengajuan:</span>
                <span className="text-slate-700">
                  {new Date(application.submittedAt).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onRefreshStatus}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cek Status Verifikasi Terkini</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Rejected Screen
  if (status === 'rejected' && !isEditing) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-rose-200 shadow-xl overflow-hidden p-8 sm:p-10 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 border-2 border-rose-300 mx-auto flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Pengajuan Perlu Diperbaiki
            </h2>
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold max-w-md mx-auto text-left">
              <span className="font-bold block mb-1">Catatan Evaluasi Super Admin:</span>
              <p>{application?.rejectionReason || 'Foto KTP kurang jelas atau data rekening belum valid.'}</p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
          >
            <span>Perbaiki & Ajukan Ulang Data KYC</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 3. New Application Form (Formulir Pengajuan Penyelenggara Resmi)
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 bg-slate-900 text-white space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950 text-indigo-400 text-xs font-bold border border-indigo-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verifikasi Penyelenggara Resmi (KYC Organizer)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Formulir Pendaftaran Penyelenggara Event
          </h1>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Untuk menjaga keamanan penonton dan pencegahan tiket palsu, setiap akun yang ingin membuat event di Tixora wajib memverifikasi identitas penanggung jawab (KTP) dan nomor rekening penyaluran hasil penjualan tiket yang akan disetujui oleh Super Admin.
          </p>
        </div>

        {errorMsg && (
          <div className="m-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          {/* Section 1: Organisasi & Identitas KTP */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>1. Profil Penyelenggara & Identitas Legal (KTP)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Organisasi / Komunitas / Promotor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kinarya Creative Studio"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Induk Kependudukan (NIK KTP 16 Digit) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="3273xxxxxxxxxxxx"
                  value={nikKtp}
                  onChange={(e) => setNikKtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Scan KTP Upload & Preview */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Foto / Scan KTP Penanggung Jawab <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-4 text-center cursor-pointer transition bg-slate-50 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleKtpUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <span className="text-xs font-bold text-slate-700 block">Pilih File Foto KTP</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">JPG, PNG maksimal 5MB</span>
                </div>

                <div className="relative aspect-16/10 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
                  {ktpImageUrl ? (
                    <img
                      src={ktpImageUrl}
                      alt="Pratinjau KTP"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold">Pratinjau KTP</span>
                  )}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-bold">
                    Dokumen Rahasia (Terenkripsi)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Rekening Bank Penyaluran */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <span>2. Rekening Bank Penyaluran Pendapatan Tiket (Payout)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Bank <span className="text-rose-500">*</span>
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                >
                  {bankOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Rekening Bank <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 8010293847"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pemilik Rekening (Sesuai KTP) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap di buku tabungan"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Kontak & Pengalaman Event */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <Phone className="w-4 h-4 text-indigo-600" />
              <span>3. Kontak Operasional & Alamat</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Bisnis Penyelenggara <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+6281234567890"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Kantor / Domisili <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jl. Thamrin No. 10, Jakarta Pusat"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Portofolio / Rencana Acara yang Akan Diselenggarakan (Opsional)
              </label>
              <textarea
                rows={2}
                placeholder="Ceritakan singkat event yang akan dibuat (misal konser musik, expo teknologi, bazar komunitas)..."
                value={eventExperience}
                onChange={(e) => setEventExperience(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Data dilindungi undang-undang privasi dan hanya digunakan untuk verifikasi Super Admin.</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Kirim Berkas Verifikasi ke Super Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
