/**
 * Hearth Types & Contracts
 * Created by Aarush Gupta
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  modelUsed?: string;
  failed?: boolean;
  errorMessage?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  driveFileId?: string;
  messages?: Message[];
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  customSystemInstruction?: string;
  autoTitle: boolean;
}

export interface UserQuota {
  userId: string;
  email?: string;
  totalUsed: number;
  remaining: number;
  maxAllowed: number;
  isExhausted: boolean;
  reserved: number;
}

export interface KeySlotHealth {
  slot: number;
  provider: string;
  model: string;
  status: 'healthy' | 'cooldown' | 'invalid';
  failureCount: number;
  cooldownUntil?: number;
  lastUsedAt?: number;
  assignedUsersCount: number;
}

export interface OperationalLogEntry {
  id: string;
  timestamp: number;
  event: string;
  slot?: number;
  provider?: string;
  status: 'success' | 'warning' | 'error' | 'info';
  details?: string;
}

export interface OwnerStats {
  totalUsers: number;
  totalMessagesUsed: number;
  activeReservations: number;
  keySlots: KeySlotHealth[];
  systemHealth: string;
  logs: OperationalLogEntry[];
}
