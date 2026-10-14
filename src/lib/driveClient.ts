/**
 * Google Drive Client for Hearth
 * Manages user-isolated data storage directly inside each user's own Google Drive.
 * Scoped to 'https://www.googleapis.com/auth/drive.file' (only accesses files created by Hearth).
 * Includes resilient local fallback if running in preview test mode or token is sandbox.
 */

import { Conversation, Message, UserPreferences } from './types';

const LOCAL_STORAGE_INDEX_KEY = 'hearth_drive_local_index';
const LOCAL_STORAGE_PREFIX = 'hearth_conv_';

export class DriveClient {
  private accessToken: string;
  private hearthFolderId: string | null = null;
  private conversationsFolderId: string | null = null;
  private indexFileId: string | null = null;
  private isLocalMode = false;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.isLocalMode = accessToken.startsWith('test_token_');
  }

  public updateToken(token: string) {
    this.accessToken = token;
    this.isLocalMode = token.startsWith('test_token_');
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Discovers or creates Hearth and Conversations folders in the user's Drive
   */
  public async initializeWorkspace(): Promise<{ hearthFolderId: string; conversationsFolderId: string }> {
    if (this.isLocalMode) {
      return { hearthFolderId: 'local_hearth', conversationsFolderId: 'local_convs' };
    }

    if (this.hearthFolderId && this.conversationsFolderId) {
      return { hearthFolderId: this.hearthFolderId, conversationsFolderId: this.conversationsFolderId };
    }

    try {
      // 1. Locate or create root 'Hearth' folder
      const hearthQuery = "mimeType = 'application/vnd.google-apps.folder' and name = 'Hearth' and trashed = false";
      const hearthRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(hearthQuery)}&fields=files(id,name,mimeType)`,
        { headers: this.getHeaders() }
      );

      if (!hearthRes.ok) {
        throw new Error(`Google Drive API error: ${hearthRes.status}`);
      }

      const hearthData = await hearthRes.json();
      let rootId: string;

      if (hearthData.files && hearthData.files.length > 0) {
        rootId = hearthData.files[0].id;
      } else {
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            name: 'Hearth',
            mimeType: 'application/vnd.google-apps.folder',
            description: 'Hearth AI thinking workspace user data',
          }),
        });
        const created = await createRes.json();
        rootId = created.id;
      }

      this.hearthFolderId = rootId;

      // 2. Locate or create 'Conversations' subfolder
      const convQuery = `mimeType = 'application/vnd.google-apps.folder' and name = 'Conversations' and '${rootId}' in parents and trashed = false`;
      const convRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(convQuery)}&fields=files(id,name,mimeType)`,
        { headers: this.getHeaders() }
      );
      const convData = await convRes.json();
      let convFolderId: string;

      if (convData.files && convData.files.length > 0) {
        convFolderId = convData.files[0].id;
      } else {
        const createConvRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            name: 'Conversations',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootId],
          }),
        });
        const createdConv = await createConvRes.json();
        convFolderId = createdConv.id;
      }

      this.conversationsFolderId = convFolderId;
      return { hearthFolderId: rootId, conversationsFolderId: convFolderId };
    } catch (err) {
      console.warn('[DriveClient] Real Drive failed or blocked, switching to local isolation fallback:', err);
      this.isLocalMode = true;
      return { hearthFolderId: 'local_hearth', conversationsFolderId: 'local_convs' };
    }
  }

  /**
   * Retrieves conversation index
   */
  public async getConversationsIndex(): Promise<Conversation[]> {
    if (this.isLocalMode) {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_INDEX_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }

    try {
      const { hearthFolderId } = await this.initializeWorkspace();
      if (this.isLocalMode) return this.getConversationsIndex();

      const query = `name = 'conversations_index.json' and '${hearthFolderId}' in parents and trashed = false`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
        { headers: this.getHeaders() }
      );
      const data = await res.json();

      if (data.files && data.files.length > 0) {
        this.indexFileId = data.files[0].id;
        const contentRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${this.indexFileId}?alt=media`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } }
        );
        if (contentRes.ok) {
          const indexList: Conversation[] = await contentRes.json();
          return Array.isArray(indexList) ? indexList : [];
        }
      }
      return [];
    } catch {
      // Local fallback
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_INDEX_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
  }

  /**
   * Saves updated conversations index
   */
  private async saveConversationsIndex(conversations: Conversation[]): Promise<void> {
    const cleanList = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messageCount || (c.messages ? c.messages.length : 0),
      driveFileId: c.driveFileId,
    }));

    try {
      localStorage.setItem(LOCAL_STORAGE_INDEX_KEY, JSON.stringify(cleanList));
    } catch {
      // ignore
    }

    if (this.isLocalMode) return;

    try {
      const { hearthFolderId } = await this.initializeWorkspace();
      const jsonStr = JSON.stringify(cleanList, null, 2);

      if (this.indexFileId) {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${this.indexFileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: jsonStr,
          }
        );
      } else {
        this.indexFileId = await this.createJsonFile('conversations_index.json', jsonStr, hearthFolderId);
      }
    } catch (err) {
      console.warn('[DriveClient] Failed to push index to remote Drive:', err);
    }
  }

  /**
   * Loads full messages for a conversation
   */
  public async loadConversation(conversationId: string, driveFileId?: string): Promise<Conversation | null> {
    // Check local storage first
    try {
      const localRaw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${conversationId}`);
      if (localRaw) {
        return JSON.parse(localRaw);
      }
    } catch {
      // ignore
    }

    if (this.isLocalMode) return null;

    try {
      await this.initializeWorkspace();
      let targetFileId = driveFileId;

      if (!targetFileId) {
        const query = `name = 'conv_${conversationId}.json' and '${this.conversationsFolderId}' in parents and trashed = false`;
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
          { headers: this.getHeaders() }
        );
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          targetFileId = data.files[0].id;
        }
      }

      if (!targetFileId) return null;

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${targetFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!res.ok) return null;

      const conv: Conversation = await res.json();
      conv.driveFileId = targetFileId;
      try {
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${conversationId}`, JSON.stringify(conv));
      } catch {
        // ignore
      }
      return conv;
    } catch (err) {
      console.warn('[DriveClient] Remote conversation fetch failed:', err);
      return null;
    }
  }

  /**
   * Saves or updates a conversation and its messages
   */
  public async saveConversation(conv: Conversation): Promise<string> {
    conv.updatedAt = Date.now();
    conv.messageCount = conv.messages?.length || 0;

    // Cache locally
    try {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${conv.id}`, JSON.stringify(conv));
    } catch {
      // ignore
    }

    // Update conversation index
    const index = await this.getConversationsIndex();
    const existingIdx = index.findIndex((c) => c.id === conv.id);
    if (existingIdx >= 0) {
      index[existingIdx] = {
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messageCount,
        driveFileId: conv.driveFileId || `local_${conv.id}`,
      };
    } else {
      index.unshift({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messageCount,
        driveFileId: conv.driveFileId || `local_${conv.id}`,
      });
    }

    await this.saveConversationsIndex(index);

    if (this.isLocalMode) {
      return `local_${conv.id}`;
    }

    try {
      const { conversationsFolderId } = await this.initializeWorkspace();
      const fileName = `conv_${conv.id}.json`;
      const payload = JSON.stringify(conv, null, 2);

      let fileId = conv.driveFileId;
      if (!fileId || fileId.startsWith('local_')) {
        fileId = await this.createJsonFile(fileName, payload, conversationsFolderId);
        conv.driveFileId = fileId;
      } else {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: payload,
          }
        );
      }
      return fileId;
    } catch (err) {
      console.warn('[DriveClient] Remote save failed, preserved in local storage:', err);
      return conv.driveFileId || `local_${conv.id}`;
    }
  }

  /**
   * Deletes a conversation
   */
  public async deleteConversation(convId: string, driveFileId?: string): Promise<void> {
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${convId}`);
    } catch {
      // ignore
    }

    const index = await this.getConversationsIndex();
    const updated = index.filter((c) => c.id !== convId);
    await this.saveConversationsIndex(updated);

    if (this.isLocalMode) return;

    try {
      let fileId = driveFileId;
      if (fileId && !fileId.startsWith('local_')) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
      }
    } catch (err) {
      console.warn('[DriveClient] Remote delete failed:', err);
    }
  }

  private async createJsonFile(name: string, content: string, parentFolderId: string): Promise<string> {
    const metadata = {
      name,
      mimeType: 'application/json',
      parents: [parentFolderId],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      throw new Error(`Drive create file failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.id;
  }
}
