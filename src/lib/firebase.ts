/**
 * Firebase Authentication & Google OAuth for Hearth
 * Authorizes Google Drive scope ('https://www.googleapis.com/auth/drive.file')
 * In-memory token management adhering to Workspace Integration security rules.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let previewUser: User | null = null;

/**
 * Initialize auth listener
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthSuccess && cachedAccessToken) {
          onAuthSuccess(user, cachedAccessToken);
        } else if (onAuthFailure) {
          onAuthFailure();
        }
      }
    } else if (previewUser && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(previewUser, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google with Drive scope
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google OAuth token not received. Please grant Drive permissions to continue.');
    }

    cachedAccessToken = credential.accessToken;
    previewUser = null;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const code = error?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      // Normal user dismissal or popup blocked by iframe; do not log console.error
      console.warn('[Auth] Google sign-in window was closed or dismissed.');
    } else {
      console.warn('[Auth] Sign in notice:', error?.message || error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Preview / Sandbox sign-in for testing inside iframes where popups are blocked
 */
export const previewSignIn = (email = 'aarush5732@gmail.com', name = 'Aarush Gupta'): { user: User; accessToken: string } => {
  const dummyUser: any = {
    uid: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName: name,
    photoURL: null,
    emailVerified: true,
  };
  cachedAccessToken = `test_token_${Date.now()}`;
  previewUser = dummyUser;
  return { user: dummyUser, accessToken: cachedAccessToken };
};

/**
 * Retrieve current cached access token (in memory)
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign out and clear in-memory tokens
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
  cachedAccessToken = null;
  previewUser = null;
};
