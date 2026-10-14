import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square, Sparkles, AlertCircle } from 'lucide-react';
import { UserQuota } from '../lib/types';

interface ComposerProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  quota: UserQuota | null;
  placeholder?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  isLoading,
  onStop,
  quota,
  placeholder = 'Message Hearth...',
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = quota ? quota.remaining : 5;
  const isExhausted = quota ? quota.isExhausted : false;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading || isExhausted) return;

    onSend(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      {/* Testing quota status badge */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isExhausted
                ? 'bg-red-500'
                : remaining <= 2
                ? 'bg-amber-500 animate-pulse'
                : 'bg-orange-500'
            }`}
          />
          {isExhausted ? (
            <span className="text-zinc-400">Testing limit reached</span>
          ) : (
            <span>
              <strong className="text-zinc-200 font-medium">{remaining}</strong> of{' '}
              <strong className="text-zinc-200 font-medium">{quota?.maxAllowed || 5}</strong> free
              test responses remaining
            </span>
          )}
        </div>
        <span className="text-zinc-500 text-[10px]">Google Drive synced</span>
      </div>

      {/* Exhausted limit notice card */}
      {isExhausted ? (
        <div className="p-4 rounded-lg bg-[#141417] border border-zinc-800 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-zinc-200 text-sm font-medium">
            <AlertCircle size={16} className="text-orange-500" />
            <span>You've used all five free test responses. Thanks for trying Hearth.</span>
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            All your chat history remains safely stored and viewable in your personal Google Drive.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end gap-2 bg-[#141417] border border-zinc-800/80 focus-within:border-orange-500/50 rounded-xl p-2.5 transition-all shadow-lg"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isExhausted}
            placeholder={placeholder}
            rows={1}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 resize-none outline-none max-h-44 py-1.5 px-2 font-normal leading-relaxed disabled:opacity-50"
          />

          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                title="Stop generation"
              >
                <Square size={14} className="fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isExhausted}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  input.trim() && !isExhausted
                    ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_10px_rgba(234,88,12,0.3)]'
                    : 'bg-zinc-800/60 text-zinc-500 cursor-not-allowed'
                }`}
                title="Send message (Enter)"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </form>
      )}

      <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-zinc-500 text-center">
        <span>Enter to send · Shift+Enter for newline</span>
        <span>·</span>
        <span>Created by Aarush Gupta</span>
      </div>
    </div>
  );
};
