import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

const SESSION_TOKEN_KEY = 'google_sheets_access_token';

let isSigningIn = false;
let cachedAccessToken: string | null = sessionStorage.getItem(SESSION_TOKEN_KEY);
let currentUser: User | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentUser = user;
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!user) {
      cachedAccessToken = null;
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Izin Google Sheets tidak diberikan atau token tidak ditemukan.');
    }

    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem(SESSION_TOKEN_KEY, credential.accessToken);
    currentUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Jendela popup diblokir oleh browser. Harap izinkan popup (pop-up blocker) di bilah alamat browser Anda.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Login dibatalkan karena jendela popup Google ditutup sebelum selesai.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Domain preview sedang diproses oleh Google Auth. Silakan coba kembali dalam beberapa detik.');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  if (!cachedAccessToken) {
    cachedAccessToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
  }
  return cachedAccessToken;
};

export const getGoogleUser = (): User | null => {
  return currentUser || auth.currentUser;
};

export const setCachedGoogleToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
};

export const googleLogout = async () => {
  try {
    await signOut(auth);
    cachedAccessToken = null;
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    currentUser = null;
  } catch (err) {
    console.error('Logout error:', err);
  }
};
