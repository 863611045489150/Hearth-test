-- Hearth Operational Store Schema
-- Compatible with Vercel Postgres / Neon / PostgreSQL
-- Manages five-message test counters, key assignments, and key health states.
-- Note: User chat conversations and messages are stored in each user's personal Google Drive.

CREATE TABLE IF NOT EXISTS hearth_users (
    user_id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(255),
    total_used INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    max_allowed INTEGER NOT NULL DEFAULT 5,
    assigned_slot INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_quota_positive CHECK (total_used >= 0 AND reserved >= 0)
);

CREATE TABLE IF NOT EXISTS hearth_key_health (
    slot INTEGER PRIMARY KEY,
    provider VARCHAR(64) NOT NULL DEFAULT 'gemini',
    model VARCHAR(64) NOT NULL DEFAULT 'gemini-2.5-flash',
    status VARCHAR(32) NOT NULL DEFAULT 'healthy', -- 'healthy', 'cooldown', 'invalid'
    failure_count INTEGER NOT NULL DEFAULT 0,
    cooldown_until TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hearth_operational_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'info', 'warning', 'error', 'success'
    details JSONB
);

-- Index for quick quota lookup
CREATE INDEX IF NOT EXISTS idx_hearth_users_email ON hearth_users(email);
CREATE INDEX IF NOT EXISTS idx_hearth_key_health_status ON hearth_key_health(status);
