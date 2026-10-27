import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Ticket,
  Sparkles,
  AlertCircle,
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  FileImage,
  Tag,
} from 'lucide-react';
import type { Profile, EventCategory } from '../lib/types';
import { createEventInFirestore } from '../lib/firestoreService';
import { DEFAULT_CATEGORIES } from '../lib/categoryIcons';

interface CreateEventPageProps {
  currentProfile: Profile | null;
  onBack: () => void;
  onEventCreated: (eventId: string) => void;
}

export const CreateEventPage: React.FC<CreateEventPageProps> = ({
  currentProfile,
  onBack,
  onEventCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoriesList, setCategoriesList] = useState<EventCategory[]>(DEFAULT_CATEGORIES);
  const [category, setCategory] = useState<string>('music');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (data && data.length > 0) {
          setCategoriesList(data);
          if (!category) setCategory(data[0].id);
        }
      })
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);
  
  // Cover Photo (Drag & Drop / Import up to 50MB)
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSizeMB, setFileSizeMB] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dates
  const [startsAt, setStartsAt] = useState('2026-12-15T15:00');
  const [endsAt, setEndsAt] = useState('2026-12-15T22:00');

  // Ticket Tiers
  const [ticketTypes, setTicketTypes] = useState([
    {
      name: 'Tiket Reguler Masuk',
      description: 'Akses umum seluruh area event',
      priceMinor: 100000,
      capacity: 500,
      maxPerOrder: 4,
    },
    {
      name: 'Free Community Pass',
      description: 'Khusus pelajar dan anggota komunitas',
      priceMinor: 0,
      capacity: 200,
      maxPerOrder: 2,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- PHOTO DRAG & DROP / FILE IMPORT HANDLER (MAX 50MB) ---
  const processImageFile = (file: File) => {
    setUploadError(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Hanya file foto/gambar (JPG, PNG, WEBP, GIF) yang didukung.');
      return;
    }

    // Validate file size (50MB = 50 * 1024 * 1024 bytes)
    const MAX_SIZE_BYTES = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(
        `Ukuran file foto (${(file.size / (1024 * 1024)).toFixed(1)}MB) melebihi batas maksimal 50MB.`
      );
      return;
    }

    setImageProcessing(true);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    setFileName(file.name);
    setFileSizeMB(sizeInMB);

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawBase64 = e.target?.result as string;

      // Smart client optimization: scale down extremely high resolutions (e.g. >1920px)
      // to ensure fast loading and reliable Firestore document sync
      const img = new Image();
      img.onload = () => {
        const maxDim = 1920;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          // High quality JPEG
          const optimized = canvas.toDataURL('image/jpeg', 0.88);
          setCoverImageUrl(optimized);
        } else {
          setCoverImageUrl(rawBase64);
        }
        setImageProcessing(false);
      };

      img.onerror = () => {
        setCoverImageUrl(rawBase64);
        setImageProcessing(false);
      };

      img.src = rawBase64;
    };

    reader.onerror = () => {
      setUploadError('Gagal membaca file gambar.');
      setImageProcessing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setCoverImageUrl('');
    setFileName('');
    setFileSizeMB('');
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddTicketType = () => {
    setTicketTypes([
      ...ticketTypes,
      {
        name: 'VIP All-Access',
        description: 'Lounge khusus & barisan depan',
        priceMinor: 250000,
        capacity: 100,
        maxPerOrder: 2,
      },
    ]);
  };

  const handleRemoveTicketType = (index: number) => {
    if (ticketTypes.length <= 1) return;
    setTicketTypes(ticketTypes.filter((_, i) => i !== index));
  };

  const handleUpdateTicketType = (index: number, field: string, value: any) => {
    const updated = [...ticketTypes];
    updated[index] = { ...updated[index], [field]: value };
    setTicketTypes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!coverImageUrl) {
      setError('Silakan unggah foto sampul (banner) event terlebih dahulu.');
      return;
    }

    setLoading(true);

    try {
      const startsDate = new Date(startsAt).toISOString();
      const endsDate = new Date(endsAt).toISOString();
      const salesStartsDate = new Date().toISOString();
      const salesEndsDate = startsDate;

      const payload = {
        title,
        description,
        category,
        venueName,
        venueAddress,
        coverImageUrl,
        bannerUrl: coverImageUrl,
        startsAt: startsDate,
        endsAt: endsDate,
        startDate: startsDate,
        endDate: endsDate,
        salesStartsAt: salesStartsDate,
        salesEndsAt: salesEndsDate,
        ticketTypes,
      };

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
        body: JSON.stringify(payload),
      });

      // Robust response parsing: verify content-type is JSON before calling .json()
      // to completely prevent "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        const cleanMsg = text.replace(/<[^>]+>/g, '').trim().slice(0, 120);
        throw new Error(cleanMsg || `Server error (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat event baru');
      }

      // Also persist to real Firestore
      try {
        await createEventInFirestore({
          ...payload,
          id: data.id,
          status: 'published',
          createdBy: currentProfile?.id || 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (fsErr) {
        console.warn('Firestore sync note:', fsErr);
      }

      onEventCreated(data.id);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan event');
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin =
    !!currentProfile?.isSuperAdmin ||
    currentProfile?.email?.toLowerCase() === 'anderson10.talenta@gmail.com';

  if (!isSuperAdmin && currentProfile?.organizerStatus !== 'approved') {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="cartoon-card bg-amber-50 p-8 sm:p-10 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-yellow-300 border-2.5 border-slate-900 mx-auto flex items-center justify-center shadow-[3px_3px_0px_0px_#0f172a] text-slate-900">
            <Ticket className="w-8 h-8 text-indigo-700" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Verifikasi Penyelenggara Diperlukan
          </h2>
          <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed max-w-md mx-auto">
            Sesuai standar operasional resmi Tixora, pengguna yang baru mendaftar wajib melengkapi data identitas (Scan KTP & Rekening Bank Pencairan) dan disetujui oleh Super Admin sebelum dapat mempublikasikan event.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onBack}
              className="cartoon-btn px-4 py-2.5 rounded-xl bg-white text-slate-700 text-xs font-bold cursor-pointer"
            >
              Kembali
            </button>
            <button
              onClick={onBack}
              className="cartoon-btn px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-[3px_3px_0px_0px_#0f172a] hover:bg-indigo-700 cursor-pointer"
            >
              Ajukan Verifikasi Organizer Sekarang →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      <button
        onClick={onBack}
        className="cartoon-btn inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-slate-900 text-xs font-black text-slate-800 shadow-[2px_2px_0px_0px_#0f172a] hover:bg-amber-100 transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Dashboard</span>
      </button>

      <div className="cartoon-card bg-white overflow-hidden shadow-[6px_6px_0px_0px_#0f172a]">
        <div className="p-6 bg-slate-900 text-white border-b-2.5 border-slate-900">
          <span className="text-xs font-black uppercase tracking-wider text-yellow-300 block mb-1">
            Formulir Penyelenggara Resmi
          </span>
          <h1 className="text-2xl font-black tracking-tight">Buat & Publikasikan Event Baru</h1>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            Konfigurasikan informasi acara, foto sampul, lokasi, dan kategori tiket untuk pengunjung.
          </p>
        </div>

        {error && (
          <div className="m-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          {/* Section 1: General Info */}
          <div className="space-y-5">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>1. Informasi Utama Event</span>
            </h3>

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1">Judul Acara / Event *</label>
              <input
                type="text"
                required
                placeholder="Contoh: Bandung Jazz Wave Festival 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">Kategori Acara *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 bg-white focus:border-indigo-600 focus:outline-none"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">Nama Tempat / Gedung Venue *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sasana Budaya Ganesha (Sabuga)"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50/50"
                />
              </div>
            </div>

            {/* --- COVER PHOTO: DRAG & DROP / CLICK TO IMPORT (MAX 50MB) --- */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-800">
                  Foto Sampul (Banner Acara) * <span className="text-slate-500 font-bold">(Maksimal 50MB)</span>
                </label>
                {coverImageUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Foto</span>
                  </button>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Dropzone Container */}
              {coverImageUrl ? (
                /* Photo Active Preview */
                <div className="relative rounded-2xl border-2.5 border-slate-900 overflow-hidden shadow-[4px_4px_0px_0px_#0f172a] bg-slate-950 group">
                  <img
                    src={coverImageUrl}
                    alt="Cover Preview"
                    className="w-full h-56 sm:h-64 object-cover opacity-90 group-hover:opacity-100 transition"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-white text-xs font-black">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="truncate max-w-xs">{fileName || 'Foto Sampul Terpasang'}</span>
                        {fileSizeMB && (
                          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">
                            {fileSizeMB} MB
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="cartoon-btn px-3 py-1.5 rounded-xl bg-yellow-300 text-slate-950 text-xs font-black shadow-[2px_2px_0px_0px_#0f172a] cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Ganti Foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="cartoon-btn px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-black shadow-[2px_2px_0px_0px_#0f172a] cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Drag & Drop Upload Zone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl border-3 border-dashed p-8 text-center transition-all cursor-pointer select-none ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-50/80 scale-[1.01]'
                      : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-yellow-300 border-2 border-slate-900 flex items-center justify-center shadow-[3px_3px_0px_0px_#0f172a] text-slate-900">
                      {imageProcessing ? (
                        <RefreshCw className="w-7 h-7 text-indigo-700 animate-spin" />
                      ) : (
                        <UploadCloud className="w-7 h-7 text-indigo-700" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">
                        {isDragging ? 'Lepaskan file foto di sini!' : 'Tarik & Lepas Foto Sampul di Sini'}
                      </p>
                      <p className="text-xs text-slate-500 font-bold">
                        atau klik untuk memilih file dari komputer / ponsel Anda
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-black">
                      <FileImage className="w-3.5 h-3.5" />
                      <span>Format: JPG, PNG, WEBP, GIF (Maksimal 50MB)</span>
                    </div>

                    <button
                      type="button"
                      className="cartoon-btn px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-[2px_2px_0px_0px_#0f172a] hover:bg-indigo-700 mt-2 pointer-events-none"
                    >
                      Pilih Foto Sampul (Maks. 50MB)
                    </button>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1">Deskripsi Lengkap Acara *</label>
              <textarea
                required
                rows={4}
                placeholder="Jelaskan detail line-up artis, pembicara, fasilitas, dan ketentuan masuk acara..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50/50"
              />
            </div>
          </div>

          {/* Section 2: Venue & Schedule */}
          <div className="space-y-4 pt-6 border-t-2 border-slate-200">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>2. Lokasi & Jadwal Pelaksanaan</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">Waktu Mulai Acara *</label>
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">Waktu Selesai Acara *</label>
                <input
                  type="datetime-local"
                  required
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1">Alamat Lengkap Venue *</label>
              <input
                type="text"
                required
                placeholder="Jl. Tamansari No.73, Lb. Siliwangi, Kota Bandung, Jawa Barat"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none bg-slate-50/50"
              />
            </div>
          </div>

          {/* Section 3: Ticket Types Builder */}
          <div className="space-y-4 pt-6 border-t-2 border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-indigo-600" />
                <span>3. Kategori & Harga Tiket Masuk</span>
              </h3>

              <button
                type="button"
                onClick={handleAddTicketType}
                className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 bg-yellow-300 text-slate-950 text-xs font-black shadow-[2px_2px_0px_0px_#0f172a] hover:bg-yellow-400 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kategori</span>
              </button>
            </div>

            <div className="space-y-4">
              {ticketTypes.map((tt, idx) => (
                <div
                  key={idx}
                  className="cartoon-card p-4 bg-slate-50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-indigo-700 uppercase tracking-wide">
                      Kategori #{idx + 1}
                    </span>
                    {ticketTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTicketType(idx)}
                        className="text-rose-600 hover:text-rose-800 p-1 transition cursor-pointer"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-black text-slate-700 block mb-1">Nama Tiket *</label>
                      <input
                        type="text"
                        required
                        value={tt.name}
                        onChange={(e) => handleUpdateTicketType(idx, 'name', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-bold bg-white rounded-lg border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-slate-700 block mb-1">
                        Harga Tiket (Rp) — isi 0 untuk Gratis
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        required
                        value={tt.priceMinor}
                        onChange={(e) => handleUpdateTicketType(idx, 'priceMinor', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white rounded-lg border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-black text-slate-700 block mb-1">Kuota Kapasitas Kursi *</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={tt.capacity}
                        onChange={(e) => handleUpdateTicketType(idx, 'capacity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white rounded-lg border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-slate-700 block mb-1">Maksimal Tiket Per Pesanan *</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        required
                        value={tt.maxPerOrder}
                        onChange={(e) => handleUpdateTicketType(idx, 'maxPerOrder', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white rounded-lg border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="cartoon-btn w-1/3 py-3 rounded-xl bg-white border-2 border-slate-900 text-slate-800 font-black text-xs hover:bg-slate-100 transition cursor-pointer shadow-[2px_2px_0px_0px_#0f172a]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || imageProcessing}
              className="cartoon-btn w-2/3 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-[3px_3px_0px_0px_#0f172a] transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan Event...</span>
                </div>
              ) : (
                <span>Publikasikan Event Sekarang</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
