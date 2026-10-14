import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Download,
  LogOut,
  FolderSync,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Conversation, UserQuota } from '../lib/types';
import { Logo } from './Logo';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDeleteRequest: (id: string, title: string) => void;
  onExport: (id: string, format: 'md' | 'json') => void;
  user: User | null;
  quota: UserQuota | null;
  onSignOut: () => void;
  onOpenOwnerModal: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDeleteRequest,
  onExport,
  user,
  quota,
  onSignOut,
  onOpenOwnerModal,
  isOpen,
  onToggle,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const isOwner = user?.email === 'aarush5732@gmail.com' || process.env.NODE_ENV !== 'production';

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const startEditing = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveEditing = (convId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRename(convId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-[#0c0c0e] border-r border-zinc-800/80 flex flex-col transition-transform duration-200 ease-in-out shrink-0 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
        }`}
      >
        {/* Header: Logo & New Chat */}
        <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={26} withEmberGlow={true} />
            <div>
              <span className="font-semibold text-sm tracking-tight text-white block">Hearth</span>
              <span className="text-[10px] text-zinc-500 block leading-tight">by Aarush Gupta</span>
            </div>
          </div>

          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 hover:text-white rounded-md border border-zinc-700/50 transition-colors cursor-pointer"
            title="Start new conversation"
          >
            <Plus size={14} className="text-orange-500" />
            <span>New</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5">
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-[#141417] text-xs text-zinc-200 placeholder-zinc-500 pl-8 pr-2.5 py-1.5 rounded-md border border-zinc-800/80 focus:border-zinc-700 outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageSquare size={20} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-xs text-zinc-500 font-normal">
                {search ? 'No matching conversations' : 'No conversations yet'}
              </p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Your chats are saved to your personal Google Drive
              </p>
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = conv.id === activeId;
              const isEditing = conv.id === editingId;

              return (
                <div
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`group relative flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-zinc-800/80 text-white font-medium border border-zinc-700/50'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  {isEditing ? (
                    <form
                      onSubmit={(e) => saveEditing(conv.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 w-full"
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        className="flex-1 bg-black text-xs text-white px-1.5 py-0.5 rounded border border-orange-500 outline-none"
                      />
                      <button
                        type="submit"
                        className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Save title"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        title="Cancel"
                      >
                        <X size={12} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 truncate min-w-0 pr-1">
                        <MessageSquare
                          size={13}
                          className={`shrink-0 ${isActive ? 'text-orange-500' : 'text-zinc-500'}`}
                        />
                        <span className="truncate">{conv.title}</span>
                      </div>

                      {/* Hover Actions */}
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0 bg-[#0c0c0e]/80 pl-1 rounded">
                        <button
                          onClick={(e) => startEditing(conv, e)}
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                          title="Rename"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onExport(conv.id, 'md');
                          }}
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                          title="Export as Markdown"
                        >
                          <Download size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRequest(conv.id, conv.title);
                          }}
                          className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                          title="Delete from Google Drive"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drive Storage Status Info */}
        <div className="px-3 py-2 border-t border-zinc-800/60 bg-[#0a0a0c]">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5 truncate">
              <FolderSync size={13} className="text-emerald-400 shrink-0" />
              <span className="truncate">Your Google Drive</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Isolated</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
            Stored in your personal Drive under &quot;Hearth&quot;
          </p>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-[#0e0e11] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-7 h-7 rounded-full border border-zinc-700 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300 shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0 truncate">
              <span className="text-xs font-medium text-zinc-200 block truncate">
                {user?.displayName || user?.email?.split('@')[0] || 'User'}
              </span>
              <span className="text-[10px] text-zinc-500 block truncate">
                {user?.email || ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isOwner && (
              <button
                onClick={onOpenOwnerModal}
                className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                title="Owner Operations"
              >
                <Activity size={14} />
              </button>
            )}
            <button
              onClick={onSignOut}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
