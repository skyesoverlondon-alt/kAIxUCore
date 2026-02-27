import { cors, safeJson } from "../../lib/http.js";
import { sql } from "../../lib/db.js";

export async function handler(event) {
  const origin = event.headers.origin || event.headers.Origin;
  const c = cors(typeof origin === "string" ? origin : undefined);

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: c, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: c, body: JSON.stringify({ error: "Method Not Allowed" }) };

  try {
    const body = safeJson(event.body) || {};
    const where = String(body.where || "unknown");
    const error = String(body.error || "");
    const at = String(body.at || new Date().toISOString());

    await sql`
      INSERT INTO client_errors (where_from, error_text, at_iso)
      VALUES (${where}, ${error}, ${at});
    `;

    return { statusCode: 200, headers: { ...c, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 200, headers: { ...c, "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: e?.message || String(e) }) };
  }
}
