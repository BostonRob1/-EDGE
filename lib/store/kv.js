// Minimal Vercel KV (Upstash Redis) client over the REST API — zero deps.
//
// Enabled when KV_REST_API_URL + KV_REST_API_TOKEN are present. Vercel injects
// both automatically once you create a KV store and link it to the project
// (Dashboard → Storage → Create → connect). Until then `kvEnabled` is false and
// every call no-ops, so callers transparently fall back to live data.
// Accept both naming conventions: Vercel KV injects KV_REST_API_*, while a
// direct Upstash integration injects UPSTASH_REDIS_REST_*. Either works.
const BASE = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const kvEnabled = !!(BASE && TOKEN);

async function post(path, body) {
  // Hard timeout so a slow KV never stalls a real-time endpoint.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`kv ${path || "cmd"} ${r.status}`);
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

// Single Redis command: kvCmd(["ZADD","key","100","member"]) → result value.
export async function kvCmd(args) {
  if (!kvEnabled) return null;
  const j = await post("", args);
  return j ? j.result : null;
}

// Pipelined commands: kvPipe([["HSET",...],["ZADD",...]]) → [result, result, …].
export async function kvPipe(cmds) {
  if (!kvEnabled || !cmds.length) return [];
  const j = await post("pipeline", cmds);
  return Array.isArray(j) ? j.map((x) => (x && "result" in x ? x.result : null)) : [];
}
