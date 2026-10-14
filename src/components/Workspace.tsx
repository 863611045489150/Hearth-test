import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  Menu,
  Sparkles,
  BookOpen,
  Code,
  Compass,
  Lightbulb,
  CloudCheck,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { Conversation, Message, UserQuota } from '../lib/types';
import { DriveClient } from '../lib/driveClient';
import { Sidebar } from './Sidebar';
import { ChatMessage } from './ChatMessage';
import { Composer } from './Composer';
import { ConfirmationModal } from './ConfirmationModal';
import { OwnerModal } from './OwnerModal';
import { Logo } from './Logo';

interface WorkspaceProps {
  user: User;
  token: string;
  onSignOut: () => void;
}

const SUGGESTED_PROMPTS = [
  {
    icon: Lightbulb,
    title: 'Explore a complex tradeoff',
    prompt: 'Analyze the architectural tradeoffs between micro-frontends and modular monoliths for a 15-person engineering team.',
  },
  {
    icon: Code,
    title: 'Code review & refactor',
    prompt: 'Here is a TypeScript snippet. Critique its error handling and suggest a cleaner, idiomatic pattern:',
  },
  {
    icon: Compass,
    title: 'Synthesize & clarify',
    prompt: 'Help me distill this rough product concept into a concise, high-signal 1-page executive summary.',
  },
  {
    icon: BookOpen,
    title: 'Intellectual sounding board',
    prompt: 'Play devil’s advocate against this thesis: "Simplicity always beats flexibility in early-stage software design."',
  },
];

export const Workspace: React.FC<WorkspaceProps> = ({ user, token, onSignOut }) => {
  const [driveClient] = useState<DriveClient>(() => new DriveClient(token));
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Quota state
  const [quota, setQuota] = useState<UserQuota | null>(null);

  // Modals & UI
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  // Update token if changed
  useEffect(() => {
    driveClient.updateToken(token);
  }, [token, driveClient]);

  // Fetch quota from server
  const fetchQuota = async () => {
    try {
      const res = await fetch(`/api/user/quota?userId=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email || '')}`);
      if (res.ok) {
        const data: UserQuota = await res.json();
        setQuota(data);
      }
    } catch (err) {
      console.warn('[Workspace] Failed to fetch quota:', err);
    }
  };

  // Load conversations from user's Drive on mount
  useEffect(() => {
    const loadDriveData = async () => {
      setDriveSyncing(true);
      try {
        await driveClient.initializeWorkspace();
        const index = await driveClient.getConversationsIndex();
        setConversations(index);

        if (index.length > 0) {
          // Open latest conversation
          openConversation(index[0].id, index[0].driveFileId);
        } else {
          // Start a blank conversation
          startNewConversation();
        }
      } catch (err: any) {
        console.error('[Workspace] Drive initialization error:', err);
        setErrorBanner(`Google Drive sync notice: ${err?.message || 'Connecting to private folder...'}`);
      } finally {
        setDriveSyncing(false);
      }
    };

    loadDriveData();
    fetchQuota();
  }, [user.uid]);

  // Start new conversation
  const startNewConversation = () => {
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      title: 'New Thinking Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      messages: [],
    };
    setActiveId(newConv.id);
    setActiveConversation(newConv);
  };

  // Open an existing conversation
  const openConversation = async (convId: string, driveFileId?: string) => {
    setActiveId(convId);
    setDriveSyncing(true);
    try {
      const fullConv = await driveClient.loadConversation(convId, driveFileId);
      if (fullConv) {
        setActiveConversation(fullConv);
      } else {
        // Fallback: conversation found in index but file missing, construct blank
        const found = conversations.find((c) => c.id === convId);
        setActiveConversation({
          id: convId,
          title: found?.title || 'New Thinking Session',
          createdAt: found?.createdAt || Date.now(),
          updatedAt: found?.updatedAt || Date.now(),
          messageCount: 0,
          messages: [],
        });
      }
    } catch (err) {
      console.error('[Workspace] Failed to load conversation messages:', err);
    } finally {
      setDriveSyncing(false);
    }
  };

  // Save active conversation to Google Drive
  const saveToDrive = async (conv: Conversation) => {
    setDriveSyncing(true);
    try {
      const fileId = await driveClient.saveConversation(conv);
      conv.driveFileId = fileId;
      // Refresh index
      const updatedIndex = await driveClient.getConversationsIndex();
      setConversations(updatedIndex);
    } catch (err: any) {
      console.error('[Workspace] Failed to save conversation to Drive:', err);
      setErrorBanner('Failed to save to Google Drive. Check Drive permissions.');
    } finally {
      setDriveSyncing(false);
    }
  };

  // Send message and stream AI response
  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Check quota locally first
    if (quota && quota.isExhausted) {
      return;
    }

    setErrorBanner(null);

    const userMessage: Message = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content,
      createdAt: Date.now(),
    };

    let currentConv = activeConversation;
    if (!currentConv) {
      currentConv = {
        id: `conv_${Date.now()}`,
        title: content.slice(0, 32).trim() + (content.length > 32 ? '...' : ''),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
        messages: [],
      };
      setActiveId(currentConv.id);
    }

    // Auto-title conversation on first message
    if (currentConv.messages?.length === 0) {
      currentConv.title = content.slice(0, 32).trim() + (content.length > 32 ? '...' : '');
    }

    const updatedMessages: Message[] = [...(currentConv.messages || []), userMessage];
    const updatedConv: Conversation = {
      ...currentConv,
      messages: updatedMessages,
      messageCount: updatedMessages.length,
      updatedAt: Date.now(),
    };

    setActiveConversation(updatedConv);
    setIsLoading(true);

    // Placeholder assistant message for streaming
    const assistantMessageId = `msg_${Date.now()}_a`;
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };

    setActiveConversation((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...(prev.messages || []), initialAssistantMessage],
      };
    });

    // Abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Send to server streaming endpoint
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
          'x-user-email': user.email || '',
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server request failed');
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let modelUsed = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const payload = JSON.parse(jsonStr);
                if (payload.chunk) {
                  accumulatedText += payload.chunk;
                  // Update message in state
                  setActiveConversation((prev) => {
                    if (!prev) return null;
                    const msgs = (prev.messages || []).map((m) =>
                      m.id === assistantMessageId ? { ...m, content: accumulatedText } : m
                    );
                    return { ...prev, messages: msgs };
                  });
                }
                if (payload.done) {
                  modelUsed = payload.modelUsed || '';
                }
                if (payload.error) {
                  throw new Error(payload.error);
                }
              } catch (e) {
                // partial json or ignore
              }
            }
          }
        }
      }

      // Final assistant message
      const finalAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: accumulatedText || '...',
        createdAt: Date.now(),
        modelUsed,
      };

      const finalConv: Conversation = {
        ...updatedConv,
        messages: [...updatedMessages, finalAssistantMessage],
        messageCount: updatedMessages.length + 1,
        updatedAt: Date.now(),
      };

      setActiveConversation(finalConv);

      // Persist to user's Google Drive
      await saveToDrive(finalConv);

      // Refresh quota
      await fetchQuota();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Generation aborted by user');
      } else {
        console.error('[Workspace] Generation error:', err);
        const errorMessage = err?.message || 'Failed to complete AI response.';
        setErrorBanner(errorMessage);

        // Mark message as failed in UI
        setActiveConversation((prev) => {
          if (!prev) return null;
          const msgs = (prev.messages || []).map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  failed: true,
                  errorMessage,
                  content: m.content || '*(Generation failed. No allowance was consumed)*',
                }
              : m
          );
          return { ...prev, messages: msgs };
        });
      }
      // Refresh quota (reservation should be rolled back)
      await fetchQuota();
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Stop generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // Rename conversation
  const handleRename = async (convId: string, newTitle: string) => {
    if (activeConversation && activeConversation.id === convId) {
      const updated = { ...activeConversation, title: newTitle };
      setActiveConversation(updated);
      await saveToDrive(updated);
    } else {
      const conv = await driveClient.loadConversation(convId);
      if (conv) {
        conv.title = newTitle;
        await saveToDrive(conv);
      }
    }
  };

  // Delete conversation request
  const handleDeleteRequest = (convId: string, title: string) => {
    setDeleteModalState({
      isOpen: true,
      id: convId,
      title,
    });
  };

  // Confirm delete from Google Drive
  const handleConfirmDelete = async () => {
    const { id } = deleteModalState;
    setDeleteModalState({ isOpen: false, id: '', title: '' });
    setDriveSyncing(true);

    try {
      await driveClient.deleteConversation(id);
      const updatedIndex = await driveClient.getConversationsIndex();
      setConversations(updatedIndex);

      if (activeId === id) {
        if (updatedIndex.length > 0) {
          openConversation(updatedIndex[0].id, updatedIndex[0].driveFileId);
        } else {
          startNewConversation();
        }
      }
    } catch (err: any) {
      console.error('[Workspace] Delete failed:', err);
      setErrorBanner('Failed to delete file from Google Drive');
    } finally {
      setDriveSyncing(false);
    }
  };

  // Export conversation as Markdown or JSON
  const handleExport = (convId: string, format: 'md' | 'json') => {
    const target = activeConversation?.id === convId ? activeConversation : conversations.find((c) => c.id === convId);
    if (!target) return;

    let content = '';
    let fileName = `${target.title.replace(/[^a-z0-9_-]/gi, '_')}.${format}`;
    let mimeType = 'text/plain';

    if (format === 'json') {
      content = JSON.stringify(target, null, 2);
      mimeType = 'application/json';
    } else {
      content = `# ${target.title}\n*Saved from Hearth — ${new Date(target.createdAt).toLocaleString()}*\n\n`;
      (target.messages || []).forEach((m) => {
        content += `### ${m.role === 'user' ? 'You' : 'Hearth'}\n\n${m.content}\n\n---\n\n`;
      });
      mimeType = 'text/markdown';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const messages = activeConversation?.messages || [];

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => openConversation(id)}
        onNewChat={startNewConversation}
        onRename={handleRename}
        onDeleteRequest={handleDeleteRequest}
        onExport={handleExport}
        user={user}
        quota={quota}
        onSignOut={onSignOut}
        onOpenOwnerModal={() => setOwnerModalOpen(true)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0c] relative">
        {/* Workspace Top Bar */}
        <header className="h-12 border-b border-zinc-800/80 px-4 flex items-center justify-between shrink-0 bg-[#0c0c0e]/60 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Toggle sidebar"
            >
              <Menu size={16} />
            </button>

            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-medium text-zinc-200 truncate">
                {activeConversation?.title || 'New Thinking Session'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Drive sync indicator */}
            <div
              className="flex items-center gap-1 text-[11px] text-zinc-400"
              title="All chat data is isolated in your personal Google Drive"
            >
              <FolderOpen size={12} className={driveSyncing ? 'text-amber-400 animate-pulse' : 'text-emerald-400'} />
              <span className="hidden sm:inline text-zinc-400 text-[11px]">
                {driveSyncing ? 'Syncing Drive...' : 'Drive Synced'}
              </span>
            </div>

            {/* Test remaining pill */}
            <div className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
              <span className="text-orange-400 font-semibold">{quota?.remaining ?? 5}</span> of 5 free
            </div>
          </div>
        </header>

        {/* Global Error Banner */}
        {errorBanner && (
          <div className="bg-red-950/60 border-b border-red-800/60 px-4 py-2 flex items-center justify-between text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-red-400 hover:text-red-200 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-8 animate-in fade-in duration-200">
              <div className="space-y-3">
                <Logo size={42} withEmberGlow={true} className="mx-auto" />
                <h2 className="text-2xl font-normal tracking-tight text-white">
                  A quiet workspace for thinking.
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto font-light leading-relaxed">
                  Start with a premise, challenge an assumption, or draft an architecture.
                  Saved only in your personal Google Drive.
                </p>
              </div>

              {/* Suggested Prompts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                {SUGGESTED_PROMPTS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(item.prompt)}
                      className="p-3.5 rounded-lg bg-[#121215] border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-zinc-400 group-hover:text-orange-400 mb-1">
                        <Icon size={14} />
                        <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                        {item.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pb-8">
              {messages.map((m, index) => (
                <ChatMessage
                  key={m.id || index}
                  message={m}
                  isLatestAssistant={index === messages.length - 1 && m.role === 'assistant'}
                  onRetry={() => {
                    const lastUserMsg = [...messages].reverse().find((msg) => msg.role === 'user');
                    if (lastUserMsg) {
                      handleSend(lastUserMsg.content);
                    }
                  }}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <Composer
          onSend={handleSend}
          isLoading={isLoading}
          onStop={handleStop}
          quota={quota}
        />
      </div>

      {/* Confirmation Modal for Google Drive Deletion */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title="Delete conversation from Google Drive?"
        message={`Are you sure you want to permanently delete "${deleteModalState.title}"? This will remove the conversation and all its messages from your personal Google Drive.`}
        confirmLabel="Delete from Drive"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalState({ isOpen: false, id: '', title: '' })}
      />

      {/* Owner Operational Monitor */}
      <OwnerModal
        isOpen={ownerModalOpen}
        onClose={() => setOwnerModalOpen(false)}
        userEmail={user.email || ''}
        onQuotaReset={fetchQuota}
      />
    </div>
  );
};
