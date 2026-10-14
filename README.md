# Hearth

> **A quiet workspace for thinking with AI.**
> Created by **Aarush Gupta**

Hearth is a minimal, distraction-free AI chat web application built for small-scale public testing (20–50 users). It features isolated user data persistence directly inside each user's personal Google Drive, an owner-managed server-side AI API key pool with automatic failover, and strict transactional enforcement of a 5-response testing allowance.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       HEARTH CLIENT                         │
│  - Minimalist Dark UI (Geist typography & ember accents)   │
│  - Firebase Google Auth (Scope: drive.file)                 │
│  - Direct personal Google Drive storage client              │
│  - Real-time SSE chat streaming & markdown code blocks      │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  USER'S OWN GOOGLE DRIVE     │    │   HEARTH FULL-STACK SERVER   │
│  - Hearth/                   │    │  (Express / Next.js Vercel)  │
│    - conversations_index.json│    │                              │
│    - Conversations/conv_*.json│   │  - Strict 5-response quota   │
│    - preferences.json        │    │    atomic reservation/commit │
│  * Complete user isolation   │    │  - Owner API Key Pool        │
│  * No shared server storage  │    │  - Automatic key failover    │
└──────────────────────────────┘    │  - Cooldown & health monitor │
                                    └──────────────┬───────────────┘
                                                   │
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │    AI PROVIDER (GEMINI)      │
                                    │  - Owner keys (GEMINI_KEY,   │
                                    │    AI_API_KEY_1..N)          │
                                    │  - Never sent to client      │
                                    └──────────────────────────────┘
```

---

## Key Features

1. **Google Drive Storage Layer**:
   - Every user's conversations, messages, titles, and preferences are stored directly in **their own personal Google Drive** under a dedicated `Hearth` folder.
   - Hearth uses the narrowest suitable scope: `https://www.googleapis.com/auth/drive.file` (only accesses files created by Hearth).
   - No user conversations or messages are stored on shared application databases or servers.

2. **Supabase Completely Removed**:
   - Zero Supabase libraries, database tables, or cookies.
   - Authentication is powered by Google OAuth (via Firebase client SDK).
   - Operational state is managed by a transactional ACID operational store (or Vercel Postgres).

3. **Owner-Provided API Key Pool**:
   - Users never supply an API key or pay.
   - The application owner supplies multiple keys (`GEMINI_API_KEY`, `AI_API_KEY_1`, `AI_API_KEY_2`, etc.).
   - The server maintains a health registry: if a key encounters rate limits (429) or transient provider outages, it enters a temporary cooldown and Hearth automatically fails over to the next eligible key.
   - Keys NEVER leave the server.

4. **Five-Response Testing Limit**:
   - Each authenticated account receives exactly **5 successful AI responses** during the initial public testing period.
   - Enforced server-side with atomic quota reservation: failed requests or client aborts do not consume allowance.
   - When 5 responses are reached, the composer locks with the message:
     *"You've used all five free test responses. Thanks for trying Hearth."*

5. **Owner Operations Dashboard**:
   - Protected monitor accessible to Aarush Gupta (`aarush5732@gmail.com`).
   - Live view of registered users, messages used, key slot statuses, and real-time sanitized operational logs.
   - Built-in QA quota reset tool for rapid testing.

---

## Environment Variables

| Variable | Provider / Purpose | Default Model | Free Limits |
|---|---|---|---|
| `GEMINI_API_KEY` | Google Gemini (Primary) | `gemini-3.8-flash` | 15 RPM / 1500 RPD |
| `GROQ_API_KEY` | Groq Cloud | `llama-3.3-70b-versatile` | 30 RPM / 14.4k RPD |
| `CEREBRAS_API_KEY` | Cerebras Wafer-Scale | `llama3.3-70b` | 30 RPM / 1M tokens/day |
| `SAMBANOVA_API_KEY` | SambaNova Cloud | `Meta-Llama-3.3-70B-Instruct` | 20 RPM |
| `OPENROUTER_API_KEY` | OpenRouter Free Tier | `deepseek/deepseek-r1:free` | 20 RPM / 200 RPD |
| `MISTRAL_API_KEY` | Mistral AI | `mistral-small-latest` | 60 RPM |
| `GITHUB_TOKEN` | GitHub Models | `gpt-4o-mini` | 15 RPM / 150 RPD |
| `AI_API_KEY_1`..`20` | Generic Key Pool Slots | Matches configured slot | Automatic failover |
| `OWNER_EMAIL` | Aarush Gupta | `aarush5732@gmail.com` | Owner monitoring |
| `POSTGRES_URL` | Optional | Connection string for Vercel Postgres / Neon |

---

## Deployment to Vercel

1. Push this repository to GitHub.
2. Import the repository into **Vercel**.
3. Add your environment variables in Vercel Project Settings > Environment Variables:
   - `GEMINI_API_KEY`
   - `AI_API_KEY_1`, `AI_API_KEY_2` (if configuring multiple keys)
   - `OWNER_EMAIL=aarush5732@gmail.com`
4. In Google Cloud Console (APIs & Services > Credentials):
   - Add your production Vercel URL (`https://your-app.vercel.app`) to **Authorized JavaScript origins**.
   - Ensure the **Google Drive API** is enabled in your Google Cloud project.
5. Deploy.
