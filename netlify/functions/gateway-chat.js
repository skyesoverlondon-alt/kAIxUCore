export async function handler(event) {
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
  const upstream = `${origin}/.netlify/functions/gateway-chat`;

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
      "Content-Type": res.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body
  };
}
