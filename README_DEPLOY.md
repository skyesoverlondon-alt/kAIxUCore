# kAIxU Brain — True Semantic RAG via kAIxuGateway13

This repo is a **database-backed brain** that stores hybrid memory and performs
**semantic retrieval** (pgvector) — but it obeys your hard rule:

✅ **All AI calls (chat + embeddings) route through kAIxuGateway13.**

No direct OpenAI/Anthropic/Gemini calls exist in this repo.

## Reality check

**Lord kAIxu, this must be deployed via Git or it will not be useful to you.**
It contains Netlify Functions, which require a Git-backed deploy.

## What you get

* **/api/brain** (POST) — Chat with hybrid memory + semantic RAG
* **/api/ingest-business** (POST) — Admin-only tenant knowledge ingestion
* **/api/health** (GET) — Health check (DB + gateway reachability)
* **/api/client-error-report** (POST) — Optional client error logging

Memory model:

* User isolated memory: `(userId + businessId)` stored in `conversations`
* Business tenant docs: `businessId` stored in `tenant_docs`
* Semantic retrieval: pgvector similarity search over stored embeddings

## 1) Neon DB (Netlify DB / Neon extension)

Recommended: install the **Neon extension** in Netlify for this site. That auto
creates and injects `NETLIFY_DATABASE_URL`.

Then apply `schema.sql` in the Neon SQL editor.

## 2) Required environment variables

### Brain security

* `KAIXU_ADMIN_TOKEN` (required) — protects `/api/ingest-business`
* `KAIXU_REQUIRE_KEY` (optional, default true) — if true, `/api/brain` requires a Kaixu Key

### Gateway routing

* `KAIXU_GATEWAY_ORIGIN` (optional) — defaults to `https://skyesol.netlify.app`
* `KAIXU_GATEWAY_PROVIDER` (optional) — defaults to `gemini`
* `KAIXU_GATEWAY_MODEL` (optional) — defaults to `gemini-2.0-flash`

### Embeddings (true semantic RAG)

* `KAIXU_EMBED_PROVIDER` (optional) — defaults to `gemini`
* `KAIXU_EMBED_MODEL` (optional) — defaults to `gemini-embedding-001`
* `KAIXU_EMBED_DIM` (optional) — defaults to `1536` (matches schema.sql VECTOR(1536))

### Database (one of these)

* `NETLIFY_DATABASE_URL` (preferred auto-injected)
* `NEON_DATABASE_URL` (fallback)

## 3) How the Kaixu Key flows

Your UI collects a **Kaixu Key** and sends it as `x-kaixu-key` to `/api/brain`.
The brain forwards it to:

* `/.netlify/functions/gateway-chat` → upstream `skyesol` gateway-chat
* `/.netlify/functions/gateway-embed` → upstream `skyesol` gateway-embed

Browser never calls `skyesol` directly (CORS rule).

## 4) Required upstream addition

To get "true semantic" embeddings, your upstream gateway must include:

* `https://skyesol.netlify.app/.netlify/functions/gateway-embed`

This repo includes a **GATEWAY_PATCH** folder with a reference implementation.
