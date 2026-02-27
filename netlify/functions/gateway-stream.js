export async function handler(event) {
  // This proxy preserves streaming by returning the upstream body as-is.
  // NOTE: Netlify Functions streaming behavior depends on runtime; this file
  // exists to match the gateway routing pattern across apps.

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,x-kaixu-key",
        "Access-Control-Max-Age": "86400"
      },
      body: ""
    };
  }

  const origin = (process.env.KAIXU_GATEWAY_ORIGIN || "https://skyesol.netlify.app").replace(/\/$/, "");
  const upstream = `${origin}/.netlify/functions/gateway-stream`;

  const res = await fetch(upstream, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": event.headers.authorization || event.headers.Authorization || ""
    },
    body: event.body || "{}"
  });

  const body = await res.text();
  return {
    statusCode: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    },
    body
  };
}
