import { opt, int } from "./env.js";

// Gateway origin is fixed by your directive.
export function gatewayOrigin() {
  return opt("KAIXU_GATEWAY_ORIGIN", "https://skyesol.netlify.app").replace(/\/$/, "");
}

export async function gatewayChat({ kaixuKey, messages, provider, model, max_tokens, temperature, viaUrl }) {
  const url = viaUrl;
  const payload = {
    provider,
    model,
    messages,
    max_tokens,
    temperature
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${kaixuKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function gatewayEmbed({ kaixuKey, input, provider, model, taskType, title, outputDimensionality, viaUrl }) {
  const url = viaUrl;
  const payload = {
    provider,
    model,
    input,
    taskType,
    title,
    outputDimensionality
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${kaixuKey}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export function defaults() {
  return {
    provider: opt("KAIXU_GATEWAY_PROVIDER", "gemini"),
    model: opt("KAIXU_GATEWAY_MODEL", "gemini-2.0-flash"),
    max_tokens: int("KAIXU_GATEWAY_MAX_TOKENS", 1200),
    temperature: Number(opt("KAIXU_GATEWAY_TEMPERATURE", "0.7"))
  };
}

export function embedDefaults() {
  return {
    provider: opt("KAIXU_EMBED_PROVIDER", "gemini"),
    model: opt("KAIXU_EMBED_MODEL", "gemini-embedding-001"),
    outputDimensionality: int("KAIXU_EMBED_DIM", 1536)
  };
}
