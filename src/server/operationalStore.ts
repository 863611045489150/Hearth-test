/**
 * Operational Store for Hearth
 * Manages transactional 5-message usage counters, quota reservations,
 * API key slot assignments, and key health states.
 * Fully decoupled from user data (which lives in Google Drive).
 */

import fs from 'fs';
import path from 'path';
import { UserQuota, KeySlotHealth, OperationalLogEntry, OwnerStats } from '../lib/types';

interface UserRecord {
  userId: string;
  email?: string;
  totalUsed: number;
  reserved: number;
  maxAllowed: number;
  assignedSlot: number;
  createdAt: number;
  updatedAt: number;
}

interface OperationalStoreData {
  users: Record<string, UserRecord>;
  keyHealth: Record<number, KeySlotHealth>;
  logs: OperationalLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'operational_store.json');
const MAX_LOGS = 100;
const DEFAULT_TESTING_LIMIT = 5;

class OperationalStore {
  private data: OperationalStoreData = {
    users: {},
    keyHealth: {},
    logs: [],
  };

  private isLoaded = false;
  private lock = Promise.resolve();

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.persistSync();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('[OperationalStore] Failed to load data file, starting in-memory:', err);
      this.data = { users: {}, keyHealth: {}, logs: [] };
      this.isLoaded = true;
    }
  }

  private persistSync() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[OperationalStore] Error saving store:', err);
    }
  }

  /**
   * Concurrency lock for atomic state transitions
   */
  private async withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const prevLock = this.lock;
    let release: () => void;
    this.lock = new Promise<void>((res) => {
      release = res;
    });
    await prevLock;
    try {
      return await fn();
    } finally {
      this.persistSync();
      release!();
    }
  }

  /**
   * Get or initialize a user record
   */
  public async getUserQuota(userId: string, email?: string): Promise<UserQuota> {
    return this.withLock(() => {
      const existing = this.data.users[userId];
      if (existing) {
        if (email && !existing.email) {
          existing.email = email;
        }
        return {
          userId: existing.userId,
          email: existing.email,
          totalUsed: existing.totalUsed,
          remaining: Math.max(0, existing.maxAllowed - existing.totalUsed),
          maxAllowed: existing.maxAllowed,
          isExhausted: existing.totalUsed >= existing.maxAllowed,
          reserved: existing.reserved,
        };
      }

      // Initialize new user
      const newUser: UserRecord = {
        userId,
        email,
        totalUsed: 0,
        reserved: 0,
        maxAllowed: DEFAULT_TESTING_LIMIT,
        assignedSlot: 1, // Will be set by key allocator
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.data.users[userId] = newUser;
      this.log('User registered for testing allowance', 'info', { userId, maxAllowed: DEFAULT_TESTING_LIMIT });

      return {
        userId: newUser.userId,
        email: newUser.email,
        totalUsed: newUser.totalUsed,
        remaining: newUser.maxAllowed,
        maxAllowed: newUser.maxAllowed,
        isExhausted: false,
        reserved: 0,
      };
    });
  }

  /**
   * Atomic quota reservation before initiating an AI request.
   * Returns true if quota was reserved, false if limit exhausted.
   */
  public async reserveQuota(userId: string, email?: string): Promise<{ success: boolean; remaining: number; error?: string }> {
    return this.withLock(() => {
      let user = this.data.users[userId];
      if (!user) {
        user = {
          userId,
          email,
          totalUsed: 0,
          reserved: 0,
          maxAllowed: DEFAULT_TESTING_LIMIT,
          assignedSlot: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.data.users[userId] = user;
      }

      if (user.totalUsed + user.reserved >= user.maxAllowed) {
        return {
          success: false,
          remaining: Math.max(0, user.maxAllowed - user.totalUsed),
          error: "You've used all five free test responses. Thanks for trying Hearth.",
        };
      }

      user.reserved += 1;
      user.updatedAt = Date.now();

      return {
        success: true,
        remaining: Math.max(0, user.maxAllowed - user.totalUsed - user.reserved),
      };
    });
  }

  /**
   * Commit quota on successful provider response
   */
  public async commitQuota(userId: string): Promise<UserQuota> {
    return this.withLock(() => {
      const user = this.data.users[userId];
      if (!user) {
        throw new Error('User not found for quota commit');
      }

      user.reserved = Math.max(0, user.reserved - 1);
      user.totalUsed += 1;
      user.updatedAt = Date.now();

      this.log('AI response quota committed', 'success', {
        userId,
        totalUsed: user.totalUsed,
        remaining: user.maxAllowed - user.totalUsed,
      });

      return {
        userId: user.userId,
        email: user.email,
        totalUsed: user.totalUsed,
        remaining: Math.max(0, user.maxAllowed - user.totalUsed),
        maxAllowed: user.maxAllowed,
        isExhausted: user.totalUsed >= user.maxAllowed,
        reserved: user.reserved,
      };
    });
  }

  /**
   * Release reservation on failed AI response or error
   */
  public async rollbackQuota(userId: string, reason?: string): Promise<UserQuota> {
    return this.withLock(() => {
      const user = this.data.users[userId];
      if (!user) {
        throw new Error('User not found for quota rollback');
      }

      user.reserved = Math.max(0, user.reserved - 1);
      user.updatedAt = Date.now();

      this.log('AI response quota reservation rolled back', 'warning', {
        userId,
        reason: reason || 'Provider error or timeout',
      });

      return {
        userId: user.userId,
        email: user.email,
        totalUsed: user.totalUsed,
        remaining: Math.max(0, user.maxAllowed - user.totalUsed),
        maxAllowed: user.maxAllowed,
        isExhausted: user.totalUsed >= user.maxAllowed,
        reserved: user.reserved,
      };
    });
  }

  /**
   * Key Slot Assignment
   */
  public async getUserKeySlot(userId: string): Promise<number | undefined> {
    return this.withLock(() => {
      return this.data.users[userId]?.assignedSlot;
    });
  }

  public async assignUserKeySlot(userId: string, slot: number): Promise<void> {
    return this.withLock(() => {
      if (this.data.users[userId]) {
        this.data.users[userId].assignedSlot = slot;
        this.data.users[userId].updatedAt = Date.now();
      }
    });
  }

  /**
   * Key Health Registry
   */
  public async getKeyHealth(slot: number): Promise<KeySlotHealth | undefined> {
    return this.withLock(() => {
      return this.data.keyHealth[slot];
    });
  }

  public async updateKeyHealth(slot: number, updates: Partial<KeySlotHealth>): Promise<void> {
    return this.withLock(() => {
      const current = this.data.keyHealth[slot] || {
        slot,
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        status: 'healthy',
        failureCount: 0,
        assignedUsersCount: 0,
      };

      this.data.keyHealth[slot] = {
        ...current,
        ...updates,
      };
    });
  }

  public async recordKeySuccess(slot: number): Promise<void> {
    return this.withLock(() => {
      const current = this.data.keyHealth[slot];
      if (current) {
        current.status = 'healthy';
        current.failureCount = 0;
        current.cooldownUntil = undefined;
        current.lastUsedAt = Date.now();
      }
    });
  }

  public async recordKeyFailure(
    slot: number,
    category: 'rate_limit' | 'temporary_outage' | 'invalid_key' | 'billing_exhausted',
    cooldownMs = 60000
  ): Promise<void> {
    return this.withLock(() => {
      const current = this.data.keyHealth[slot] || {
        slot,
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        status: 'healthy',
        failureCount: 0,
        assignedUsersCount: 0,
      };

      current.failureCount += 1;
      current.lastUsedAt = Date.now();

      if (category === 'invalid_key' || category === 'billing_exhausted') {
        current.status = 'invalid';
      } else {
        current.status = 'cooldown';
        current.cooldownUntil = Date.now() + cooldownMs;
      }

      this.data.keyHealth[slot] = current;
      this.log(`Key slot #${slot} flagged: ${category}`, 'warning', {
        slot,
        category,
        cooldownSeconds: Math.round(cooldownMs / 1000),
      });
    });
  }

  /**
   * Reset a test user for QA / owner testing
   */
  public async resetUserQuota(userId: string): Promise<UserQuota> {
    return this.withLock(() => {
      let user = this.data.users[userId];
      if (user) {
        user.totalUsed = 0;
        user.reserved = 0;
        user.updatedAt = Date.now();
        this.log('User quota manually reset by owner', 'info', { userId });
      } else {
        user = {
          userId,
          totalUsed: 0,
          reserved: 0,
          maxAllowed: DEFAULT_TESTING_LIMIT,
          assignedSlot: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.data.users[userId] = user;
      }
      return {
        userId: user.userId,
        email: user.email,
        totalUsed: 0,
        remaining: user.maxAllowed,
        maxAllowed: user.maxAllowed,
        isExhausted: false,
        reserved: 0,
      };
    });
  }

  /**
   * Operational logging (strictly sanitized, never contains raw message content or secrets)
   */
  public log(event: string, status: 'success' | 'warning' | 'error' | 'info' = 'info', metadata?: Record<string, any>) {
    const entry: OperationalLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      event,
      status,
      details: metadata ? JSON.stringify(metadata) : undefined,
    };
    this.data.logs.unshift(entry);
    if (this.data.logs.length > MAX_LOGS) {
      this.data.logs = this.data.logs.slice(0, MAX_LOGS);
    }
  }

  /**
   * Operational Monitor Stats (Owner Only)
   */
  public async getOwnerStats(): Promise<OwnerStats> {
    return this.withLock(() => {
      const usersList = Object.values(this.data.users);
      const totalUsers = usersList.length;
      const totalMessagesUsed = usersList.reduce((acc, u) => acc + u.totalUsed, 0);
      const activeReservations = usersList.reduce((acc, u) => acc + u.reserved, 0);

      const keySlots = Object.values(this.data.keyHealth);
      const hasInvalid = keySlots.some((k) => k.status === 'invalid');
      const hasCooldown = keySlots.some((k) => k.status === 'cooldown');

      let systemHealth = 'All Systems Operational';
      if (hasInvalid) systemHealth = 'Warning: Invalid key slot detected';
      else if (hasCooldown) systemHealth = 'Notice: Key slot in temporary cooldown';

      return {
        totalUsers,
        totalMessagesUsed,
        activeReservations,
        keySlots,
        systemHealth,
        logs: this.data.logs.slice(0, 30),
      };
    });
  }
}

export const operationalStore = new OperationalStore();
