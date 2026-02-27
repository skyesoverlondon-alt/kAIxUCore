-- kAIxU Brain (Gateway Semantic RAG)
-- Storage: Netlify Neon (Postgres) + pgvector
-- Embeddings: generated ONLY via kAIxuGateway13 (server-side) and stored here.
--
-- IMPORTANT: This schema sets VECTOR(1536) so you can use Gemini Embedding with
-- outputDimensionality=1536 (recommended by Google) and also align with many
-- OpenAI-compatible 1536-dim embedding models.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  session_id TEXT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  embedding VECTOR(1536) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_scope_time_idx
  ON conversations (user_id, business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversations_embedding_ivfflat
  ON conversations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


CREATE TABLE IF NOT EXISTS tenant_docs (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL,
  doc_id TEXT NULL,
  title TEXT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1536) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenant_docs_scope_time_idx
  ON tenant_docs (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tenant_docs_embedding_ivfflat
  ON tenant_docs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


CREATE TABLE IF NOT EXISTS client_errors (
  id BIGSERIAL PRIMARY KEY,
  where_from TEXT NOT NULL,
  error_text TEXT NOT NULL,
  at_iso TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
