/**
 * Hearth Full-Stack Express Server
 * Serves API routes for quota management, owner key pool execution,
 * operational health registry, and mounts Vite in dev mode.
 */

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { operationalStore } from './src/server/operationalStore';
import { aiAdapter } from './src/server/aiAdapter';
import { keyPoolManager } from './src/server/keyPool';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_DEV = process.env.NODE_ENV !== 'production';
const OWNER_EMAIL = 'aarush5732@gmail.com';

app.use(express.json({ limit: '5mb' }));

/**
 * CORS and security headers
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Hearth',
    version: '1.0.0',
    keysConfigured: keyPoolManager.getTotalKeysCount(),
    timestamp: Date.now(),
  });
});

/**
 * Get user quota status
 */
app.get('/api/user/quota', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || req.headers['x-user-id'] as string;
    const email = (req.query.email as string) || req.headers['x-user-email'] as string;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const quota = await operationalStore.getUserQuota(userId, email);
    res.json(quota);
  } catch (err: any) {
    console.error('[API] /api/user/quota error:', err);
    res.status(500).json({ error: 'Failed to retrieve usage quota' });
  }
});

/**
 * Non-streaming chat generation endpoint
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  const { userId, email, messages, systemInstruction } = req.body;

  if (!userId || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: userId and messages array are required' });
  }

  // 1. Transactional atomic reservation
  const reservation = await operationalStore.reserveQuota(userId, email);
  if (!reservation.success) {
    return res.status(403).json({
      error: reservation.error || "You've used all five free test responses. Thanks for trying Hearth.",
      quotaExhausted: true,
      remaining: reservation.remaining,
    });
  }

  try {
    // 2. Generate with failover across owner keys
    const result = await aiAdapter.generateWithFailover(userId, messages, systemInstruction);

    // 3. Commit quota
    const updatedQuota = await operationalStore.commitQuota(userId);

    res.json({
      text: result.text,
      modelUsed: result.modelUsed,
      remaining: updatedQuota.remaining,
      totalUsed: updatedQuota.totalUsed,
      maxAllowed: updatedQuota.maxAllowed,
    });
  } catch (err: any) {
    // 4. Rollback reservation on failure
    await operationalStore.rollbackQuota(userId, err?.message);
    console.error('[API] /api/chat generation failed:', err?.message || err);
    res.status(500).json({
      error: err?.message || 'Temporary AI generation failure. No test response was consumed.',
    });
  }
});

/**
 * Streaming chat generation endpoint (Server-Sent Events)
 */
app.post('/api/chat/stream', async (req: Request, res: Response) => {
  const { userId, email, messages, systemInstruction } = req.body;

  if (!userId || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: userId and messages array are required' });
  }

  // 1. Transactional atomic reservation
  const reservation = await operationalStore.reserveQuota(userId, email);
  if (!reservation.success) {
    return res.status(403).json({
      error: reservation.error || "You've used all five free test responses. Thanks for trying Hearth.",
      quotaExhausted: true,
      remaining: reservation.remaining,
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let committed = false;

  // If client disconnects unexpectedly, rollback quota
  req.on('close', async () => {
    if (!committed) {
      await operationalStore.rollbackQuota(userId, 'Client disconnected during generation');
    }
  });

  try {
    const result = await aiAdapter.generateWithFailover(
      userId,
      messages,
      systemInstruction,
      (chunkText) => {
        res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
      }
    );

    committed = true;
    const updatedQuota = await operationalStore.commitQuota(userId);

    res.write(
      `data: ${JSON.stringify({
        done: true,
        modelUsed: result.modelUsed,
        remaining: updatedQuota.remaining,
        totalUsed: updatedQuota.totalUsed,
      })}\n\n`
    );
    res.end();
  } catch (err: any) {
    if (!committed) {
      await operationalStore.rollbackQuota(userId, err?.message);
    }
    console.error('[API] /api/chat/stream failed:', err?.message || err);
    res.write(
      `data: ${JSON.stringify({
        error: err?.message || 'Generation failed. No allowance consumed.',
      })}\n\n`
    );
    res.end();
  }
});

/**
 * Owner operational monitor stats (Aarush Gupta only)
 */
app.get('/api/owner/stats', async (req: Request, res: Response) => {
  const userEmail = (req.query.email as string) || (req.headers['x-user-email'] as string);
  const secret = (req.query.secret as string) || (req.headers['x-owner-secret'] as string);

  // Allow owner email or local development inspection
  const isOwner = userEmail === OWNER_EMAIL || (IS_DEV && !userEmail) || secret === process.env.OWNER_SECRET;
  if (!isOwner && userEmail !== OWNER_EMAIL) {
    return res.status(403).json({ error: 'Access restricted to application owner' });
  }

  const stats = await operationalStore.getOwnerStats();
  res.json(stats);
});

/**
 * Get Free LLM providers catalog from awesome-freellm-apis
 */
app.get('/api/owner/providers', async (req: Request, res: Response) => {
  const { FREE_LLM_PROVIDERS } = await import('./src/server/freeLlmCatalog');
  res.json({
    presets: Object.values(FREE_LLM_PROVIDERS),
    configuredKeys: keyPoolManager.getKeysSummary(),
  });
});

/**
 * Owner tool to reset a test user's quota during testing
 */
app.post('/api/owner/reset-quota', async (req: Request, res: Response) => {
  const userEmail = (req.body.ownerEmail as string) || (req.headers['x-user-email'] as string);
  const targetUserId = req.body.targetUserId;

  if (userEmail !== OWNER_EMAIL && !IS_DEV) {
    return res.status(403).json({ error: 'Owner permission required' });
  }

  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId required' });
  }

  const updatedQuota = await operationalStore.resetUserQuota(targetUserId);
  res.json({ success: true, updatedQuota });
});

/**
 * Mount Vite in dev mode or serve static files in prod
 */
async function startServer() {
  if (IS_DEV) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hearth] Server listening on port ${PORT} (dev: ${IS_DEV})`);
  });
}

startServer().catch((err) => {
  console.error('[Hearth] Failed to start server:', err);
  process.exit(1);
});
