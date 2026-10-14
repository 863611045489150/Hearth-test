import React from 'react';
import { Logo } from './Logo';
import { ShieldCheck, HardDrive, Zap, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  onPreviewSignIn?: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onPreviewSignIn,
  isLoading,
  error,
}) => {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between selection:bg-orange-500/20 selection:text-orange-200">
      {/* Top Navbar */}
      <header className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Logo size={28} withEmberGlow={true} />
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm tracking-tight text-white">Hearth</span>
            <span className="text-xs text-zinc-500 font-mono">v1.0</span>
          </div>
        </div>

        <div className="text-xs text-zinc-400">
          Created by <span className="text-zinc-200 font-medium">Aarush Gupta</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-3xl mx-auto w-full text-center space-y-8">
        {/* Beacon Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span>Small-Scale Public Testing · 5 Free Responses per Account</span>
        </div>

        {/* Big Headline & Subtitle */}
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-5xl font-medium tracking-tight text-white leading-tight">
            A quiet workspace for <br className="hidden sm:inline" />
            <span className="text-zinc-400">thinking with AI.</span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto font-light leading-relaxed">
            Distraction-free AI chat. No API key needed, no model configuration, and no monthly fees.
            Your conversations stay completely private inside your own personal Google Drive.
          </p>
        </div>

        {/* Error message if auth fails */}
        {error && (
          <div className="max-w-md mx-auto p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-200 text-left">
            <strong>Sign-in notice:</strong> {error}
          </div>
        )}

        {/* Action Button: Official Google Sign-In */}
        <div className="pt-2 flex flex-col items-center gap-3 w-full max-w-xs">
          <button
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-lg bg-white text-zinc-900 hover:bg-zinc-100 font-medium text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2 text-zinc-600">
                <span className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin" />
                Connecting...
              </span>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {onPreviewSignIn && (
            <button
              onClick={onPreviewSignIn}
              className="w-full py-2 px-3 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 hover:bg-zinc-800/80 rounded-md border border-zinc-800 transition-colors cursor-pointer"
            >
              Enter Preview Test Mode (Instant Access)
            </button>
          )}

          <span className="text-[11px] text-zinc-500">
            Authorizes isolated storage in your personal Google Drive
          </span>
        </div>

        {/* Feature Grid: Privacy, Key Pool, Usage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left w-full">
          <div className="p-4 rounded-lg bg-[#111114] border border-zinc-800/80 space-y-2">
            <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center text-orange-400">
              <HardDrive size={15} />
            </div>
            <h3 className="text-xs font-medium text-zinc-200">Your Google Drive</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every message and chat is saved directly into your authorized Google account under a private Hearth folder. Isolated and encrypted by Google.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#111114] border border-zinc-800/80 space-y-2">
            <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center text-orange-400">
              <Zap size={15} />
            </div>
            <h3 className="text-xs font-medium text-zinc-200">Owner-Provided Key Pool</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Powered by the application owner&apos;s AI keys with automated failover and health registry. You never configure API keys or pay.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#111114] border border-zinc-800/80 space-y-2">
            <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center text-orange-400">
              <ShieldCheck size={15} />
            </div>
            <h3 className="text-xs font-medium text-zinc-200">5 Free Test Responses</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Each authenticated account receives 5 free high-quality AI thinking responses for public testing, tracked persistently on the server.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-5 px-6 text-center text-xs text-zinc-500">
        <p>Hearth is designed and engineered by Aarush Gupta. Small-scale public testing release.</p>
      </footer>
    </div>
  );
};
