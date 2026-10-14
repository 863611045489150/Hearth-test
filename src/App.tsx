import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, previewSignIn, logout, getAccessToken } from './lib/firebase';
import { LandingPage } from './components/LandingPage';
import { Workspace } from './components/Workspace';
import { Logo } from './components/Logo';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authenticatedUser, accessToken) => {
        setUser(authenticatedUser);
        setToken(accessToken);
        setInitializing(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setInitializing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User closed or popup was blocked by browser/iframe; handle gracefully without console.error
        setAuthError(
          'Sign-in window was closed. You can retry with Google or click "Enter Preview Test Mode" below.'
        );
      } else {
        console.warn('[App] Sign-in message:', err?.message || err);
        setAuthError(err?.message || 'Authentication failed. Please verify your connection or use Preview Test Mode.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePreviewSignIn = () => {
    setAuthError(null);
    const { user: testUser, accessToken } = previewSignIn('aarush5732@gmail.com', 'Aarush Gupta');
    setUser(testUser);
    setToken(accessToken);
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
    } catch (err) {
      console.warn('[App] Sign out notice:', err);
    }
  };

  // Loading splash
  if (initializing) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center space-y-4">
        <Logo size={36} withEmberGlow={true} className="animate-pulse" />
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
          <span>Opening Hearth...</span>
        </div>
      </div>
    );
  }

  // If user is authenticated and token is available
  if (user && token) {
    return <Workspace user={user} token={token} onSignOut={handleSignOut} />;
  }

  // Otherwise, show Landing Page
  return (
    <LandingPage
      onSignIn={handleSignIn}
      onPreviewSignIn={handlePreviewSignIn}
      isLoading={isAuthenticating}
      error={authError}
    />
  );
}
