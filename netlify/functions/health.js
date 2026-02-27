import { cors, normalizeHeaders, getKaixuKey } from "../../lib/http.js";
import { bool, opt } from "../../lib/env.js";
import { sql } from "../../lib/db.js";

export async function handler(event) {
  const origin = event.headers.origin || event.headers.Origin;
  const c = cors(typeof origin === "string" ? origin : undefined);

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: c, body: "" };

  try {
    // Optional: require key for health.
    const requireKey = bool("KAIXU_REQUIRE_KEY", true);
    if (requireKey) {
      const key = getKaixuKey(event.headers);
      if (!key) return { statusCode: 401, headers: { ...c, "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: "Missing Kaixu Key" }) };
    }

    let dbOk = false;
    try { await sql`SELECT 1 as ok;`; dbOk = true; } catch { dbOk = false; }

    // Upstream gateway health is allowed without auth.
    const gw = (opt("KAIXU_GATEWAY_ORIGIN", "https://skyesol.netlify.app").replace(/\/$/, "")) + "/.netlify/functions/health";
    let gwOk = false;
    try {
      const r = await fetch(gw, { method: "GET" });
      gwOk = r.ok;
    } catch { gwOk = false; }

    return {
      statusCode: 200,
      headers: { ...c, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: dbOk && gwOk, db: dbOk ? "ok" : "fail", gateway: gwOk ? "ok" : "fail" })
    };
  } catch (e) {
    return { statusCode: 200, headers: { ...c, "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: e?.message || String(e) }) };
  }
}
