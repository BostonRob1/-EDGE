// Waitlist storage abstraction.
//
// When KV_REST_API_URL + KV_REST_API_TOKEN env vars are present (i.e. user
// has provisioned Vercel KV in the dashboard), this hits the real persistent
// store. Otherwise falls back to an in-memory map so the feature still works
// locally + the page renders correctly on first deploy before KV setup.
//
// Provisioning (5-min user task):
//   1. vercel.com → project → Storage → Create Database → KV
//   2. Auto-injects KV_* env vars into the deployment
//   3. Re-deploy (or wait for next push)
//   No code change needed — storage flips from memory to KV the moment env
//   vars are present.

const KV_URL = process.env.KV_REST_API_URL || null;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || null;
const USING_KV = Boolean(KV_URL && KV_TOKEN);

// ── In-memory fallback ───────────────────────────────────────────────
// Cold-starts wipe this. Acceptable for v0 demo. User flips to KV when ready.
const memStore = {
  count: 0,
  signups: new Map(), // wallet → signup record
  walletSet: new Set(),
  emailSet: new Set(),
  leaderboard: [], // [{ wallet, score }] sorted desc
};

// ── KV REST client ───────────────────────────────────────────────────
async function kv(command) {
  if (!USING_KV) throw new Error("KV_NOT_CONFIGURED");
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`kv ${r.status}`);
  const data = await r.json();
  return data.result;
}

// ── Public API ───────────────────────────────────────────────────────

// Returns the new position (1-indexed) after joining, or null if duplicate
export async function joinWaitlist({ wallet, email, referredBy }) {
  if (!wallet) throw new Error("wallet_required");

  if (USING_KV) {
    // Check duplicate
    const existing = await kv(["GET", `wl:signup:${wallet}`]);
    if (existing) {
      // Already on the list — return existing position
      const rec = JSON.parse(existing);
      return { position: rec.position, alreadyJoined: true };
    }

    // Increment global counter atomically
    const position = await kv(["INCR", "wl:count"]);
    const joined_at = Date.now();
    const record = {
      wallet,
      email: email || null,
      position,
      joined_at,
      referredBy: referredBy || null,
      score: 0,
      predictions: [],
    };

    await kv(["SET", `wl:signup:${wallet}`, JSON.stringify(record)]);
    await kv(["SADD", "wl:wallets", wallet]);
    if (email) await kv(["SADD", "wl:emails", email]);
    // Push to recent signups list (capped, oldest trimmed)
    await kv(["LPUSH", "wl:recent", JSON.stringify({ wallet, position, joined_at })]);
    await kv(["LTRIM", "wl:recent", "0", "49"]);
    if (referredBy) {
      await kv(["INCR", `wl:refs:${referredBy}`]);
    }
    return { position, alreadyJoined: false };
  }

  // In-memory path
  if (memStore.walletSet.has(wallet)) {
    const rec = memStore.signups.get(wallet);
    return { position: rec.position, alreadyJoined: true };
  }
  memStore.count += 1;
  const position = memStore.count;
  const record = {
    wallet,
    email: email || null,
    position,
    joined_at: Date.now(),
    referredBy: referredBy || null,
    score: 0,
    predictions: [],
  };
  memStore.signups.set(wallet, record);
  memStore.walletSet.add(wallet);
  if (email) memStore.emailSet.add(email);
  return { position, alreadyJoined: false };
}

export async function getStats() {
  if (USING_KV) {
    const [count, recent] = await Promise.all([
      kv(["GET", "wl:count"]).then((v) => Number(v) || 0),
      kv(["LRANGE", "wl:recent", "0", "9"]).then((arr) =>
        (arr || []).map((s) => {
          try { return JSON.parse(s); } catch { return null; }
        }).filter(Boolean)
      ),
    ]);
    return { count, recent, persistence: "kv" };
  }
  // In-memory
  const recent = [...memStore.signups.values()]
    .sort((a, b) => b.joined_at - a.joined_at)
    .slice(0, 10)
    .map((r) => ({ wallet: r.wallet, position: r.position, joined_at: r.joined_at }));
  return { count: memStore.count, recent, persistence: "memory" };
}

export async function getSignup(wallet) {
  if (!wallet) return null;
  if (USING_KV) {
    const raw = await kv(["GET", `wl:signup:${wallet}`]);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  return memStore.signups.get(wallet) || null;
}

export async function savePredictions(wallet, predictions) {
  if (!wallet) throw new Error("wallet_required");
  if (!Array.isArray(predictions)) throw new Error("predictions_required");

  if (USING_KV) {
    const raw = await kv(["GET", `wl:signup:${wallet}`]);
    if (!raw) throw new Error("not_on_waitlist");
    const rec = JSON.parse(raw);
    rec.predictions = predictions;
    rec.predicted_at = Date.now();
    // Score = (sum of confidence × difficulty) — finalized when markets resolve.
    // v0: projected_score uses |prediction.confidence - 0.5| × 2 as a proxy
    // for "how confident is the prediction." Higher confidence on contested
    // markets scores more.
    rec.projected_score = predictions.reduce(
      (s, p) => s + Math.max(0, Math.min(1, Math.abs((p.confidence ?? 0.5) - 0.5) * 2)),
      0
    );
    await kv(["SET", `wl:signup:${wallet}`, JSON.stringify(rec)]);
    await kv(["ZADD", "wl:lb", rec.projected_score, wallet]);
    return rec;
  }

  const rec = memStore.signups.get(wallet);
  if (!rec) throw new Error("not_on_waitlist");
  rec.predictions = predictions;
  rec.predicted_at = Date.now();
  rec.projected_score = predictions.reduce(
    (s, p) => s + Math.max(0, Math.min(1, Math.abs((p.confidence ?? 0.5) - 0.5) * 2)),
    0
  );
  // Maintain leaderboard
  memStore.leaderboard = memStore.leaderboard.filter((x) => x.wallet !== wallet);
  memStore.leaderboard.push({ wallet, score: rec.projected_score });
  memStore.leaderboard.sort((a, b) => b.score - a.score);
  return rec;
}

export async function getLeaderboard(limit = 20) {
  if (USING_KV) {
    const result = await kv(["ZREVRANGE", "wl:lb", "0", String(limit - 1), "WITHSCORES"]);
    const entries = [];
    if (Array.isArray(result)) {
      for (let i = 0; i < result.length; i += 2) {
        entries.push({ wallet: result[i], score: Number(result[i + 1]) });
      }
    }
    return entries;
  }
  return memStore.leaderboard.slice(0, limit);
}

export function isPersistent() {
  return USING_KV;
}
