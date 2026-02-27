import { neon } from "@netlify/neon";

// Prefer Netlify DB injection (NETLIFY_DATABASE_URL). Fall back to manual
// NEON_DATABASE_URL if you're not using the extension.
const override = process.env.NEON_DATABASE_URL || "";
export const sql = override ? neon(override) : neon();

export function toPgVector(arr) {
  if (!Array.isArray(arr)) return "[]";
  return `[${arr.map(n => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}
