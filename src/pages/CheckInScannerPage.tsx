import React, { useState, useEffect } from 'react';
import { CameraQRScanner } from '../components/CameraQRScanner';
import { StatusBadge } from '../components/StatusBadge';
import { QrCode, CheckCircle2, AlertTriangle, XCircle, Users, RefreshCw, History, ShieldAlert } from 'lucide-react';
import type { Profile, Event } from '../lib/types';
import { checkGateStaffPermission } from '../lib/firestoreService';
import { SUPER_ADMIN_EMAIL } from '../lib/firebase';

interface CheckInScannerPageProps {
  currentProfile: Profile | null;
}

export const CheckInScannerPage: React.FC<CheckInScannerPageProps> = ({ currentProfile }) => {
  const resultRef = React.useRef<HTMLDivElement | null>(null);
  const [assignedEvents, setAssignedEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCheckInResult, setLastCheckInResult] = useState<any | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<{ totalIssued: number; totalCheckedIn: number } | null>(null);

  // Fetch events where current user is assigned staff or organizer/admin
  const fetchAssignedEvents = async () => {
    setLoadingEvents(true);
    try {
      const isSuper =
        !!currentProfile?.isSuperAdmin ||
        currentProfile?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      // If Super Admin, fetch all events directly so they can inspect any gate
      if (isSuper) {
        const allRes = await fetch('/api/events');
        if (allRes.ok) {
          const allEvts: Event[] = await allRes.json();
          setAssignedEvents(allEvts);
          if (allEvts.length > 0) {
            setSelectedEventId((prev) => (prev && allEvts.some((e) => e.id === prev) ? prev : allEvts[0].id));
          }
          setLoadingEvents(false);
          return;
        }
      }

      // Check staff permission from Firestore
      let perm = { isAuthorized: false, isSuperAdmin: false, assignedEvents: [] as string[] };
      try {
        perm = await checkGateStaffPermission(currentProfile?.email, currentProfile?.id);
      } catch (e) {
        console.warn('Firestore permission check error:', e);
      }

      const res = await fetch('/api/check-in/staff-events', {
        headers: {
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
      });

      let events: Event[] = [];
      if (res.ok) {
        events = await res.json();
      }

      // If user has Firestore assigned events, merge them
      if (events.length === 0 && perm.assignedEvents.length > 0) {
        const allRes = await fetch('/api/events');
        if (allRes.ok) {
          const allEvts: Event[] = await allRes.json();
          events = allEvts.filter((e) => perm.assignedEvents.includes(e.id));
        }
      }

      // If still empty and user is organizer or has events, try organizer events
      if (events.length === 0) {
        const orgRes = await fetch('/api/organizer/events', {
          headers: {
            'x-user-id': currentProfile?.id || '',
            'x-user-email': currentProfile?.email || '',
            'x-user-name': currentProfile?.fullName || '',
          },
        });
        if (orgRes.ok) {
          const orgEvts = await orgRes.json();
          if (Array.isArray(orgEvts) && orgEvts.length > 0) {
            events = orgEvts;
          }
        }
      }

      setAssignedEvents(events);
      if (events.length > 0) {
        setSelectedEventId((prev) => (prev && events.some((e) => e.id === prev) ? prev : events[0].id));
      }
    } catch (err) {
      console.error('Failed to fetch assigned events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Fetch recent check-in logs and stats for the selected event
  const fetchLogsAndStats = async (eventId: string) => {
    if (!eventId) return;
    try {
      const [logsRes, reportsRes] = await Promise.all([
        fetch(`/api/events/${eventId}/check-ins`, {
          headers: {
            'x-user-id': currentProfile?.id || '',
            'x-user-email': currentProfile?.email || '',
            'x-user-name': currentProfile?.fullName || '',
          },
        }),
        fetch(`/api/events/${eventId}/reports`, {
          headers: {
            'x-user-id': currentProfile?.id || '',
            'x-user-email': currentProfile?.email || '',
            'x-user-name': currentProfile?.fullName || '',
          },
        }),
      ]);

      if (logsRes.ok) {
        const logs = await logsRes.json();
        setRecentLogs(logs);
      }

      if (reportsRes.ok) {
        const report = await reportsRes.json();
        setStats({
          totalIssued: report.totalIssued,
          totalCheckedIn: report.totalCheckedIn,
        });
      }
    } catch (err) {
      console.error('Error fetching logs/stats:', err);
    }
  };

  useEffect(() => {
    fetchAssignedEvents();
  }, [currentProfile]);

  useEffect(() => {
    if (selectedEventId) {
      fetchLogsAndStats(selectedEventId);
    }
  }, [selectedEventId]);

  // Handle Scan Callback from Camera or Manual Input
  const handleScan = async (token: string, forcedEventId?: string) => {
    const targetId = forcedEventId || selectedEventId || (assignedEvents.length > 0 ? assignedEvents[0].id : '');
    if (forcedEventId && forcedEventId !== selectedEventId) {
      setSelectedEventId(forcedEventId);
    }
    if (!targetId || isProcessing) {
      if (!targetId) {
        setLastCheckInResult({
          result: 'invalid',
          allowed: false,
          message: `Scanner berhasil membaca QR: "${token.slice(0, 35)}". Buat atau pilih event terlebih dahulu untuk mencocokkan tiket ke database.`,
        });
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
      return;
    }
    setIsProcessing(true);

    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentProfile?.id || '',
          'x-user-email': currentProfile?.email || '',
          'x-user-name': currentProfile?.fullName || '',
        },
        body: JSON.stringify({
          eventId: targetId,
          token,
          scannerMetadata: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLastCheckInResult({
          result: 'invalid',
          allowed: false,
          message: data.error || 'Validasi tiket gagal',
        });
        return;
      }

      setLastCheckInResult(data);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);

      // Refresh stats and activity log
      await fetchLogsAndStats(targetId);
    } catch (err: any) {
      setLastCheckInResult({
        result: 'invalid',
        allowed: false,
        message: 'Koneksi ke server terputus saat memvalidasi tiket.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedEvent = assignedEvents.find((e) => e.id === selectedEventId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header and Event Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-bold mb-1.5 border border-violet-200">
            <QrCode className="w-3.5 h-3.5" />
            <span>Pintu Gerbang Masuk (Gate Access)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Scanner Validasi Tiket
          </h1>
        </div>

        {/* Event dropdown selector */}
        {assignedEvents.length > 0 && (
          <div className="sm:max-w-xs w-full">
            <label className="text-xs font-semibold text-slate-500 block mb-1">Pilih Event yang Ditugaskan</label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setLastCheckInResult(null);
              }}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
            >
              {assignedEvents.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loadingEvents ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500 font-medium">Memverifikasi penugasan staff...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {assignedEvents.length === 0 && (
            <div className="cartoon-card p-4 bg-amber-50 border-2.5 border-slate-900 rounded-2xl flex items-center gap-3 shadow-[3px_3px_0px_0px_#0f172a]">
              <div className="w-10 h-10 rounded-xl bg-yellow-300 border-2 border-slate-900 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-slate-900" />
              </div>
              <div className="text-xs">
                <span className="font-black text-slate-900 block">Mode Uji Scanner Kamera</span>
                <span className="text-slate-600 font-bold">
                  Belum ada event terdaftar. Anda dapat langsung menguji scanner kamera di bawah ini untuk memastikan kamera dan pemindaian barcode QR berfungsi normal.
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Camera Scanner & Live Validation Cards */}
            <div className="lg:col-span-7 space-y-6">
            {/* Live Stats Pill */}
            {stats && (
              <div className="grid grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-center">
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block">Total Tiket</span>
                  <span className="text-xl font-extrabold text-slate-900">{stats.totalIssued}</span>
                </div>
                <div className="border-x border-slate-100">
                  <span className="text-[11px] uppercase font-bold text-emerald-600 block">Checked-In</span>
                  <span className="text-xl font-extrabold text-emerald-600">{stats.totalCheckedIn}</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block">Sisa Tamu</span>
                  <span className="text-xl font-extrabold text-slate-700">
                    {Math.max(0, stats.totalIssued - stats.totalCheckedIn)}
                  </span>
                </div>
              </div>
            )}

            {/* Real-Time Camera Scanner Component */}
            <CameraQRScanner onScan={handleScan} isProcessing={isProcessing} />
          </div>

          {/* Right Column: Scan Result Card & Real-Time Log */}
          <div className="lg:col-span-5 space-y-6">
            {/* Prominent Scan Result Feedback */}
            {lastCheckInResult && (
              <div
                ref={resultRef}
                className={`p-6 rounded-3xl border-2 transition-all shadow-lg animate-in fade-in duration-300 ${
                  lastCheckInResult.result === 'success'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                    : lastCheckInResult.result === 'already_used'
                    ? 'bg-amber-50 border-amber-400 text-amber-950'
                    : 'bg-rose-50 border-rose-400 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-4">
                  {lastCheckInResult.result === 'success' ? (
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 shrink-0" />
                  ) : lastCheckInResult.result === 'already_used' ? (
                    <AlertTriangle className="w-10 h-10 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="w-10 h-10 text-rose-600 shrink-0" />
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-lg">
                        {lastCheckInResult.result === 'success' && 'VERIFIKASI BERHASIL'}
                        {lastCheckInResult.result === 'already_used' && 'TIKET SUDAH DIPAKAI'}
                        {lastCheckInResult.result === 'wrong_event' && 'EVENT SALAH'}
                        {lastCheckInResult.result === 'invalid' && 'TIKET TIDAK VALID'}
                        {lastCheckInResult.result === 'unauthorized' && 'AKSES DITOLAK'}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed opacity-90">{lastCheckInResult.message}</p>

                    {lastCheckInResult.fullName && (
                      <div className="mt-4 pt-3 border-t border-black/10 text-xs space-y-1">
                        <div>
                          <span className="opacity-70 block text-[10px] uppercase font-bold">Nama Tamu</span>
                          <span className="font-extrabold text-sm">{lastCheckInResult.fullName}</span>
                        </div>
                        {lastCheckInResult.ticketTypeName && (
                          <div>
                            <span className="opacity-70 block text-[10px] uppercase font-bold">Kategori Tiket</span>
                            <span className="font-semibold">{lastCheckInResult.ticketTypeName}</span>
                          </div>
                        )}
                        {lastCheckInResult.ticketNumber && (
                          <div>
                            <span className="opacity-70 block text-[10px] uppercase font-bold">Nomor Tiket</span>
                            <span className="font-mono font-semibold">{lastCheckInResult.ticketNumber}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Live Check-In Activity Log */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Aktivitas Pintu Masuk</h3>
                </div>
                <button
                  onClick={() => selectedEventId && fetchLogsAndStats(selectedEventId)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                  title="Segarkan Log"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentLogs.length > 0 ? (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {recentLogs.map((log) => {
                    const timeStr = new Date(log.scannedAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={log.result} size="sm" />
                            <span className="font-mono font-bold text-slate-700">{log.ticketNumber}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Oleh: {log.staffName}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">{timeStr}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">
                  Belum ada aktivitas pemindaian untuk event ini.
                </p>
              )}
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
