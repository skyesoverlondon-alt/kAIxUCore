export function opt(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || v === "") ? fallback : v;
}

export function must(name) {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") throw new Error(`Missing env var: ${name}`);
  return v;
}

export function bool(name, fallback = false) {
  const v = process.env[name];
  if (!v) return fallback;
  const s = String(v).trim().toLowerCase();
  return ["1","true","yes","on"].includes(s);
}

export function int(name, fallback) {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
