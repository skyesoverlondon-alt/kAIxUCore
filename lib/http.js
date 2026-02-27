export function cors(origin) {
  const allow = process.env.CORS_ALLOW_ORIGIN || "*";
  const allowOrigin = (allow === "*")
    ? "*"
    : (origin && allow.split(",").map(s => s.trim()).includes(origin) ? origin : allow.split(",")[0].trim());

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-kaixu-key,x-kaixu-admin",
    "Access-Control-Max-Age": "86400"
  };
}

export function normalizeHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) out[String(k).toLowerCase()] = v;
  return out;
}

export function safeJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getKaixuKey(headers) {
  const h = normalizeHeaders(headers);
  return h["x-kaixu-key"] || (h["authorization"]?.startsWith("Bearer ") ? h["authorization"].slice("Bearer ".length) : "");
}

export function requireKaixuKey(headers) {
  const key = getKaixuKey(headers);
  if (!key) {
    const err = new Error("Missing Kaixu Key (x-kaixu-key)");
    err.statusCode = 401;
    throw err;
  }
  return key;
}
