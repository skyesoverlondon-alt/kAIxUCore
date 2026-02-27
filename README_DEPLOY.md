# kAIxU Core Brain (Fortune Edition)

This repository packages an enterprise‑grade knowledge brain that
combines hybrid conversation memory, tenant‑scoped document storage,
semantic search with pgvector, and a simple yet polished user interface.

The **hybrid memory model** ensures that every end user has isolated
conversation context while each business tenant maintains its own
knowledge base. Retrieval augments prompts with both recent history and
relevant documents via vector similarity search. A single API handles
chat, while administrative endpoints support ingestion and health
monitoring.

## Deployment overview

1. **Unpack and commit** this repository into your own GitHub
   repository or Codespace. Netlify functions require a Git‑backed
   deployment.

2. **Create a Neon database**. The `schema.sql` file defines the
   required tables and indexes. Execute its contents against your
   database. Make sure the `vector` extension is enabled.

3. **Provision API keys**. Copy `.env.example` to `.env` and fill in
   `NEON_DATABASE_URL` along with LLM and embedding settings. Also set
   `KAIXU_ADMIN_TOKEN` and optionally `KAIXU_PUBLIC_API_KEY`.

4. **Import to Netlify**. On the Netlify dashboard select “Import
   from Git”. Set the build command to `npm install` (Netlify will
   automatically install dependencies) and leave the publish directory
   blank; the functions directory is set in `netlify.toml`.

5. **Configure environment variables**. In your Netlify site settings
   add all variables defined in your `.env` file. At minimum this
   includes `NEON_DATABASE_URL`, `LLM_API_KEY` (or a custom endpoint),
   `EMBED_API_KEY`, and `KAIXU_ADMIN_TOKEN`.

6. **Test the brain**. Open the deployed site and use the built‑in
   client to ping `/api/health`, send messages to `/api/brain`, and
   ingest tenant documents via `/api/ingest-business`.

## API summary

* **POST `/api/brain`** — main chat endpoint. Expects a JSON body
  with `userId`, `businessId` and `message`. Optional `sessionId`
  allows grouping of conversations. Returns an assistant reply.

* **POST `/api/ingest-business`** — admin‑only ingestion endpoint. Use
  the `KAIXU_ADMIN_TOKEN` via an `Authorization: Bearer <token>` header
  or an `x‑kaixu‑admin` header. Accepts `businessId`, `content`, and
  optional `title`, `docId` and `metadata` fields. Stores documents
  and their vector embeddings for semantic recall.

* **GET `/api/health`** — returns a JSON object indicating whether
  database connectivity, embeddings and language model services are
  operational. Requires the public API key if one is set.

* **POST `/api/client-error-report`** — optional endpoint that allows
  client side code to report UI errors for debugging. This function
  writes to a `client_errors` table if present.

## Database schema

The `schema.sql` file defines three tables:

* `conversations` — stores end‑user and assistant messages along with
  optional embeddings and timestamps. Partitioning is based on
  `user_id` and `business_id`.
* `tenant_docs` — stores business‑scoped documents with vector
  embeddings for semantic search.
* `client_errors` — optional table for logging client‑side errors.

If you change the embedding model dimension, adjust the `VECTOR(N)`
size in the schema accordingly.