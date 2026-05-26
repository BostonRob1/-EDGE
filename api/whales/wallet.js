import { fetchPositions, fetchValue, fetchTrades, tradeUsd } from "../../lib/whales/polymarket-data.js";

// Per-wallet detail. Composes positions + value + recent trades into one
// payload so the UI fires a single request.
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const user = (url.searchParams.get("user") || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(user)) {
    res.status(400).json({ error: "invalid_wallet", detail: "Pass ?user=0x… (40 hex)." });
    return;
  }

  const [positionsR, valueR, tradesR] = await Promise.allSettled([
    fetchPositions({ user, limit: 100 }),
    fetchValue(user),
    fetchTrades({ user, limit: 25 }),
  ]);

  const positions =
    positionsR.status === "fulfilled" && Array.isArray(positionsR.value)
      ? positionsR.value
          .map((p) => ({
            asset: p.asset,
            condition_id: p.conditionId,
            outcome: p.outcome,
            outcome_index: p.outcomeIndex,
            opposite_outcome: p.oppositeOutcome,
            size: Number(p.size) || 0,
            avg_price: Number(p.avgPrice) || 0,
            cur_price: Number(p.curPrice) || 0,
            initial_value: Number(p.initialValue) || 0,
            current_value: Number(p.currentValue) || 0,
            cash_pnl: Number(p.cashPnl) || 0,
            percent_pnl: Number(p.percentPnl) || 0,
            total_bought: Number(p.totalBought) || 0,
            realized_pnl: Number(p.realizedPnl) || 0,
            percent_realized_pnl: Number(p.percentRealizedPnl) || 0,
            redeemable: !!p.redeemable,
            mergeable: !!p.mergeable,
            negative_risk: !!p.negativeRisk,
            market_title: p.title,
            market_slug: p.slug,
            event_slug: p.eventSlug,
            icon: p.icon,
            end_date: p.endDate,
          }))
          .sort((a, b) => b.current_value - a.current_value)
      : [];

  const trades =
    tradesR.status === "fulfilled" && Array.isArray(tradesR.value)
      ? tradesR.value.map((t) => ({
          side: t.side,
          outcome: t.outcome,
          size: Number(t.size) || 0,
          price: Number(t.price) || 0,
          usd: tradeUsd(t),
          timestamp: t.timestamp,
          market_title: t.title,
          market_slug: t.slug,
          icon: t.icon,
          tx_hash: t.transactionHash,
        }))
      : [];

  // Pull identity from the freshest trade if we got one
  const identity =
    tradesR.status === "fulfilled" && tradesR.value?.[0]
      ? {
          name: tradesR.value[0].name || null,
          pseudonym: tradesR.value[0].pseudonym || null,
          profile_image:
            tradesR.value[0].profileImageOptimized ||
            tradesR.value[0].profileImage ||
            null,
          bio: tradesR.value[0].bio || null,
        }
      : null;

  const total_value = valueR.status === "fulfilled" ? Number(valueR.value) || 0 : null;

  const summary = {
    open_positions: positions.length,
    total_value,
    total_unrealized_pnl: positions.reduce((s, p) => s + p.cash_pnl, 0),
    total_realized_pnl: positions.reduce((s, p) => s + p.realized_pnl, 0),
    winning_positions: positions.filter((p) => p.cash_pnl > 0).length,
    losing_positions: positions.filter((p) => p.cash_pnl < 0).length,
    biggest_position_usd: positions[0]?.current_value || 0,
  };

  const errors = {};
  if (positionsR.status === "rejected") errors.positions = String(positionsR.reason?.message || positionsR.reason);
  if (valueR.status === "rejected") errors.value = String(valueR.reason?.message || valueR.reason);
  if (tradesR.status === "rejected") errors.trades = String(tradesR.reason?.message || tradesR.reason);

  res.status(200).json({
    wallet: user,
    identity,
    summary,
    positions,
    trades,
    errors: Object.keys(errors).length ? errors : undefined,
    fetched_at: new Date().toISOString(),
  });
}
