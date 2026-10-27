import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Profile } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Super admin email designated by user
export const SUPER_ADMIN_EMAIL = 'anderson10.talenta@gmail.com';

// Skill validation test connection
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection verified.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Skill requirement: standard Firestore error handler conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Convert Firebase user to Application Profile
export async function syncUserProfile(fbUser: FirebaseUser): Promise<Profile> {
  const isSuperAdmin = (fbUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
  const userRef = doc(db, 'users', fbUser.uid);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const profile: Profile = {
        id: fbUser.uid,
        email: fbUser.email || data.email || '',
        fullName: fbUser.displayName || data.fullName || 'Pengguna Tixora',
        avatarUrl: fbUser.photoURL || data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        phone: fbUser.phoneNumber || data.phone || '+6281234567890',
        isSuperAdmin: isSuperAdmin || !!data.isSuperAdmin,
        creditScore: data.creditScore ?? 10,
        createdAt: data.createdAt || new Date().toISOString(),
      };
      // Keep admin status synced
      if (isSuperAdmin && !data.isSuperAdmin) {
        await updateDoc(userRef, { isSuperAdmin: true });
      }
      return profile;
    }
  } catch (err) {
    console.warn('Could not read existing profile, creating new:', err);
  }

  // Create initial profile in Firestore
  const newProfile: Profile = {
    id: fbUser.uid,
    email: fbUser.email || '',
    fullName: fbUser.displayName || 'Pengguna Tixora',
    avatarUrl: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    phone: fbUser.phoneNumber || '+6281234567890',
    isSuperAdmin,
    creditScore: 10,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(userRef, newProfile);
    if (isSuperAdmin) {
      await setDoc(doc(db, 'admins', fbUser.uid), {
        id: fbUser.uid,
        email: fbUser.email,
        role: 'super_admin',
        createdAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Failed to save profile in Firestore:', e);
  }

  return newProfile;
}

// Sign In with Google Popup
export async function loginWithGoogle(): Promise<Profile | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      return await syncUserProfile(result.user);
    }
    return null;
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  }
}

// Sign Out
export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}
