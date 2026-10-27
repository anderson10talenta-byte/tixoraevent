import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNavbar } from './components/BottomNavbar';
import { SplashScreen } from './components/SplashScreen';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './pages/HomePage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { CheckInScannerPage } from './pages/CheckInScannerPage';
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage';
import { CreateEventPage } from './pages/CreateEventPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import type { Profile, Event, TicketType } from './lib/types';
import { auth, syncUserProfile, logoutUser, SUPER_ADMIN_EMAIL } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getEventsFromFirestore, checkGateStaffPermission } from './lib/firestoreService';
import { Shield, Ticket, Sparkles, Heart } from 'lucide-react';

interface EventWithDetails extends Event {
  organizationName?: string;
  lowestPriceMinor?: number;
  ticketTypes?: TicketType[];
}

export default function App() {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [activeRoute, setActiveRoute] = useState<string>('home');
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);
  const [checkoutParams, setCheckoutParams] = useState<{
    eventId: string;
    ticketTypeId: string;
    quantity: number;
  } | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [hasStaffAccess, setHasStaffAccess] = useState(false);

  // Initialize data and listen to real Firebase Auth
  useEffect(() => {
    // 1. Listen to real Firebase authentication changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await syncUserProfile(fbUser);
        setCurrentProfile(profile);
        checkStaffStatus(profile.email, profile.id);
      } else {
        // Check saved session in localStorage as fallback
        const savedEmail = localStorage.getItem('tixora_user_email');
        const savedId = localStorage.getItem('tixora_user_id');
        const savedName = localStorage.getItem('tixora_user_name');
        const savedCreatedAt = localStorage.getItem('tixora_user_created_at') || '2026-10-01T09:00:00.000Z';

        if (savedEmail && savedId) {
          const isSuper = savedEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
          const fallbackProfile: Profile = {
            id: savedId,
            fullName: isSuper
              ? 'Anderson (Super Admin)'
              : savedName || savedEmail.split('@')[0],
            email: savedEmail,
            phone: '+6281234567890',
            avatarUrl:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            isSuperAdmin: isSuper,
            creditScore: 10,
            createdAt: savedCreatedAt,
            organizerStatus: isSuper ? 'approved' : 'not_applied',
          };
          setCurrentProfile(fallbackProfile);
          checkStaffStatus(savedEmail, savedId);
        } else {
          // Initialize active session with platform owner / Super Admin
          const defaultAdmin: Profile = {
            id: 'super-admin-anderson',
            fullName: 'Anderson (Super Admin)',
            email: 'anderson10.talenta@gmail.com',
            phone: '+6281234567890',
            avatarUrl:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            isSuperAdmin: true,
            creditScore: 10,
            createdAt: '2026-10-01T00:00:00.000Z',
            organizerStatus: 'approved',
          };
          localStorage.setItem('tixora_user_email', defaultAdmin.email);
          localStorage.setItem('tixora_user_id', defaultAdmin.id);
          localStorage.setItem('tixora_user_name', defaultAdmin.fullName);
          setCurrentProfile(defaultAdmin);
          checkStaffStatus(defaultAdmin.email, defaultAdmin.id);
        }
      }
    });

    // 2. Load events: fast instant API load + Firestore sync without wiping data
    const loadEvents = async () => {
      try {
        let serverEvents: EventWithDetails[] = [];
        try {
          const res = await fetch('/api/events');
          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const apiEvts = await res.json();
              if (Array.isArray(apiEvts)) {
                serverEvents = apiEvts;
              }
            }
          }
        } catch (apiErr) {
          console.warn('API fetch /api/events error:', apiErr);
        }

        let firestoreEvents: any[] = [];
        try {
          firestoreEvents = await getEventsFromFirestore();
        } catch (fsErr) {
          console.warn('Firestore getEvents error:', fsErr);
        }

        // Merge both data sources by ID so no created events or updates disappear
        const eventMap = new Map<string, any>();
        if (Array.isArray(firestoreEvents)) {
          for (const evt of firestoreEvents) {
            if (evt && evt.id) eventMap.set(evt.id, evt);
          }
        }
        if (Array.isArray(serverEvents)) {
          for (const evt of serverEvents) {
            if (evt && evt.id) eventMap.set(evt.id, evt);
          }
        }
        setEvents(Array.from(eventMap.values()));
      } catch (err) {
        console.error('Failed to load events:', err);
      }
    };
    loadEvents();

    return () => unsubscribeAuth();
  }, []);

  const checkStaffStatus = async (email?: string, uid?: string) => {
    if (!email) {
      setHasStaffAccess(false);
      return;
    }
    const perm = await checkGateStaffPermission(email, uid);
    setHasStaffAccess(perm.isAuthorized || perm.isSuperAdmin);
  };

  const handleLoginSuccess = (profile: Profile) => {
    setCurrentProfile(profile);
    checkStaffStatus(profile.email, profile.id);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.warn('Firebase signout error:', e);
    }
    localStorage.removeItem('tixora_user_email');
    localStorage.removeItem('tixora_user_id');
    setCurrentProfile(null);
    setHasStaffAccess(false);
    setActiveRoute('home');
  };

  const handleNavigate = (route: string) => {
    // Guard Super Admin route
    if (route === 'admin' && !currentProfile?.isSuperAdmin) {
      setAuthModalOpen(true);
      return;
    }
    setActiveRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectEvent = (event: EventWithDetails) => {
    setSelectedEvent(event);
    setActiveRoute('event-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToCheckout = (eventId: string, ticketTypeId: string, quantity: number) => {
    setCheckoutParams({ eventId, ticketTypeId, quantity });
    setActiveRoute('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckoutSuccess = (orderId: string) => {
    setActiveRoute('my-tickets');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setActiveRoute('ticket-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEventCreated = async (eventId: string) => {
    try {
      let serverEvents: EventWithDetails[] = [];
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const apiEvts = await res.json();
            if (Array.isArray(apiEvts)) {
              serverEvents = apiEvts;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to refresh events from API:', e);
      }

      let firestoreEvents: any[] = [];
      try {
        firestoreEvents = await getEventsFromFirestore();
      } catch (e) {
        console.warn('Failed to refresh events from Firestore:', e);
      }

      const eventMap = new Map<string, any>();
      if (Array.isArray(firestoreEvents)) {
        for (const evt of firestoreEvents) {
          if (evt && evt.id) eventMap.set(evt.id, evt);
        }
      }
      if (Array.isArray(serverEvents)) {
        for (const evt of serverEvents) {
          if (evt && evt.id) eventMap.set(evt.id, evt);
        }
      }
      setEvents(Array.from(eventMap.values()));
    } catch (err) {
      console.warn('Event refresh err:', err);
    }
    setActiveRoute('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/40 text-slate-900 font-sans selection:bg-yellow-300 selection:text-slate-900">
      {/* Mobile App Opening Splash Screen */}
      <SplashScreen />

      {/* 1. Desktop & Mobile Top Header (No role switcher bar!) */}
      <Navbar
        currentProfile={currentProfile}
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        onLogin={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* 2. Main Content View Router with bottom padding for mobile navbar */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 md:pb-12">
        {activeRoute === 'home' && (
          <HomePage
            events={events}
            onSelectEvent={handleSelectEvent}
            onExploreAll={() => handleNavigate('events')}
          />
        )}

        {activeRoute === 'events' && (
          <EventsPage
            events={events}
            onSelectEvent={handleSelectEvent}
          />
        )}

        {activeRoute === 'event-detail' && selectedEvent && (
          <EventDetailPage
            event={selectedEvent}
            onBack={() => handleNavigate('events')}
            onProceedToCheckout={handleProceedToCheckout}
          />
        )}

        {activeRoute === 'checkout' && checkoutParams && selectedEvent && (
          <CheckoutPage
            event={selectedEvent}
            ticketType={
              selectedEvent.ticketTypes?.find((tt) => tt.id === checkoutParams.ticketTypeId) ||
              selectedEvent.ticketTypes![0]
            }
            quantity={checkoutParams.quantity}
            currentProfile={currentProfile}
            onBack={() => setActiveRoute('event-detail')}
            onSuccess={handleCheckoutSuccess}
          />
        )}

        {activeRoute === 'my-tickets' && (
          <MyTicketsPage
            currentProfile={currentProfile}
            onSelectTicket={handleSelectTicket}
            onExploreEvents={() => handleNavigate('events')}
          />
        )}

        {activeRoute === 'ticket-detail' && selectedTicketId && (
          <TicketDetailPage
            ticketId={selectedTicketId}
            currentProfile={currentProfile}
            onBack={() => setActiveRoute('my-tickets')}
          />
        )}

        {activeRoute === 'check-in' && (
          <CheckInScannerPage currentProfile={currentProfile} />
        )}

        {activeRoute === 'dashboard' && (
          <OrganizerDashboardPage
            currentProfile={currentProfile}
            onNavigateNewEvent={() => handleNavigate('dashboard/new-event')}
            onViewEventPublic={handleSelectEvent}
          />
        )}

        {activeRoute === 'dashboard/new-event' && (
          <CreateEventPage
            currentProfile={currentProfile}
            onBack={() => handleNavigate('dashboard')}
            onEventCreated={handleEventCreated}
          />
        )}

        {activeRoute === 'admin' && (
          <SuperAdminPage
            currentProfile={currentProfile}
            onViewEventPublic={handleSelectEvent}
          />
        )}
      </main>

      {/* 3. Mobile Bottom Navigation Bar (Docked to bottom on mobile, hidden on desktop) */}
      <BottomNavbar
        currentProfile={currentProfile}
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        hasStaffAccess={hasStaffAccess}
      />

      {/* 4. Cartoon Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* 5. Cartoon Footer */}
      <footer className="bg-white border-t-2.5 border-slate-900 mt-auto py-8 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-yellow-300 border-2 border-slate-900 flex items-center justify-center text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]">
              <Ticket className="w-4 h-4 -rotate-12" />
            </div>
            <span className="font-black text-slate-900 text-sm">Tixora</span>
            <span className="font-bold">— Platform Manajemen Tiket & Gate Check-in Resmi</span>
          </div>

          <div className="flex items-center gap-6 font-bold text-slate-700">
            <span className="flex items-center gap-1.5 text-indigo-700">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Kriptografi SHA-256 & Firebase Terkoneksi</span>
            </span>
            <span>© 2026 Tixora. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
