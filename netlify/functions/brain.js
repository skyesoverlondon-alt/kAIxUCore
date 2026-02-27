import { cors, safeJson, normalizeHeaders, requireKaixuKey, getKaixuKey } from "../../lib/http.js";
import { bool, int } from "../../lib/env.js";
import { sql, toPgVector } from "../../lib/db.js";
import { SYSTEM_PROMPT } from "../../lib/systemPrompt.js";
import { retrieveHybrid, getRecentMessages, buildRagPacket } from "../../lib/rag.js";
import { defaults, embedDefaults, gatewayChat, gatewayEmbed } from "../../lib/gatewayClient.js";

function selfBase(event) {
  const h = normalizeHeaders(event.headers || {});
  const proto = h["x-forwarded-proto"] || "https";
  const host = h["host"];
  return host ? `${proto}://${host}` : "";
}

export async function handler(event) {
  const origin = event.headers.origin || event.headers.Origin;
  const c = cors(typeof origin === "string" ? origin : undefined);

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: c, body: "" };

  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: c, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const requireKey = bool("KAIXU_REQUIRE_KEY", true);
    const kaixuKey = requireKey ? requireKaixuKey(event.headers) : getKaixuKey(event.headers);

    const body = safeJson(event.body);
    if (!body) return { statusCode: 400, headers: c, body: JSON.stringify({ error: "Invalid JSON body" }) };

    const userId = String(body.userId || "").trim();
    const businessId = String(body.businessId || "").trim();
    const message = String(body.message || "").trim();
    const sessionId = body.sessionId ? String(body.sessionId) : null;

    if (!userId || !businessId || !message) {
      return { statusCode: 400, headers: c, body: JSON.stringify({ error: "Required fields: userId, businessId, message" }) };
    }

    const base = selfBase(event);
    if (!base) throw new Error("Unable to compute site base URL");

    const chatUrl = `${base}/.netlify/functions/gateway-chat`;
    const embedUrl = `${base}/.netlify/functions/gateway-embed`;

    const embedCfg = embedDefaults();
    const chatCfg = defaults();

    // 1) Embed the query via gateway (true semantic RAG).
    const embRes = await gatewayEmbed({
      kaixuKey,
      viaUrl: embedUrl,
      provider: embedCfg.provider,
      model: embedCfg.model,
      input: message,
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: embedCfg.outputDimensionality
    });

    if (!embRes.res.ok) {
      const status = embRes.res.status;
      const err = new Error(embRes.data?.error || `Embedding failed (HTTP ${status})`);
      err.statusCode = status;
      throw err;
    }

    const queryEmbedding = (embRes.data?.embeddings && Array.isArray(embRes.data.embeddings[0]))
      ? embRes.data.embeddings[0]
      : (Array.isArray(embRes.data?.embedding) ? embRes.data.embedding : null);

    // 2) Retrieve hybrid context using pgvector.
    const ctx = await retrieveHybrid({
      userId,
      businessId,
      queryEmbedding,
      topUser: int("RAG_TOPK_USER", 6),
      topDocs: int("RAG_TOPK_BIZ", 8)
    });

    // 3) Pull recent thread as actual chat messages.
    const recentMessages = await getRecentMessages({ userId, businessId, limit: int("THREAD_LIMIT", 10) });
    const ragPacket = buildRagPacket({ recentThread: ctx.recentThread, userHits: ctx.userHits, docHits: ctx.docHits });

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: ragPacket },
      ...recentMessages,
      { role: "user", content: message }
    ];

    // 4) Store user message (with embedding).
    await sql`
      INSERT INTO conversations (user_id, business_id, session_id, role, content, embedding)
      VALUES (${userId}, ${businessId}, ${sessionId}, 'user', ${message}, ${queryEmbedding ? toPgVector(queryEmbedding) : null}::vector);
    `;

    // 5) Chat via gateway.
    const chatRes = await gatewayChat({
      kaixuKey,
      viaUrl: chatUrl,
      provider: chatCfg.provider,
      model: chatCfg.model,
      messages,
      max_tokens: chatCfg.max_tokens,
      temperature: chatCfg.temperature
    });

    const status = chatRes.res.status;
    if (!chatRes.res.ok) {
      const msg = chatRes.data?.error || `Chat failed (HTTP ${status})`;
      const err = new Error(msg);
      err.statusCode = status;
      throw err;
    }

    const reply = String(chatRes.data?.output_text || "").trim();
    if (!reply) throw new Error("Gateway response missing output_text");

    // 6) Embed assistant reply (optional, but recommended for stronger recall).
    let replyEmbedding = null;
    if (bool("EMBED_ASSISTANT", true)) {
      const maxChars = int("EMBED_ASSISTANT_MAX_CHARS", 4500);
      if (reply.length <= maxChars) {
        const e2 = await gatewayEmbed({
          kaixuKey,
          viaUrl: embedUrl,
          provider: embedCfg.provider,
          model: embedCfg.model,
          input: reply,
          taskType: "RETRIEVAL_DOCUMENT",
          title: "Assistant message",
          outputDimensionality: embedCfg.outputDimensionality
        });
        if (e2.res.ok) {
          replyEmbedding = (e2.data?.embeddings && Array.isArray(e2.data.embeddings[0])) ? e2.data.embeddings[0] : null;
        }
      }
    }

    // 7) Store assistant reply.
    await sql`
      INSERT INTO conversations (user_id, business_id, session_id, role, content, embedding)
      VALUES (${userId}, ${businessId}, ${sessionId}, 'assistant', ${reply}, ${replyEmbedding ? toPgVector(replyEmbedding) : null}::vector);
    `;

    // 8) Return reply + budget/usage.
    const month = chatRes.data?.month || null;
    const usage = chatRes.data?.usage || null;
    const remaining_cents = (month && typeof month.cap_cents === "number" && typeof month.spent_cents === "number")
      ? Math.max(0, month.cap_cents - month.spent_cents)
      : null;

    return {
      statusCode: 200,
      headers: { ...c, "Content-Type": "application/json" },
      body: JSON.stringify({ reply, usage, month, remaining_cents })
    };
  } catch (e) {
    const statusCode = typeof e?.statusCode === "number" ? e.statusCode : 500;
    return {
      statusCode,
      headers: { ...c, "Content-Type": "application/json" },
      body: JSON.stringify({ error: e?.message || String(e) })
    };
  }
}
