import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Calendar,
  FileText,
  Ban,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Lock,
  Sparkles,
  Users,
  Ticket,
  Clock,
  Check,
  X,
  CreditCard,
  Eye,
  ExternalLink,
  Trash2,
  DollarSign,
  MapPin,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import type { Profile, OrganizerApplication } from '../lib/types';
import { SUPER_ADMIN_EMAIL } from '../lib/firebase';
import { deleteEventFromFirestore, deleteOrganizationFromFirestore } from '../lib/firestoreService';
import confetti from 'canvas-confetti';

interface SuperAdminPageProps {
  currentProfile: Profile | null;
  onViewEventPublic?: (event: any) => void;
}

export const SuperAdminPage: React.FC<SuperAdminPageProps> = ({ currentProfile, onViewEventPublic }) => {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [applications, setApplications] = useState<OrganizerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kyc' | 'events' | 'orgs' | 'logs'>('kyc');
  const [previewKtpUrl, setPreviewKtpUrl] = useState<string | null>(null);
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Delete Confirmation Modals
  const [deletingEvent, setDeletingEvent] = useState<{ id: string; title: string; organizationName?: string } | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<{ id: string; name: string; eventCount?: number } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isSuperAdmin =
    !!currentProfile?.isSuperAdmin ||
    currentProfile?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 4500);
  };

  const getAdminHeaders = (isJson = false) => {
    const headers: Record<string, string> = {
      'x-user-id': currentProfile?.id || 'super-admin-anderson',
      'x-user-email': currentProfile?.email || SUPER_ADMIN_EMAIL,
      'x-user-name': currentProfile?.fullName || 'Anderson (Super Admin)',
    };
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [orgsRes, logsRes, kycRes, eventsRes] = await Promise.all([
        fetch('/api/admin/organizations', {
          headers: getAdminHeaders(),
        }),
        fetch('/api/admin/audit-logs', {
          headers: getAdminHeaders(),
        }),
        fetch('/api/admin/organizer-applications', {
          headers: getAdminHeaders(),
        }),
        fetch('/api/admin/events', {
          headers: getAdminHeaders(),
        }),
      ]);

      if (orgsRes.ok) setOrganizations(await orgsRes.json());
      if (logsRes.ok) setAuditLogs(await logsRes.json());
      if (kycRes.ok) setApplications(await kycRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdminData();
    }
  }, [currentProfile, isSuperAdmin]);

  const handleReviewApplication = async (appId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/admin/organizer-applications/${appId}/review`, {
        method: 'POST',
        headers: getAdminHeaders(true),
        body: JSON.stringify({
          action,
          rejectionReason: action === 'reject' ? rejectionReason : undefined,
        }),
      });

      if (res.ok) {
        if (action === 'approve') {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
          showToast('Permohonan organizer berhasil disetujui!');
        } else {
          showToast('Permohonan organizer telah ditolak.');
        }
        setRejectingAppId(null);
        setRejectionReason('');
        fetchAdminData();
      }
    } catch (err) {
      console.error('Review error:', err);
      showToast('Gagal memproses permohonan', 'error');
    }
  };

  const handleToggleOrgStatus = async (orgId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/status`, {
        method: 'POST',
        headers: getAdminHeaders(true),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Status organisasi berhasil diubah ke: ${newStatus === 'active' ? 'Aktif' : 'Ditangguhkan'}`);
        fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to update org status:', err);
      showToast('Gagal mengubah status organisasi', 'error');
    }
  };

  // --- DELETE EVENT (Super Admin) ---
  const handleConfirmDeleteEvent = async () => {
    if (!deletingEvent) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/${deletingEvent.id}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });

      // Synchronize with Firestore
      await deleteEventFromFirestore(deletingEvent.id);

      if (res.ok) {
        showToast(`Event "${deletingEvent.title}" berhasil dihapus permanen!`);
        setDeletingEvent(null);
        fetchAdminData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Gagal menghapus event', 'error');
      }
    } catch (err) {
      console.error('Delete event error:', err);
      showToast('Terjadi kesalahan saat menghapus event', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // --- DELETE ORGANIZATION (Super Admin) ---
  const handleConfirmDeleteOrg = async () => {
    if (!deletingOrg) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${deletingOrg.id}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });

      // Synchronize with Firestore
      await deleteOrganizationFromFirestore(deletingOrg.id);

      if (res.ok) {
        showToast(`Organisasi "${deletingOrg.name}" beserta event terkait berhasil dihapus!`);
        setDeletingOrg(null);
        fetchAdminData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Gagal menghapus organisasi', 'error');
      }
    } catch (err) {
      console.error('Delete organization error:', err);
      showToast('Terjadi kesalahan saat menghapus organisasi', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const calculateDaysActive = (dateString?: string) => {
    if (!dateString) return 1;
    const diffMs = Date.now() - new Date(dateString).getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
  };

  // Restrict access if not Super Admin
  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="cartoon-card bg-rose-50 p-8 sm:p-12 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-400 border-2.5 border-slate-900 text-white flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_#0f172a]">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Akses Terbatas: Hanya Super Admin
          </h2>
          <p className="text-sm font-bold text-slate-700 leading-relaxed max-w-md mx-auto">
            Halaman ini dikhususkan untuk administrator platform utama. Akun yang memiliki otoritas penuh:
          </p>
          <div className="inline-block px-4 py-2 bg-yellow-300 rounded-xl border-2 border-slate-900 text-slate-900 font-mono font-black text-xs shadow-[2px_2px_0px_0px_#0f172a]">
            {SUPER_ADMIN_EMAIL}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Silakan login menggunakan akun dengan email tersebut untuk membuka panel verifikasi dan pengawasan platform.
          </p>
        </div>
      </div>
    );
  }

  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`fixed top-24 right-4 z-50 px-5 py-3.5 rounded-2xl border-2.5 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] font-black text-xs flex items-center gap-2.5 animate-in slide-in-from-top-3 ${
            feedbackToast.type === 'success' ? 'bg-yellow-300 text-slate-900' : 'bg-rose-500 text-white'
          }`}
        >
          {feedbackToast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-700" /> : <AlertTriangle className="w-4 h-4 text-white" />}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="cartoon-card bg-amber-100 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-300 text-slate-900 text-xs font-black mb-2 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]">
            <ShieldCheck className="w-4 h-4 text-rose-600" />
            <span>Otoritas Super Admin Platform</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Panel Pengawasan & Manajemen Platform 🛡️
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1">
            Selamat datang, <span className="text-indigo-600 font-black">{currentProfile?.fullName || 'Super Admin'}</span> ({currentProfile?.email}). Kelola izin organizer, hapus event/organisasi bermasalah, dan pantau seluruh transaksi.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="cartoon-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-black shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="cartoon-card p-5 bg-white">
          <span className="text-xs font-black uppercase text-slate-400 block mb-1">Pengajuan KYC</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{applications.length}</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold text-slate-500 block mt-1">Verifikasi KTP & Bank</span>
        </div>

        <div className="cartoon-card p-5 bg-white">
          <span className="text-xs font-black uppercase text-slate-400 block mb-1">Total Event</span>
          <span className="text-2xl font-black text-indigo-600">{events.length}</span>
          <span className="text-[11px] font-bold text-slate-500 block mt-1">Event terdaftar di sistem</span>
        </div>

        <div className="cartoon-card p-5 bg-white">
          <span className="text-xs font-black uppercase text-slate-400 block mb-1">Organisasi</span>
          <span className="text-2xl font-black text-emerald-600">{organizations.length}</span>
          <span className="text-[11px] font-bold text-slate-500 block mt-1">Penyelenggara aktif</span>
        </div>

        <div className="cartoon-card p-5 bg-white">
          <span className="text-xs font-black uppercase text-slate-400 block mb-1">Audit Log</span>
          <span className="text-2xl font-black text-slate-900">{auditLogs.length}</span>
          <span className="text-[11px] font-bold text-slate-500 block mt-1">Aktivitas terdata</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b-2 border-slate-900 pb-2">
        <button
          onClick={() => setActiveTab('kyc')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'kyc'
              ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]'
              : 'bg-white text-slate-700 shadow-none'
          }`}
        >
          <span>Persetujuan KYC ({applications.length})</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'events'
              ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]'
              : 'bg-white text-slate-700 shadow-none'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Kelola Semua Event ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orgs')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'orgs'
              ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]'
              : 'bg-white text-slate-700 shadow-none'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>Organisasi Terdaftar ({organizations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]'
              : 'bg-white text-slate-700 shadow-none'
          }`}
        >
          <FileText className="w-4 h-4 text-slate-600" />
          <span>Audit Log ({auditLogs.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="cartoon-card p-12 text-center bg-white">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-700 font-bold">Memuat data pengawasan...</p>
        </div>
      ) : activeTab === 'kyc' ? (
        /* KYC Application Approval Section */
        <div className="space-y-4">
          {applications.length === 0 ? (
            <div className="cartoon-card p-12 text-center bg-white space-y-2">
              <span className="text-4xl block">📋</span>
              <p className="text-base font-black text-slate-900">Belum Ada Pengajuan Organizer</p>
              <p className="text-xs text-slate-500 font-bold max-w-sm mx-auto">
                Pengguna yang mengajukan akun penyelenggara dan mengunggah KTP akan muncul di daftar verifikasi ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {applications.map((app) => (
                <div key={app.id} className="cartoon-card p-5 bg-white space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-black text-base text-slate-900">{app.organizationName}</span>
                        <StatusBadge status={app.status} size="sm" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 block mt-0.5">
                        Pemohon: <span className="text-slate-800">{app.applicantName}</span> ({app.applicantEmail}) • Diajukan: {new Date(app.submittedAt || app.createdAt || Date.now()).toLocaleDateString('id-ID')}
                      </span>
                    </div>

                    {app.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReviewApplication(app.id, 'approve')}
                          className="cartoon-btn px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4 text-emerald-950" />
                          <span>Setujui (Approve)</span>
                        </button>
                        <button
                          onClick={() => setRejectingAppId(app.id)}
                          className="cartoon-btn px-4 py-2 rounded-xl bg-rose-400 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Tolak</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Document & Bank Info Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-amber-50/70 rounded-2xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">NIK & Dokumen KTP</span>
                      <span className="font-mono font-bold text-slate-900">{app.nikKtp || app.ktpNumber || '-'}</span>
                      {(app.ktpImageUrl || app.ktpPhotoUrl) && (
                        <button
                          onClick={() => setPreviewKtpUrl(app.ktpImageUrl || app.ktpPhotoUrl || null)}
                          className="mt-1 text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat Foto KTP</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Rekening Penarikan Dana</span>
                      <span className="font-bold text-slate-900">{app.bankName} - {app.bankAccountNumber}</span>
                      <span className="text-slate-600 block text-[11px]">a.n. {app.bankAccountHolder}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 block">Lama Penggunaan Akun</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block mt-0.5">
                        🗓️ Hari ke-{calculateDaysActive(app.submittedAt || app.createdAt)}
                      </span>
                    </div>
                  </div>

                  {rejectingAppId === app.id && (
                    <div className="p-4 bg-rose-50 rounded-2xl border-2 border-rose-300 space-y-3">
                      <label className="block text-xs font-bold text-rose-900">
                        Alasan Penolakan untuk Pemohon:
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Foto KTP buram atau rekening tidak cocok."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-rose-300 bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReviewApplication(app.id, 'reject')}
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer"
                        >
                          Konfirmasi Tolak
                        </button>
                        <button
                          onClick={() => setRejectingAppId(null)}
                          className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'events' ? (
        /* TAB 2: MANAGE ALL EVENTS (Super Admin Event Deletion) */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Seluruh Event di Platform Tixora</h2>
              <p className="text-xs text-slate-600 font-medium">
                Sebagai Super Admin, Anda memiliki hak penuh untuk meninjau dan menghapus event yang melanggar aturan atau event uji coba.
              </p>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-yellow-300 rounded-full border border-slate-900 shadow-[1.5px_1.5px_0px_#0f172a]">
              Total: {events.length} Event
            </span>
          </div>

          {events.length === 0 ? (
            <div className="cartoon-card p-12 text-center bg-white space-y-2">
              <span className="text-4xl block">🎪</span>
              <p className="text-base font-black text-slate-900">Belum Ada Event Terdaftar</p>
              <p className="text-xs text-slate-500 font-bold max-w-sm mx-auto">
                Belum ada event yang dibuat di platform. Event yang dibuat oleh organizer akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="cartoon-card bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 font-medium">
                  <thead className="bg-yellow-100 text-slate-900 uppercase text-[10px] font-black border-b-2 border-slate-900">
                    <tr>
                      <th className="px-5 py-4">Event</th>
                      <th className="px-5 py-4">Organisasi / Pembuat</th>
                      <th className="px-5 py-4">Jadwal & Lokasi</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Tiket & Omzet</th>
                      <th className="px-5 py-4 text-right">Tindakan Super Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {events.map((evt) => (
                      <tr key={evt.id} className="hover:bg-amber-50/60 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={evt.coverImageUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=150&q=80'}
                              alt=""
                              className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div>
                              <div className="font-black text-slate-900 text-sm">{evt.title}</div>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {evt.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-slate-900 block">{evt.organizationName}</span>
                          <span className="text-[11px] text-slate-500 block">Oleh: {evt.creatorName}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-slate-800 font-bold">
                            {new Date(evt.startsAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate max-w-xs">{evt.venueName}</span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={evt.status} size="sm" />
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-black text-slate-900 block">{evt.ticketsCount || 0} Tiket</span>
                          <span className="text-[11px] font-bold text-emerald-700">
                            Rp {(evt.revenue || 0).toLocaleString('id-ID')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {onViewEventPublic && (
                              <button
                                onClick={() => onViewEventPublic(evt)}
                                className="cartoon-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                                title="Lihat Pratinjau Event"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                                <span>Lihat</span>
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingEvent({ id: evt.id, title: evt.title, organizationName: evt.organizationName })}
                              className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black cursor-pointer shadow-[2px_2px_0px_0px_#0f172a]"
                              title="Hapus Event Ini Secara Permanen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'orgs' ? (
        /* TAB 3: ORGANIZATIONS TABLE WITH DELETE OPTION */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Daftar Organisasi Penyelenggara</h2>
              <p className="text-xs text-slate-600 font-medium">
                Kelola status keaktifan atau hapus organisasi beserta seluruh event yang berada di bawah naungannya.
              </p>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-yellow-300 rounded-full border border-slate-900 shadow-[1.5px_1.5px_0px_#0f172a]">
              Total: {organizations.length} Organisasi
            </span>
          </div>

          {organizations.length === 0 ? (
            <div className="cartoon-card p-12 text-center bg-white space-y-2">
              <span className="text-4xl block">🏢</span>
              <p className="text-base font-black text-slate-900">Belum Ada Organisasi Terdaftar</p>
              <p className="text-xs text-slate-500 font-bold max-w-sm mx-auto">
                Organisasi yang disetujui melalui pengajuan KYC akan otomatis masuk ke daftar ini.
              </p>
            </div>
          ) : (
            <div className="cartoon-card bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 font-medium">
                  <thead className="bg-yellow-100 text-slate-900 uppercase text-[10px] font-black border-b-2 border-slate-900">
                    <tr>
                      <th className="px-6 py-4">Nama Organisasi</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Kontak Email</th>
                      <th className="px-6 py-4">Pemilik (Owner)</th>
                      <th className="px-6 py-4">Jumlah Event</th>
                      <th className="px-6 py-4 text-right">Tindakan Super Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {organizations.map((org) => (
                      <tr key={org.id} className="hover:bg-amber-50/60 transition">
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-900 text-sm">{org.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500 font-mono">slug: {org.slug}</span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              🗓️ Hari ke-{calculateDaysActive(org.createdAt)} Aktif
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={org.status} size="sm" />
                        </td>
                        <td className="px-6 py-4 font-mono font-bold">{org.contactEmail}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">{org.ownerName || '-'}</td>
                        <td className="px-6 py-4 font-black text-indigo-700">{org.eventCount} Event</td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {org.status === 'active' ? (
                              <button
                                onClick={() => handleToggleOrgStatus(org.id, org.status)}
                                className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-slate-900 text-xs font-black cursor-pointer"
                                title="Tangguhkan Akses Organisasi"
                              >
                                <Ban className="w-3.5 h-3.5 text-rose-600" />
                                <span>Tangguhkan</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleOrgStatus(org.id, org.status)}
                                className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-300 hover:bg-emerald-400 text-emerald-950 text-xs font-black cursor-pointer"
                                title="Aktifkan Kembali Organisasi"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Aktifkan</span>
                              </button>
                            )}

                            {/* Delete Organization Button */}
                            <button
                              onClick={() => setDeletingOrg({ id: org.id, name: org.name, eventCount: org.eventCount })}
                              className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black cursor-pointer shadow-[2px_2px_0px_0px_#0f172a]"
                              title="Hapus Organisasi & Seluruh Event Terkait"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TAB 4: AUDIT LOGS TABLE */
        <div className="cartoon-card bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 font-medium">
              <thead className="bg-yellow-100 text-slate-900 uppercase text-[10px] font-black border-b-2 border-slate-900">
                <tr>
                  <th className="px-6 py-4">Aksi / Event</th>
                  <th className="px-6 py-4">Tipe Target</th>
                  <th className="px-6 py-4">ID Target</th>
                  <th className="px-6 py-4">Waktu Kejadian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-amber-50/60 transition">
                    <td className="px-6 py-3 font-bold text-indigo-700">{log.action}</td>
                    <td className="px-6 py-3 text-slate-800 font-bold">{log.targetType}</td>
                    <td className="px-6 py-3 text-slate-500 truncate max-w-xs">{log.targetId}</td>
                    <td className="px-6 py-3 text-slate-600 font-bold">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE EVENT */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="cartoon-card bg-white p-6 sm:p-8 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#0f172a] animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 border-2.5 border-slate-900 text-rose-600 flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_#0f172a]">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900">Hapus Event Permanen?</h3>
              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                Anda akan menghapus event <span className="text-rose-600 font-black">"{deletingEvent.title}"</span>. Seluruh kategori tiket, kuota, penugasan petugas check-in, dan data terkait event ini akan dihapus permanen dari server dan Firestore!
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={actionLoading}
                onClick={handleConfirmDeleteEvent}
                className="cartoon-btn flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-[2px_2px_0px_0px_#0f172a] cursor-pointer flex items-center justify-center gap-2"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Ya, Hapus Event</span>
              </button>
              <button
                disabled={actionLoading}
                onClick={() => setDeletingEvent(null)}
                className="cartoon-btn px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE ORGANIZATION */}
      {deletingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="cartoon-card bg-white p-6 sm:p-8 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#0f172a] animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 border-2.5 border-slate-900 text-rose-600 flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_#0f172a]">
              <Building2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900">Hapus Organisasi Permanen?</h3>
              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                Anda akan menghapus organisasi <span className="text-rose-600 font-black">"{deletingOrg.name}"</span>. Seluruh data organisasi serta <span className="font-black text-slate-900">{deletingOrg.eventCount || 0} event</span> di bawah organisasi ini akan otomatis terhapus dari sistem!
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={actionLoading}
                onClick={handleConfirmDeleteOrg}
                className="cartoon-btn flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-[2px_2px_0px_0px_#0f172a] cursor-pointer flex items-center justify-center gap-2"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Ya, Hapus Organisasi</span>
              </button>
              <button
                disabled={actionLoading}
                onClick={() => setDeletingOrg(null)}
                className="cartoon-btn px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KTP Modal Preview */}
      {previewKtpUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 relative">
            <button
              onClick={() => setPreviewKtpUrl(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-black text-slate-900 text-base">Dokumen KTP Pemohon</h3>
            <div className="rounded-2xl overflow-hidden border border-slate-200 aspect-16/10 bg-slate-100">
              <img src={previewKtpUrl} alt="KTP Full" className="w-full h-full object-contain" />
            </div>
            <div className="text-right">
              <button
                onClick={() => setPreviewKtpUrl(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
