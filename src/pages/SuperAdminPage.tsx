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
  Tag,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrencyIDR } from '../lib/capacity';
import type { Profile, OrganizerApplication, EventCategory } from '../lib/types';
import { SUPER_ADMIN_EMAIL } from '../lib/firebase';
import { deleteEventFromFirestore, deleteOrganizationFromFirestore } from '../lib/firestoreService';
import { AVAILABLE_CATEGORY_ICONS, getCategoryIcon } from '../lib/categoryIcons';
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
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [creditScores, setCreditScores] = useState<any[]>([]);
  const [selectedUserLogs, setSelectedUserLogs] = useState<{ user: any; logs: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payments' | 'categories' | 'credit_scores' | 'kyc' | 'events' | 'orgs' | 'logs'>('payments');
  const [previewKtpUrl, setPreviewKtpUrl] = useState<string | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectingOrderReason, setRejectingOrderReason] = useState('');

  // Category Creation Form State
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Tag');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

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
      const [orgsRes, logsRes, kycRes, eventsRes, ordersRes, catRes, scoresRes] = await Promise.all([
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
        fetch('/api/admin/orders', {
          headers: getAdminHeaders(),
        }),
        fetch('/api/categories'),
        fetch('/api/admin/credit-scores', {
          headers: getAdminHeaders(),
        }),
      ]);

      if (orgsRes.ok) setOrganizations(await orgsRes.json());
      if (logsRes.ok) setAuditLogs(await logsRes.json());
      if (kycRes.ok) setApplications(await kycRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (scoresRes && scoresRes.ok) setCreditScores(await scoresRes.json());
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetScore = async (userId: string, userName: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/credit-scores/${userId}/reset`, {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        showToast(`Skor kredit ${userName} berhasil dipulihkan ke 10/10!`);
        window.dispatchEvent(new CustomEvent('tixora-score-updated'));
        fetchAdminData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Gagal memulihkan skor kredit', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan saat memulihkan skor kredit', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      showToast('Nama kategori wajib diisi', 'error');
      return;
    }
    setSavingCategory(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: getAdminHeaders(true),
        body: JSON.stringify({
          name: newCatName.trim(),
          iconName: newCatIcon,
          description: newCatDesc.trim(),
        }),
      });

      if (res.ok) {
        showToast('Kategori baru berhasil ditambahkan!');
        setNewCatName('');
        setNewCatDesc('');
        setNewCatIcon('Tag');
        setShowAddCatModal(false);
        fetchAdminData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Gagal menambahkan kategori', 'error');
      }
    } catch (err) {
      console.error('Create category error:', err);
      showToast('Terjadi kesalahan saat menambahkan kategori', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });

      if (res.ok) {
        showToast(`Kategori "${catName}" berhasil dihapus`);
        fetchAdminData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Gagal menghapus kategori', 'error');
      }
    } catch (err) {
      console.error('Delete category error:', err);
      showToast('Terjadi kesalahan saat menghapus kategori', 'error');
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

  const handleVerifyPayment = async (orderId: string, action: 'approve' | 'reject') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/verify-payment`, {
        method: 'POST',
        headers: getAdminHeaders(true),
        body: JSON.stringify({
          action,
          rejectionReason: action === 'reject' ? rejectingOrderReason : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (action === 'approve') {
          confetti({ particleCount: 85, spread: 70, origin: { y: 0.6 } });
          showToast(data.message || 'Pembayaran berhasil disetujui & tiket resmi telah terbit!');
        } else {
          showToast(data.message || 'Pembayaran telah ditolak.', 'error');
        }
        setRejectingOrderId(null);
        setRejectingOrderReason('');
        fetchAdminData();
      } else {
        showToast(data.error || 'Gagal memproses pembayaran', 'error');
      }
    } catch (err) {
      console.error('Verify payment error:', err);
      showToast('Terjadi kesalahan saat memverifikasi pembayaran', 'error');
    } finally {
      setActionLoading(false);
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
  const pendingOrdersCount = orders.filter((o) => o.status === 'awaiting_approval').length;

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
            Panel Pengawasan & Manajemen Platform
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1">
            Selamat datang, <span className="text-indigo-600 font-black">{currentProfile?.fullName || 'Super Admin'}</span> ({currentProfile?.email}). Kelola izin organizer, verifikasi transfer QRIS, tambah kategori event, hapus event bermasalah, dan pantau seluruh transaksi.
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
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="cartoon-card p-4 bg-white">
          <span className="text-[11px] font-black uppercase text-slate-400 block mb-1">Verifikasi QRIS</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{orders.length}</span>
            {pendingOrdersCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                {pendingOrdersCount} Baru
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-500 block mt-1">Bukti transfer</span>
        </div>

        <div className="cartoon-card p-4 bg-white">
          <span className="text-[11px] font-black uppercase text-slate-400 block mb-1">Pengajuan KYC</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{applications.length}</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-500 block mt-1">KTP & Rekening</span>
        </div>

        <div className="cartoon-card p-4 bg-white">
          <span className="text-[11px] font-black uppercase text-slate-400 block mb-1">Total Event</span>
          <span className="text-xl font-black text-indigo-600">{events.length}</span>
          <span className="text-[10px] font-bold text-slate-500 block mt-1">Event terdaftar</span>
        </div>

        <div className="cartoon-card p-4 bg-white">
          <span className="text-[11px] font-black uppercase text-slate-400 block mb-1">Kategori</span>
          <span className="text-xl font-black text-amber-600">{categories.length}</span>
          <span className="text-[10px] font-bold text-slate-500 block mt-1">Kategori aktif</span>
        </div>

        <div className="cartoon-card p-4 bg-white">
          <span className="text-[11px] font-black uppercase text-slate-400 block mb-1">Organisasi</span>
          <span className="text-xl font-black text-emerald-600">{organizations.length}</span>
          <span className="text-[10px] font-bold text-slate-500 block mt-1">Penyelenggara</span>
        </div>

        <div className="cartoon-card p-4 bg-white">
          <span className="text-[11px] font-black uppercase text-slate-400 block mb-1">Audit Log</span>
          <span className="text-xl font-black text-slate-900">{auditLogs.length}</span>
          <span className="text-[10px] font-bold text-slate-500 block mt-1">Aktivitas</span>
        </div>
      </div>

      {/* Tabs Navigation (Responsive horizontal scroll on mobile, zero clipping) */}
      <div className="flex items-center gap-2 overflow-x-auto py-2.5 -mx-4 px-4 sm:mx-0 sm:px-1 sm:flex-wrap border-b-2 border-slate-900">
        <button
          onClick={() => setActiveTab('payments')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === 'payments'
              ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]'
              : 'bg-white text-slate-700 shadow-none'
          }`}
        >
          <CreditCard className="w-4 h-4 text-indigo-700" />
          <span>Verifikasi QRIS ({orders.length})</span>
          {pendingOrdersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {pendingOrdersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]'
              : 'bg-white text-slate-700 shadow-none'
          }`}
        >
          <Tag className="w-4 h-4 text-amber-600" />
          <span>Kelola Kategori ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('credit_scores')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === 'credit_scores'
              ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]'
              : 'bg-white text-slate-700 shadow-none'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Skor Kredit Pengguna ({creditScores.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('kyc')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
            activeTab === 'kyc'
              ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]'
              : 'bg-white text-slate-700 shadow-none'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Persetujuan KYC ({applications.length})</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
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
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
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
          className={`cartoon-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
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
      ) : activeTab === 'payments' ? (
        /* QRIS Payments Verification Section */
        <div className="space-y-4">
          <div className="bg-amber-50 p-4 rounded-2xl border-2 border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-yellow-300 rounded-lg border border-slate-900">
                <CreditCard className="w-4 h-4 text-slate-900" />
              </span>
              <span>
                Pemeriksaan Bukti Transfer QRIS GoPay Merchant (SOLVERSTUDIO.ID). Setelah disetujui, tiket ber-QR Code unik akan langsung aktif untuk pembeli.
              </span>
            </div>
            <div className="flex items-center gap-2 text-indigo-700">
              <span className="font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                {pendingOrdersCount} Pesanan Menunggu Persetujuan
              </span>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="cartoon-card p-12 text-center bg-white space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-slate-900 text-indigo-700 flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_#0f172a]">
                <CreditCard className="w-7 h-7" />
              </div>
              <p className="text-base font-black text-slate-900">Belum Ada Transaksi Masuk</p>
              <p className="text-xs text-slate-500 font-bold max-w-sm mx-auto">
                Pesanan tiket berbayar yang menggunakan QRIS akan muncul di sini beserta bukti screenshot transfer untuk diverifikasi admin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {orders.map((o) => {
                const isPending = o.status === 'awaiting_approval';
                const isConfirmed = o.status === 'confirmed';
                const isRejected = o.status === 'rejected';

                return (
                  <div key={o.id} className="cartoon-card p-5 bg-white space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono font-black text-base text-slate-900">{o.orderNumber}</span>
                          <span className="font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200 text-xs">
                            {o.eventTitle || 'Event'}
                          </span>
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {o.ticketTypeName} ({o.quantity}x)
                          </span>
                          {isPending && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Menunggu Persetujuan</span>
                            </span>
                          )}
                          {isConfirmed && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Lunas & Tiket Terbit</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <X className="w-3.5 h-3.5" />
                              <span>Ditolak</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-500 block mt-1">
                          Pembeli: <span className="text-slate-800 font-black">{o.buyerName}</span> ({o.buyerEmail} • {o.buyerPhone}) • Diajukan: {new Date(o.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={actionLoading}
                            onClick={() => handleVerifyPayment(o.id, 'approve')}
                            className="cartoon-btn px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-4 h-4 text-emerald-950" />
                            <span>Setujui Pembayaran</span>
                          </button>
                          <button
                            disabled={actionLoading}
                            onClick={() => setRejectingOrderId(o.id)}
                            className="cartoon-btn px-4 py-2 rounded-xl bg-rose-400 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Order Details & Proof Thumbnail */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-amber-50/70 rounded-2xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-black text-slate-400 block">Total Nominal</span>
                        <span className="text-lg font-black text-indigo-700">{formatCurrencyIDR(o.totalMinor || 0)}</span>
                        <span className="text-[11px] font-bold text-slate-600 block mt-0.5">
                          Metode: {o.paymentMethod || 'QRIS GoPay'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-black text-slate-400 block">Identitas Pengirim Transfer</span>
                        <span className="font-bold text-slate-900">{o.senderName || o.buyerName || '-'}</span>
                        <span className="text-slate-600 block text-[11px]">Bank/App: {o.senderBank || 'QRIS'}</span>
                        {o.paymentNotes && (
                          <span className="text-slate-500 italic block text-[11px] mt-0.5">"{o.paymentNotes}"</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Bukti Screenshot Pembayaran</span>
                        {o.paymentProofUrl ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={o.paymentProofUrl}
                              alt="Bukti Transfer"
                              onClick={() => setPreviewProofUrl(o.paymentProofUrl)}
                              className="w-14 h-14 object-cover rounded-xl border-2 border-slate-900 cursor-pointer hover:opacity-80 transition shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewProofUrl(o.paymentProofUrl)}
                              className="text-xs font-black text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat Bukti Foto</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic font-medium">Belum mengunggah bukti transfer</span>
                        )}
                      </div>
                    </div>

                    {isRejected && o.rejectionReason && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                        Alasan Penolakan: {o.rejectionReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'categories' ? (
        /* TAB: CATEGORIES MANAGEMENT */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Kelola Kategori Event</h2>
              <p className="text-xs text-slate-600 font-medium">
                Kategori ini dapat dipilih oleh penyelenggara saat membuat event dan digunakan untuk filter katalog.
              </p>
            </div>
            <button
              onClick={() => setShowAddCatModal(true)}
              className="cartoon-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-300 hover:bg-yellow-400 text-slate-900 text-xs font-black cursor-pointer shadow-[2px_2px_0px_0px_#0f172a]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kategori Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const IconComp = getCategoryIcon(cat.iconName);
              return (
                <div key={cat.id} className="cartoon-card p-4 bg-white flex flex-col justify-between space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-slate-900 flex items-center justify-center text-indigo-700 shadow-[2px_2px_0px_0px_#0f172a]">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-sm">{cat.name}</h3>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {cat.id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-slate-600 font-medium line-clamp-2">{cat.description}</p>
                  )}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold">
                    <span>Icon: {cat.iconName || 'Tag'}</span>
                    <span className="text-emerald-700 font-black">Aktif</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'credit_scores' ? (
        /* TAB: CREDIT SCORES MANAGEMENT (Super Admin User Reputation Oversight) */
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="bg-amber-50 p-4 sm:p-5 rounded-2xl border-2 border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-slate-800">
            <div className="flex items-start sm:items-center gap-2.5">
              <span className="p-2 bg-yellow-300 rounded-xl border border-slate-900 shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-tight">Pengawasan Skor Kredit Pengguna</h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Setiap akun memiliki reputasi awal 10/10 poin. Pengurangan poin terjadi otomatis saat pembatalan tiket mendadak atau ketidakhadiran (no-show) saat acara selesai.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-indigo-700 shrink-0 self-start sm:self-auto">
              <span className="font-mono font-black text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-xs">
                {creditScores.filter((u) => (u.creditScore ?? 10) < 10).length} Akun Terkena Penalti
              </span>
            </div>
          </div>

          {/* Rules Summary Pill Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
            <div className="p-3 bg-white rounded-xl border-2 border-slate-200">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Skor Sempurna</span>
              <span className="text-base font-black text-emerald-600 block mt-0.5">10 / 10 Poin</span>
              <span className="text-[10px] text-slate-500 font-medium">Reputasi Sangat Baik</span>
            </div>
            <div className="p-3 bg-white rounded-xl border-2 border-slate-200">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Batal H-5</span>
              <span className="text-base font-black text-amber-600 block mt-0.5">-1 Poin</span>
              <span className="text-[10px] text-slate-500 font-medium">Batal 3-5 hari sblm acara</span>
            </div>
            <div className="p-3 bg-white rounded-xl border-2 border-slate-200">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Batal H-3</span>
              <span className="text-base font-black text-rose-600 block mt-0.5">-2 Poin</span>
              <span className="text-[10px] text-slate-500 font-medium">Batal 1-3 hari sblm acara</span>
            </div>
            <div className="p-3 bg-white rounded-xl border-2 border-slate-200">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Batal H-1 & No-Show</span>
              <span className="text-base font-black text-rose-700 block mt-0.5">-3 Poin</span>
              <span className="text-[10px] text-slate-500 font-medium">Batal &lt;24 jam / tak hadir</span>
            </div>
          </div>

          {creditScores.length === 0 ? (
            <div className="cartoon-card p-12 text-center bg-white space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-slate-900 text-indigo-700 flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_#0f172a]">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <p className="text-base font-black text-slate-900">Belum Ada Data Pengguna</p>
              <p className="text-xs text-slate-500 font-bold max-w-sm mx-auto">
                Daftar profil pengguna beserta skor kredit mereka akan muncul di sini.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Cards (No horizontal overflow or clipping) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {creditScores.map((u) => {
                  const score = u.creditScore ?? 10;
                  const hasPenalties = score < 10;
                  const repBadge =
                    score >= 8
                      ? { bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', text: 'Reputasi Sangat Baik' }
                      : score >= 5
                      ? { bg: 'bg-amber-100 text-amber-900 border-amber-300', text: 'Reputasi Waspada' }
                      : { bg: 'bg-rose-100 text-rose-900 border-rose-300', text: 'Reputasi Kritis' };

                  return (
                    <div key={u.id} className="cartoon-card p-4 bg-white space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-slate-900 text-sm truncate">{u.fullName || 'Pengguna Tixora'}</div>
                          <div className="text-xs text-slate-500 font-medium truncate">{u.email}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-base text-indigo-700">{score}</span>
                          <span className="font-mono text-xs font-bold text-slate-500">/10</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${repBadge.bg}`}>
                          {repBadge.text}
                        </span>
                        <span className="text-[11px] text-slate-600 font-bold">
                          {u.ticketsCount || 0} Tiket • {u.logsCount || 0} Penalti
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedUserLogs({ user: u, logs: u.logs || [] })}
                          className="cartoon-btn flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Lihat Log ({u.logsCount || 0})</span>
                        </button>
                        {hasPenalties && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleResetScore(u.id, u.fullName || u.email)}
                            className="cartoon-btn py-1.5 px-3 bg-emerald-400 hover:bg-emerald-500 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-[2px_2px_0px_0px_#0f172a]"
                            title="Pulihkan skor kembali ke 10"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pulihkan</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Full Table with Overflow Protection */}
              <div className="hidden md:block cartoon-card bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 font-medium">
                    <thead className="bg-yellow-100 text-slate-900 uppercase text-[10px] font-black border-b-2 border-slate-900">
                      <tr>
                        <th className="px-5 py-4">Pengguna</th>
                        <th className="px-5 py-4">Skor Kredit</th>
                        <th className="px-5 py-4">Reputasi Akun</th>
                        <th className="px-5 py-4">Total Tiket</th>
                        <th className="px-5 py-4">Pelanggaran</th>
                        <th className="px-5 py-4 text-right">Tindakan Super Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {creditScores.map((u) => {
                        const score = u.creditScore ?? 10;
                        const hasPenalties = score < 10;
                        return (
                          <tr key={u.id} className="hover:bg-amber-50/60 transition">
                            <td className="px-5 py-4">
                              <div className="font-black text-slate-900 text-sm">{u.fullName || 'Pengguna Tixora'}</div>
                              <div className="text-xs text-slate-500 font-medium">{u.email}</div>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {u.id}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-black text-indigo-700">{score}</span>
                                <span className="text-xs font-bold text-slate-500">/ 10</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black border ${
                                  score >= 8
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : score >= 5
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-rose-100 text-rose-900 border-rose-300'
                                }`}
                              >
                                {score >= 8 ? 'Reputasi Sangat Baik' : score >= 5 ? 'Reputasi Waspada' : 'Reputasi Kritis'}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-bold text-slate-900">
                              {u.ticketsCount || 0} Tiket
                            </td>
                            <td className="px-5 py-4">
                              <span className={`font-black ${u.logsCount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                {u.logsCount || 0} Catatan
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserLogs({ user: u, logs: u.logs || [] })}
                                  className="cartoon-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                                  title="Lihat rincian riwayat perubahan skor"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Lihat Log ({u.logsCount || 0})</span>
                                </button>
                                {hasPenalties ? (
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleResetScore(u.id, u.fullName || u.email)}
                                    className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-500 text-slate-950 text-xs font-black cursor-pointer shadow-[2px_2px_0px_0px_#0f172a]"
                                    title="Pulihkan skor kembali ke 10"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Pulihkan ke 10</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-emerald-700 font-bold px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                                    Skor Maksimal
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : activeTab === 'kyc' ? (
        /* KYC Application Approval Section */
        <div className="space-y-4">
          {applications.length === 0 ? (
            <div className="cartoon-card p-12 text-center bg-white space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-slate-900 text-indigo-700 flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_#0f172a]">
                <FileText className="w-7 h-7" />
              </div>
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
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-indigo-700" />
                        <span>Hari ke-{calculateDaysActive(app.submittedAt || app.createdAt)}</span>
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
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-slate-900 text-indigo-700 flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_#0f172a]">
                <Calendar className="w-7 h-7" />
              </div>
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
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-slate-900 text-emerald-700 flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_#0f172a]">
                <Building2 className="w-7 h-7" />
              </div>
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
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-indigo-700" />
                              <span>Hari ke-{calculateDaysActive(org.createdAt)} Aktif</span>
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="cartoon-card bg-white p-6 sm:p-8 max-w-md w-full my-auto space-y-4 shadow-[8px_8px_0px_0px_#0f172a] animate-in zoom-in-95">
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="cartoon-card bg-white p-6 sm:p-8 max-w-md w-full my-auto space-y-4 shadow-[8px_8px_0px_0px_#0f172a] animate-in zoom-in-95">
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full my-auto space-y-4 relative">
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
      {/* Proof Screenshot Modal Preview */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full my-auto space-y-4 relative border-3 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]">
            <button
              onClick={() => setPreviewProofUrl(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-black text-slate-900 text-base">Bukti Screenshot Pembayaran QRIS</h3>
            <div className="rounded-2xl overflow-hidden border-2 border-slate-300 max-h-[70vh] bg-slate-100 flex items-center justify-center">
              <img src={previewProofUrl} alt="Bukti Transfer Penuh" className="max-h-[68vh] w-auto object-contain" />
            </div>
            <div className="text-right">
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="cartoon-btn px-5 py-2 bg-slate-900 text-white text-xs font-black rounded-xl cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Order Reason Modal */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="cartoon-card bg-white p-6 max-w-md w-full my-auto space-y-4 shadow-[8px_8px_0px_0px_#0f172a]">
            <h3 className="text-lg font-black text-slate-900">Tolak Pembayaran Tiket</h3>
            <p className="text-xs text-slate-600 font-bold">
              Masukkan alasan penolakan bukti pembayaran. Pembeli akan melihat catatan ini di halaman tiket mereka.
            </p>
            <textarea
              required
              rows={3}
              placeholder="Contoh: Nominal transfer kurang dari total tagihan, atau screenshot tidak terbaca."
              value={rejectingOrderReason}
              onChange={(e) => setRejectingOrderReason(e.target.value)}
              className="w-full p-3 text-xs font-bold rounded-xl border-2 border-slate-300 focus:border-rose-600 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                disabled={actionLoading}
                onClick={() => handleVerifyPayment(rejectingOrderId, 'reject')}
                className="cartoon-btn flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl cursor-pointer"
              >
                Tolak Sekarang
              </button>
              <button
                onClick={() => {
                  setRejectingOrderId(null);
                  setRejectingOrderReason('');
                }}
                className="cartoon-btn px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Kategori Baru */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="cartoon-card bg-white p-6 sm:p-8 max-w-lg w-full my-auto space-y-5 shadow-[8px_8px_0px_0px_#0f172a] animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 border-2 border-slate-900 flex items-center justify-center text-amber-700">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Tambah Kategori Event Baru</h3>
              </div>
              <button
                onClick={() => setShowAddCatModal(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-900 mb-1">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Seminar Karir, Standup Comedy, Workshop AI"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-900 mb-1.5">
                  Pilih Icon (Lucide Icon - Bebas Emoji)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 border-2 border-slate-200 rounded-xl bg-slate-50">
                  {Object.entries(AVAILABLE_CATEGORY_ICONS).map(([iconKey, { label, icon: IconItem }]) => {
                    const isSelected = newCatIcon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setNewCatIcon(iconKey)}
                        className={`p-2 rounded-xl flex flex-col items-center gap-1 border-2 text-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-yellow-300 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        <IconItem className="w-4 h-4" />
                        <span className="text-[10px] font-bold truncate max-w-full">{iconKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-900 mb-1">
                  Deskripsi Singkat (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat tentang lingkup event kategori ini"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="cartoon-btn flex-1 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-slate-900 text-xs font-black rounded-xl cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingCategory ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Simpan Kategori</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="cartoon-btn px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected User Credit Score Logs Modal */}
      {selectedUserLogs && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUserLogs(null);
          }}
        >
          <div className="relative w-full max-w-lg my-auto bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-3 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] sm:shadow-[6px_6px_0px_0px_#0f172a] flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b-2 border-slate-900 shrink-0">
              <div className="min-w-0">
                <h3 className="font-black text-sm sm:text-base text-white truncate">
                  Riwayat Skor Kredit: {selectedUserLogs.user.fullName || 'Pengguna'}
                </h3>
                <p className="text-xs text-slate-300 font-medium truncate">{selectedUserLogs.user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserLogs(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Score Overview */}
            <div className="p-4 bg-amber-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Skor Saat Ini</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-indigo-700">{selectedUserLogs.user.creditScore ?? 10}</span>
                  <span className="text-xs font-bold text-slate-600">/ 10 Poin</span>
                </div>
              </div>

              {(selectedUserLogs.user.creditScore ?? 10) < 10 && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={async () => {
                    await handleResetScore(selectedUserLogs.user.id, selectedUserLogs.user.fullName || selectedUserLogs.user.email);
                    setSelectedUserLogs(null);
                  }}
                  className="cartoon-btn px-3 py-1.5 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_#0f172a]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pulihkan ke 10</span>
                </button>
              )}
            </div>

            {/* Logs List */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              {selectedUserLogs.logs.length === 0 ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-xs text-emerald-800 font-bold">
                  Belum ada catatan penalti skor kredit untuk pengguna ini. Reputasi akun masih bersih (10/10).
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedUserLogs.logs.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-xs break-words">{log.reason}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-rose-600 text-sm whitespace-nowrap block">
                          {log.change > 0 ? `+${log.change}` : log.change}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-mono whitespace-nowrap">
                          Sisa: {log.currentScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedUserLogs(null)}
                className="cartoon-btn px-4 py-2 bg-yellow-300 hover:bg-yellow-400 text-slate-900 font-black text-xs rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
