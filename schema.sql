-- kAIxU Core Brain (Fortune Edition)
--
-- This schema defines the storage for user/assistant conversations,
-- tenant‑specific documents and optional client error logs. The
-- `vector` extension is required for semantic search. Adjust the
-- dimension size in the `VECTOR(N)` types if you use a model with a
-- different embedding dimension.

CREATE EXTENSION IF NOT EXISTS vector;

-- Conversation history: one row per message. Each row includes a
-- user identifier, a tenant identifier, an optional session tag, the
-- role (user or assistant), the raw message content, an optional
-- embedding vector and timestamps. Retrieval queries filter by
-- user_id and business_id.
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  session_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_scope_time_idx
  ON conversations (user_id, business_id, created_at DESC);

-- Vector index for faster similarity search. After bulk loading,
-- consider running ANALYZE on this table to update planner stats.
CREATE INDEX IF NOT EXISTS conversations_embedding_ivfflat
  ON conversations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Tenant documents: stored per business. Each row holds a document
-- identifier, title, raw content, optional JSON metadata, an optional
-- embedding vector and timestamps.
CREATE TABLE IF NOT EXISTS tenant_docs (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL,
  doc_id TEXT,
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenant_docs_scope_time_idx
  ON tenant_docs (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tenant_docs_embedding_ivfflat
  ON tenant_docs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Optional table for logging client side errors. Populated via
-- `/api/client-error-report`. Use this to monitor UI issues.
CREATE TABLE IF NOT EXISTS client_errors (
  id BIGSERIAL PRIMARY KEY,
  where_from TEXT NOT NULL,
  error_text TEXT NOT NULL,
  at_iso TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);