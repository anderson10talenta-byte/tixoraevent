import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  DollarSign,
  QrCode,
  Download,
  PlusCircle,
  Search,
  UserPlus,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  FileSpreadsheet,
  Trash2,
  Check,
  X,
  Eye,
  ShieldCheck,
  AlertCircle,
  Clock,
  CreditCard,
} from 'lucide-react';
import { formatCurrencyIDR } from '../lib/capacity';
import { StatusBadge } from '../components/StatusBadge';
import type { Profile, Event } from '../lib/types';
import confetti from 'canvas-confetti';
import { inviteGateStaffByEmail, getStaffAssignmentsForEvent, deleteEventFromFirestore } from '../lib/firestoreService';
import { OrganizerKycView } from '../components/OrganizerKycView';
import type { OrganizerVerificationStatus, OrganizerApplication } from '../lib/types';

interface OrganizerDashboardPageProps {
  currentProfile: Profile | null;
  onNavigateNewEvent: () => void;
  onViewEventPublic: (event: Event) => void;
}

export const OrganizerDashboardPage: React.FC<OrganizerDashboardPageProps> = ({
  currentProfile,
  onNavigateNewEvent,
  onViewEventPublic,
}) => {
  const [activeTab, setActiveTab] = useState<'events' | 'registrants' | 'orders' | 'staff' | 'reports'>('events');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [registrants, setRegistrants] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [reports, setReports] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchRegistrant, setSearchRegistrant] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [staffAssignMessage, setStaffAssignMessage] = useState<string | null>(null);

  // Orders & Payment Verification state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectingOrderReason, setRejectingOrderReason] = useState<string>('');
  const [verifyActionLoading, setVerifyActionLoading] = useState(false);

  // KYC Verification state
  const [organizerStatus, setOrganizerStatus] = useState<OrganizerVerificationStatus>('not_applied');
  const [application, setApplication] = useState<OrganizerApplication | null>(null);
  const [checkingKyc, setCheckingKyc] = useState(true);

  // Delete event confirmation state
  const [deletingEvent, setDeletingEvent] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleConfirmDeleteEvent = async () => {
    if (!deletingEvent) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/events/${deletingEvent.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
      });
      await deleteEventFromFirestore(deletingEvent.id);
      if (res.ok) {
        setDeletingEvent(null);
        fetchOrganizerEvents();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menghapus event');
      }
    } catch (e) {
      console.error('Delete event error:', e);
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchOrganizerEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/organizer/events', {
        headers: {
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        if (data.length > 0 && !selectedEventId) {
          setSelectedEventId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load organizer events:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrants = async (eventId: string) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/registrants`, {
        headers: {
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRegistrants(data);
      }
    } catch (err) {
      console.error('Failed to load registrants:', err);
    }
  };

  const fetchStaff = async (eventId: string) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/staff`, {
        headers: {
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStaffList(data);
      }
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
  };

  const fetchReports = async (eventId: string) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/reports`, {
        headers: {
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  const fetchOrders = async (eventId?: string) => {
    setOrdersLoading(true);
    try {
      const url = eventId ? `/api/admin/orders?eventId=${eventId}` : '/api/admin/orders';
      const res = await fetch(url, {
        headers: {
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleVerifyOrderPayment = async (orderId: string, action: 'approve' | 'reject') => {
    setVerifyActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
        body: JSON.stringify({
          action,
          rejectionReason: action === 'reject' ? rejectingOrderReason : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (action === 'approve') {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        }
        setRejectingOrderId(null);
        setRejectingOrderReason('');
        fetchOrders(selectedEventId);
        fetchOrganizerEvents();
      } else {
        alert(data.error || 'Gagal memproses pembayaran');
      }
    } catch (err) {
      console.error('Verify payment error:', err);
      alert('Terjadi kesalahan saat memverifikasi pembayaran');
    } finally {
      setVerifyActionLoading(false);
    }
  };

  const checkKycStatus = async () => {
    if (!currentProfile) {
      setCheckingKyc(false);
      return;
    }
    if (
      currentProfile.isSuperAdmin ||
      currentProfile.email?.toLowerCase() === 'anderson10.talenta@gmail.com'
    ) {
      setOrganizerStatus('approved');
      setCheckingKyc(false);
      return;
    }

    try {
      const res = await fetch('/api/organizer/status', {
        headers: {
          'x-user-id': currentProfile.id || '',
          'x-user-email': currentProfile.email || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrganizerStatus(data.status || 'not_applied');
        setApplication(data.application || null);
      }
    } catch (err) {
      console.warn('KYC check error:', err);
    } finally {
      setCheckingKyc(false);
    }
  };

  useEffect(() => {
    checkKycStatus();
    fetchOrganizerEvents();
    fetchOrders();
  }, [currentProfile]);

  useEffect(() => {
    if (selectedEventId) {
      if (activeTab === 'registrants') fetchRegistrants(selectedEventId);
      if (activeTab === 'orders') fetchOrders(selectedEventId);
      if (activeTab === 'staff') fetchStaff(selectedEventId);
      if (activeTab === 'reports') fetchReports(selectedEventId);
    }
  }, [selectedEventId, activeTab]);

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !newStaffEmail.trim()) return;

    const email = newStaffEmail.trim().toLowerCase();
    const currentEvent = events.find((ev) => ev.id === selectedEventId);

    try {
      // 1. Register in backend server
      const res = await fetch(`/api/events/${selectedEventId}/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
        body: JSON.stringify({ email }),
      });

      // 2. Sync to Firebase Firestore safely
      try {
        await inviteGateStaffByEmail({
          eventId: selectedEventId,
          eventTitle: currentEvent?.title || 'Event Tixora',
          email,
          assignedByUserId: currentProfile?.id || 'organizer',
          assignedByEmail: currentProfile?.email || 'organizer@tixora.id',
        });
      } catch (fsErr) {
        console.warn('Firestore staff sync notice:', fsErr);
      }

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });

      setStaffAssignMessage(`✓ Akses Gerbang berhasil diberikan ke email: ${email}! Akun tersebut sekarang bisa login & scan tiket masuk.`);
      setNewStaffEmail('');
      fetchStaff(selectedEventId);
      setTimeout(() => setStaffAssignMessage(null), 5000);
    } catch (err: any) {
      console.warn('Assign staff fallback:', err);
      setStaffAssignMessage(`Akses Gerbang disimpan: ${email}`);
    }
  };

  const handleExportCSV = () => {
    if (!selectedEventId) return;
    window.location.href = `/api/events/${selectedEventId}/registrants?format=csv`;
  };

  // Aggregated metrics across organizer's events
  const totalEventsCount = events.length;
  const totalCapacityAll = events.reduce((s, e) => s + (e.totalCapacity || 0), 0);
  const totalSoldAll = events.reduce((s, e) => s + (e.totalSold || 0), 0);
  const totalCheckedInAll = events.reduce((s, e) => s + (e.totalCheckedIn || 0), 0);

  const filteredRegistrants = registrants.filter((r) => {
    const q = searchRegistrant.toLowerCase();
    return (
      !searchRegistrant.trim() ||
      r.fullName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.orderNumber.toLowerCase().includes(q)
    );
  });

  if (checkingKyc) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center bg-white rounded-3xl border border-slate-200">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs text-slate-500 font-semibold">Memeriksa status otorisasi penyelenggara...</p>
      </div>
    );
  }

  const isSuperAdmin =
    !!currentProfile?.isSuperAdmin ||
    currentProfile?.email?.toLowerCase() === 'anderson10.talenta@gmail.com';

  if (!isSuperAdmin && organizerStatus !== 'approved') {
    return (
      <OrganizerKycView
        currentProfile={currentProfile}
        status={organizerStatus}
        application={application}
        onApplicationSubmitted={checkKycStatus}
        onRefreshStatus={checkKycStatus}
      />
    );
  }

  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - new Date(currentProfile?.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header and Quick Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Portal Penyelenggara Acara (Organizer)
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Hari ke-{daysActive} Menggunakan Tixora</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard Manajemen Event
          </h1>
        </div>

        <button
          onClick={onNavigateNewEvent}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition self-start cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Buat Event Baru</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase">Total Event</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900">{totalEventsCount}</span>
          <span className="text-xs text-slate-500 block mt-0.5">Event terdaftar</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase">Tiket Terjual</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900">{totalSoldAll}</span>
          <span className="text-xs text-slate-500 block mt-0.5">Dari {totalCapacityAll} kapasitas</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase">Kehadiran (Check-In)</span>
            <QrCode className="w-4 h-4 text-violet-600" />
          </div>
          <span className="text-2xl font-extrabold text-violet-600">{totalCheckedInAll}</span>
          <span className="text-xs text-slate-500 block mt-0.5">Tamu telah masuk gerbang</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase">Tingkat Kehadiran</span>
            <CheckCircle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900">
            {totalSoldAll > 0 ? Math.round((totalCheckedInAll / totalSoldAll) * 100) : 0}%
          </span>
          <span className="text-xs text-slate-500 block mt-0.5">Rasio hadir vs tiket</span>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-slate-200 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'events'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Event Saya ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('registrants')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'registrants'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Registran & Tamu
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Verifikasi QRIS</span>
          {orders.filter((o) => o.status === 'awaiting_approval').length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500 text-white rounded-full animate-pulse">
              {orders.filter((o) => o.status === 'awaiting_approval').length} Baru
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'staff'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Petugas Gerbang (Staff)
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'reports'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Laporan & Analitik
        </button>
      </div>

      {/* Event Selector (for Registrants, Staff, and Reports tabs) */}
      {activeTab !== 'events' && events.length > 0 && (
        <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700">Filter Menurut Event:</span>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tab 1: Events List */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {events.length > 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Event</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Tanggal Acara</th>
                      <th className="px-6 py-4">Tiket Terjual</th>
                      <th className="px-6 py-4">Check-In</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((event) => {
                      const startDate = new Date(event.startsAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });
                      return (
                        <tr key={event.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={event.coverImageUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=150&q=80'}
                                alt=""
                                className="w-12 h-12 rounded-xl object-cover shrink-0"
                              />
                              <div>
                                <span className="font-bold text-slate-900 block">{event.title}</span>
                                <span className="text-xs text-slate-400">{event.venueName}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={event.status} size="sm" />
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-700">{startDate}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900">{event.totalSold}</span>
                            <span className="text-slate-400 text-xs"> / {event.totalCapacity}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-violet-600">{event.totalCheckedIn}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onViewEventPublic(event)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
                              >
                                <span>Lihat</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setDeletingEvent(event)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 transition cursor-pointer"
                                title="Hapus Event"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
              <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-800">Belum Ada Event</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Mulai publikasikan festival musik, seminar, atau workshop Anda sekarang.
              </p>
              <button
                onClick={onNavigateNewEvent}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                Buat Event Pertama
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Registrants & Attendee Roster */}
      {activeTab === 'registrants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari nama, email, nomor pesanan..."
                value={searchRegistrant}
                onChange={(e) => setSearchRegistrant(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor ke CSV</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Nama Tamu</th>
                    <th className="px-6 py-3.5">Kontak</th>
                    <th className="px-6 py-3.5">No. Pesanan</th>
                    <th className="px-6 py-3.5">Kategori Tiket</th>
                    <th className="px-6 py-3.5">Status Check-In</th>
                    <th className="px-6 py-3.5">Waktu Daftar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRegistrants.length > 0 ? (
                    filteredRegistrants.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-3.5 font-bold text-slate-900">{reg.fullName}</td>
                        <td className="px-6 py-3.5">
                          <div>{reg.email}</div>
                          <div className="text-[11px] text-slate-400">{reg.phone}</div>
                        </td>
                        <td className="px-6 py-3.5 font-mono font-semibold text-slate-700">{reg.orderNumber}</td>
                        <td className="px-6 py-3.5 font-medium text-slate-800">{reg.ticketTypes}</td>
                        <td className="px-6 py-3.5">
                          {reg.checkedInCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px]">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Checked-In ({reg.checkedInCount})
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">Belum Hadir</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-slate-400">
                          {new Date(reg.createdAt).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                        Tidak ada data registran yang sesuai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Orders & QRIS Payment Verification */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>Persetujuan Pembayaran QRIS Masuk</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verifikasi screenshot bukti transfer sebelum tiket digital dan barcode QR resmi diterbitkan ke pengunjung.
              </p>
            </div>
            <button
              onClick={() => fetchOrders(selectedEventId)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                <CreditCard className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-slate-900">Belum Ada Transaksi Pemesanan</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Pemesanan tiket berbayar dengan metode QRIS akan muncul di sini untuk diperiksa bukti transfernya.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => {
                const isPending = o.status === 'awaiting_approval';
                const isConfirmed = o.status === 'confirmed';
                const isRejected = o.status === 'rejected';

                return (
                  <div
                    key={o.id}
                    className={`p-5 bg-white rounded-2xl border transition shadow-xs space-y-4 ${
                      isPending
                        ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {o.orderNumber}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">•</span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                            {o.ticketTypeName} × {o.quantity}
                          </span>
                          {isPending && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Menunggu Verifikasi Bukti</span>
                            </span>
                          )}
                          {isConfirmed && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Lunas & Tiket Terbit
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              ✕ Ditolak
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 block mt-1">
                          Pembeli: <span className="text-slate-800 font-semibold">{o.buyerName}</span> ({o.buyerEmail} • {o.buyerPhone}) • Diajukan: {new Date(o.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={verifyActionLoading}
                            onClick={() => handleVerifyOrderPayment(o.id, 'approve')}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            <span>Setujui Pembayaran</span>
                          </button>
                          <button
                            disabled={verifyActionLoading}
                            onClick={() => setRejectingOrderId(o.id)}
                            className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Order Details & Proof Thumbnail */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Nominal</span>
                        <span className="text-lg font-bold text-indigo-600">{formatCurrencyIDR(o.totalMinor || 0)}</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Metode: {o.paymentMethod || 'QRIS GoPay'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Identitas Pengirim Transfer</span>
                        <span className="font-semibold text-slate-800">{o.senderName || o.buyerName || '-'}</span>
                        <span className="text-slate-500 block text-[11px]">Bank/App: {o.senderBank || 'QRIS'}</span>
                        {o.paymentNotes && (
                          <span className="text-slate-500 italic block text-[11px] mt-0.5">"{o.paymentNotes}"</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Bukti Screenshot Pembayaran</span>
                        {o.paymentProofUrl ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={o.paymentProofUrl}
                              alt="Bukti Transfer"
                              onClick={() => setPreviewProofUrl(o.paymentProofUrl)}
                              className="w-14 h-14 object-cover rounded-xl border border-slate-300 cursor-pointer hover:opacity-80 transition shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewProofUrl(o.paymentProofUrl)}
                              className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat Bukti Foto</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Belum mengunggah bukti transfer</span>
                        )}
                      </div>
                    </div>

                    {isRejected && o.rejectionReason && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                        Alasan Penolakan: {o.rejectionReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Staff Assignment */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <h3>Tugaskan Petugas Gerbang</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Petugas yang ditugaskan dapat membuka scanner kamera dan memvalidasi tiket masuk tanpa memiliki akses ke laporan finansial.
            </p>

            <form onSubmit={handleAssignStaff} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Petugas</label>
                <input
                  type="email"
                  required
                  placeholder="staff@kinarya.id"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {staffAssignMessage && (
                <p className="text-xs text-indigo-600 font-medium">{staffAssignMessage}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Tugaskan Staff
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Daftar Petugas Aktif untuk Event Ini</h3>

            {staffList.length > 0 ? (
              <div className="space-y-3">
                {staffList.map((st) => (
                  <div
                    key={st.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block text-sm">{st.fullName}</span>
                      <span className="text-slate-500">{st.email}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      Otorisasi Aktif
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                Belum ada staf tambahan yang ditugaskan untuk event ini.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Reports & Analytics */}
      {activeTab === 'reports' && reports && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Total Pendapatan Tiket</span>
              <span className="text-2xl font-extrabold text-slate-900">
                {formatCurrencyIDR(reports.totalRevenueMinor)}
              </span>
              <span className="text-xs text-slate-500 block mt-1">Gross ticket revenue</span>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Kehadiran Tamu</span>
              <span className="text-2xl font-extrabold text-violet-600">
                {reports.totalCheckedIn} / {reports.totalIssued}
              </span>
              <span className="text-xs text-slate-500 block mt-1">{reports.remainingExpected} tamu belum hadir</span>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Tingkat Check-In</span>
              <span className="text-2xl font-extrabold text-emerald-600">{reports.checkInRate}%</span>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${reports.checkInRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Rincian Per Kategori Tiket</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Harga</th>
                    <th className="px-4 py-3">Terjual</th>
                    <th className="px-4 py-3">Checked-In</th>
                    <th className="px-4 py-3">Kapasitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.breakdownByTicketType.map((tt: any) => (
                    <tr key={tt.id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{tt.name}</td>
                      <td className="px-4 py-3">{tt.priceMinor === 0 ? 'Gratis' : formatCurrencyIDR(tt.priceMinor)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{tt.sold}</td>
                      <td className="px-4 py-3 font-bold text-violet-600">{tt.checkedIn}</td>
                      <td className="px-4 py-3 text-slate-500">{tt.capacity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full my-auto space-y-4 shadow-xl border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Hapus Event?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus event <span className="font-bold text-rose-600">"{deletingEvent.title}"</span>? Data tiket dan penugasan staff akan dihapus.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={deleteLoading}
                onClick={handleConfirmDeleteEvent}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                {deleteLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Ya, Hapus Event</span>
              </button>
              <button
                disabled={deleteLoading}
                onClick={() => setDeletingEvent(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PREVIEW MODAL FOR PAYMENT PROOF */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full my-auto p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Bukti Screenshot Transfer Pembeli</h3>
              </div>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center bg-slate-900/5 rounded-2xl p-2 min-h-[300px]">
              <img
                src={previewProofUrl}
                alt="Screenshot Bukti Pembayaran"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl shadow-md border border-slate-200"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT ORDER REASON MODAL */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 flex min-h-full items-start sm:items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full my-auto space-y-4 shadow-2xl animate-in zoom-in-95 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Tolak Pembayaran Pesanan?</h3>
              <p className="text-xs text-slate-500">
                Tiket tidak akan diterbitkan dan pemesanan akan ditandai ditolak.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Alasan Penolakan (akan dilihat pembeli):
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Nominal transfer kurang, screenshot terpotong, atau dana belum masuk rekening..."
                value={rejectingOrderReason}
                onChange={(e) => setRejectingOrderReason(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                disabled={verifyActionLoading}
                onClick={() => handleVerifyOrderPayment(rejectingOrderId, 'reject')}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                {verifyActionLoading ? 'Memproses...' : 'Tolak Pembayaran'}
              </button>
              <button
                disabled={verifyActionLoading}
                onClick={() => {
                  setRejectingOrderId(null);
                  setRejectingOrderReason('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
