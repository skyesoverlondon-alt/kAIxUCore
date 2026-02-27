import { sql, toPgVector } from "./db.js";

export async function getRecentMessages({ userId, businessId, limit }) {
  const rows = await sql`
    SELECT role, content
    FROM conversations
    WHERE user_id = ${userId} AND business_id = ${businessId}
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
  return (rows || []).reverse().map(r => ({ role: r.role, content: r.content }));
}

export async function retrieveHybrid({ userId, businessId, queryEmbedding, topUser, topDocs }) {
  const recentRows = await sql`
    SELECT role, content
    FROM conversations
    WHERE user_id = ${userId} AND business_id = ${businessId}
    ORDER BY created_at DESC
    LIMIT 12;
  `;
  const recentThread = (recentRows || []).reverse().map(r => `${String(r.role).toUpperCase()}: ${r.content}`).join("\n");

  let userHits = "";
  let docHits = "";

  if (Array.isArray(queryEmbedding) && queryEmbedding.length) {
    const qv = toPgVector(queryEmbedding);

    const userRows = await sql`
      SELECT role, content
      FROM conversations
      WHERE user_id = ${userId} AND business_id = ${businessId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${qv}::vector
      LIMIT ${topUser};
    `;
    userHits = (userRows || []).map(r => `${String(r.role).toUpperCase()}: ${r.content}`).join("\n");

    const docRows = await sql`
      SELECT title, content
      FROM tenant_docs
      WHERE business_id = ${businessId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${qv}::vector
      LIMIT ${topDocs};
    `;
    docHits = (docRows || []).map(r => (r.title ? `TITLE: ${r.title}\n${r.content}` : r.content)).join("\n\n---\n\n");
  }

  return { recentThread, userHits, docHits };
}

export function buildRagPacket({ recentThread, userHits, docHits }) {
  const policy = (process.env.RAG_POLICY || "").trim();
  return [
    "RAG CONTEXT PACKET (kAIxU)",
    "",
    "Rules:",
    "- Use TENANT DOCS as authoritative when relevant.",
    "- Use USER MEMORY to remain consistent with user-specific facts.",
    "- If context is empty/irrelevant, answer normally.",
    "- Never claim to have read external files unless content is included below.",
    "",
    "RECENT THREAD:",
    recentThread || "(none)",
    "",
    "TOP USER MEMORY HITS (semantic):",
    userHits || "(none)",
    "",
    "TOP TENANT MEMORY HITS (semantic):",
    docHits || "(none)",
    policy ? "\nRAG POLICY OVERRIDE:\n" + policy : ""
  ].join("\n");
}
