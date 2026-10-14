import React, { useState } from 'react';
import { Copy, Check, RotateCcw, AlertCircle, Bot, User as UserIcon } from 'lucide-react';
import { marked } from 'marked';
import { Message } from '../lib/types';
import { Logo } from './Logo';

interface ChatMessageProps {
  message: Message;
  onRetry?: () => void;
  isLatestAssistant?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onRetry,
  isLatestAssistant = false,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Configure marked for clean HTML rendering
  const renderMarkdown = (text: string) => {
    try {
      return { __html: marked.parse(text, { breaks: true, gfm: true }) as string };
    } catch {
      return { __html: text };
    }
  };

  return (
    <div
      className={`group w-full py-5 px-4 md:px-6 transition-colors ${
        isUser ? 'bg-transparent' : 'bg-[#111114]/50 border-y border-zinc-800/40'
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-4 items-start">
        {/* Avatar */}
        <div className="shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
              <UserIcon size={15} />
            </div>
          ) : (
            <Logo size={28} withEmberGlow={false} />
          )}
        </div>

        {/* Content & Actions */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-300 tracking-wide">
                {isUser ? 'You' : 'Hearth'}
              </span>
              {message.modelUsed && !isUser && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/40 font-mono">
                  {message.modelUsed}
                </span>
              )}
            </div>

            {/* Message Action Buttons */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={copyToClipboard}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 rounded transition-colors cursor-pointer"
                title="Copy message"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>

              {!isUser && isLatestAssistant && onRetry && (
                <button
                  onClick={onRetry}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 rounded transition-colors cursor-pointer"
                  title="Retry response"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {message.failed && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-red-950/40 border border-red-800/50 text-red-200">
              <AlertCircle size={15} className="shrink-0 text-red-400" />
              <span>{message.errorMessage || 'Failed to complete generation.'}</span>
            </div>
          )}

          {/* Body */}
          <div
            className={`prose prose-invert max-w-none text-sm leading-relaxed text-zinc-200 break-words ${
              isUser ? 'font-normal' : 'font-light'
            } [&_pre]:bg-[#18181b] [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:rounded-md [&_pre]:p-3.5 [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-xs [&_code]:text-orange-200 [&_code]:bg-zinc-800/70 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-orange-400 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-orange-500/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-400`}
            dangerouslySetInnerHTML={renderMarkdown(message.content)}
          />
        </div>
      </div>
    </div>
  );
};
