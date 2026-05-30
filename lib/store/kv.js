// Minimal Vercel KV (Upstash Redis) client over the REST API — zero deps.
//
// Enabled when KV_REST_API_URL + KV_REST_API_TOKEN are present. Vercel injects
// both automatically once you create a KV store and link it to the project
// (Dashboard → Storage → Create → connect). Until then `kvEnabled` is false and
// every call no-ops, so callers transparently fall back to live data.
const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
export const kvEnabled = !!(BASE && TOKEN);

async function post(path, body) {
  const r = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`kv ${path || "cmd"} ${r.status}`);
  return r.json();
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
