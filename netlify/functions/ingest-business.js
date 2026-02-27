import { cors, safeJson, normalizeHeaders, requireKaixuKey } from "../../lib/http.js";
import { sql, toPgVector } from "../../lib/db.js";
import { must, opt, int } from "../../lib/env.js";
import { gatewayEmbed, embedDefaults } from "../../lib/gatewayClient.js";

function selfBase(event) {
  const h = normalizeHeaders(event.headers || {});
  const proto = h["x-forwarded-proto"] || "https";
  const host = h["host"];
  return host ? `${proto}://${host}` : "";
}

function requireAdmin(headers) {
  const expected = must("KAIXU_ADMIN_TOKEN");
  const h = normalizeHeaders(headers);
  const got = h["x-kaixu-admin"] || (h["authorization"]?.startsWith("Bearer ") ? h["authorization"].slice("Bearer ".length) : "");
  if (got !== expected) {
    const err = new Error("Unauthorized: missing/invalid admin token");
    err.statusCode = 401;
    throw err;
  }
}

export async function handler(event) {
  const origin = event.headers.origin || event.headers.Origin;
  const c = cors(typeof origin === "string" ? origin : undefined);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: c, body: "" };

  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, headers: c, body: JSON.stringify({ error: "Method Not Allowed" }) };

    requireAdmin(event.headers);

    const kaixuKey = requireKaixuKey(event.headers);

    const body = safeJson(event.body);
    if (!body) return { statusCode: 400, headers: c, body: JSON.stringify({ error: "Invalid JSON body" }) };

    const businessId = String(body.businessId || "").trim();
    const content = String(body.content || "").trim();
    const title = body.title ? String(body.title).trim() : null;
    const docId = body.docId ? String(body.docId).trim() : null;
    const metadata = (body.metadata && typeof body.metadata === "object") ? body.metadata : {};

    if (!businessId || !content) {
      return { statusCode: 400, headers: c, body: JSON.stringify({ error: "Required fields: businessId, content" }) };
    }

    const base = selfBase(event);
    if (!base) throw new Error("Unable to compute site base URL");
    const embedUrl = `${base}/.netlify/functions/gateway-embed`;

    const embedCfg = embedDefaults();
    const emb = await gatewayEmbed({
      kaixuKey,
      viaUrl: embedUrl,
      provider: embedCfg.provider,
      model: embedCfg.model,
      input: content,
      taskType: "RETRIEVAL_DOCUMENT",
      title: title || "Tenant document",
      outputDimensionality: embedCfg.outputDimensionality
    });

    if (!emb.res.ok) {
      const err = new Error(emb.data?.error || `Embedding failed (HTTP ${emb.res.status})`);
      err.statusCode = emb.res.status;
      throw err;
    }

    const embedding = (emb.data?.embeddings && Array.isArray(emb.data.embeddings[0])) ? emb.data.embeddings[0] : null;

    await sql`
      INSERT INTO tenant_docs (business_id, doc_id, title, content, metadata, embedding)
      VALUES (${businessId}, ${docId}, ${title}, ${content}, ${JSON.stringify(metadata)}::jsonb, ${embedding ? toPgVector(embedding) : null}::vector);
    `;

    return { statusCode: 200, headers: { ...c, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const statusCode = typeof e?.statusCode === "number" ? e.statusCode : 500;
    return { statusCode, headers: { ...c, "Content-Type": "application/json" }, body: JSON.stringify({ error: e?.message || String(e) }) };
  }
}
