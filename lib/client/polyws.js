// Polymarket live price stream — the real-time tier.
//
// Connects the BROWSER directly to Polymarket's public CLOB market socket (no
// auth, no server needed — perfect for a static site) and pushes sub-second
// YES/NO price updates for the subscribed token ids. The 5s poll stays the
// baseline source of truth; this just makes the in-between ticks live and
// flashing. Silent, self-healing fallback: if the socket can't connect or
// drops, it retries and polling carries the data meanwhile — nothing breaks.
//
// Message shape (verified live):
//   price_change      → { price_changes: [{ asset_id, best_bid, best_ask }] }
//   last_trade_price  → { asset_id, price }

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

export function createPolyStream(onPrice) {
  if (typeof WebSocket === "undefined") return { setTokens() {} };
  let ws = null;
  let tokens = [];
  let reconnectT = null;
  let closed = false;

  const mid = (bid, ask) => {
    const b = Number(bid), a = Number(ask);
    return Number.isFinite(b) && Number.isFinite(a) && a > 0 ? (b + a) / 2 : null;
  };

  function handle(m) {
    if (!m || !m.event_type) return;
    if (m.event_type === "price_change" && Array.isArray(m.price_changes)) {
      for (const pc of m.price_changes) {
        const p = mid(pc.best_bid, pc.best_ask);
        if (pc.asset_id && p != null) onPrice(String(pc.asset_id), p);
      }
    } else if (m.event_type === "last_trade_price" && m.asset_id) {
      const p = Number(m.price);
      if (Number.isFinite(p)) onPrice(String(m.asset_id), p);
    }
  }

  function connect() {
    if (closed) return;
    try { ws = new WebSocket(WS_URL); } catch { return scheduleReconnect(); }
    ws.onopen = sub;
    ws.onmessage = (e) => {
      let d; try { d = JSON.parse(e.data); } catch { return; }
      (Array.isArray(d) ? d : [d]).forEach(handle);
    };
    ws.onclose = scheduleReconnect;
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  function sub() {
    if (ws && ws.readyState === 1 && tokens.length) {
      ws.send(JSON.stringify({ type: "market", assets_ids: tokens }));
    }
  }
  function scheduleReconnect() {
    if (reconnectT || closed) return;
    reconnectT = setTimeout(() => { reconnectT = null; connect(); }, 4000);
  }

  connect();
  return {
    setTokens(list) { tokens = (list || []).map(String).filter(Boolean); sub(); },
    close() { closed = true; try { ws && ws.close(); } catch {} },
  };
}
