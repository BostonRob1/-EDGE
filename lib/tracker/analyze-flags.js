// Pure analysis: take raw source data, emit weighted flags + a final score.
// No I/O here — kept side-effect free so tests can hit it with synthetic inputs.

const WEIGHTS = { critical: 25, warn: 10, info: -5 };
const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
  "0xdead000000000000000042069420694206942069",
]);

function flag(level, code, label, detail) {
  return { level, code, label, detail: detail || null };
}

function fmtUsd(n) {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

function pct(n) {
  return (n * 100).toFixed(1) + "%";
}

export function analyze(input) {
  const { dexscreener, goplus, rugcheck, honeypot, solanaMint, solanaHolders, chain } = input;
  const flags = [];

  // ── Market & liquidity ──────────────────────────────────────────────
  if (!dexscreener?.found) {
    flags.push(
      flag(
        "critical",
        "NO_DEX_PAIR",
        "No DEX pair found",
        "Token has no tradeable liquidity on any indexed DEX — cannot enter or exit."
      )
    );
  } else {
    const liq = dexscreener.liquidity_usd || 0;
    if (liq < 5_000) {
      flags.push(
        flag(
          "critical",
          "CRIT_LOW_LIQUIDITY",
          "Critically low liquidity",
          `Only ${fmtUsd(liq)} in pool — exits will move price dramatically.`
        )
      );
    } else if (liq < 25_000) {
      flags.push(
        flag("warn", "LOW_LIQUIDITY", "Low liquidity", `${fmtUsd(liq)} in pool — high slippage risk.`)
      );
    }

    if (dexscreener.pair_created_at) {
      const hours = (Date.now() - dexscreener.pair_created_at) / 3_600_000;
      if (hours < 1) {
        flags.push(
          flag(
            "critical",
            "BRAND_NEW",
            "Brand-new pair (<1h)",
            `Pair was created ${hours.toFixed(2)}h ago — extreme volatility / rug risk.`
          )
        );
      } else if (hours < 24) {
        flags.push(
          flag(
            "warn",
            "VERY_NEW",
            "Very new (<24h)",
            `Pair was created ${hours.toFixed(1)}h ago.`
          )
        );
      }
    }

    // Buy/sell imbalance — heavy sell pressure in last hour
    const buys = dexscreener.txns_1h_buys || 0;
    const sells = dexscreener.txns_1h_sells || 0;
    const total = buys + sells;
    if (total >= 20 && sells > buys * 3) {
      flags.push(
        flag(
          "warn",
          "SELL_PRESSURE",
          "Heavy sell pressure (1h)",
          `${sells} sells vs ${buys} buys in the last hour.`
        )
      );
    }
  }

  // ── GoPlus (chain-specific) ─────────────────────────────────────────
  if (goplus?.found && chain === "ethereum") {
    if (goplus.is_honeypot) {
      flags.push(flag("critical", "HONEYPOT", "Honeypot detected", "Sells are blocked or restricted."));
    }
    if (goplus.cannot_sell_all) {
      flags.push(flag("critical", "CANNOT_SELL_ALL", "Cannot sell entire balance", "Sell limits prevent full exit."));
    }
    if (goplus.cannot_buy) {
      flags.push(flag("critical", "CANNOT_BUY", "Buying disabled", "Buy transactions revert."));
    }
    if (goplus.is_proxy) {
      flags.push(flag("critical", "IS_PROXY", "Upgradable proxy contract", "Owner can change contract logic at will."));
    }
    if (goplus.is_mintable) {
      flags.push(flag("critical", "MINTABLE", "Mintable supply", "Owner can mint new tokens — unlimited dilution risk."));
    }
    if (goplus.can_take_back_ownership) {
      flags.push(flag("critical", "CAN_TAKE_BACK_OWNERSHIP", "Ownership reclaimable", "A renounced owner can be restored."));
    }
    if (goplus.hidden_owner) {
      flags.push(flag("critical", "HIDDEN_OWNER", "Hidden owner", "Privileged role is obscured in the contract."));
    }
    if (goplus.owner_change_balance) {
      flags.push(flag("critical", "OWNER_CHANGE_BALANCE", "Owner can edit balances", "Owner can mutate any holder's balance."));
    }
    if (goplus.selfdestruct) {
      flags.push(flag("critical", "SELFDESTRUCT", "Selfdestruct enabled", "Contract can be permanently destroyed."));
    }
    if (goplus.is_airdrop_scam) {
      flags.push(flag("critical", "AIRDROP_SCAM", "Flagged as airdrop scam", "GoPlus has tagged this token in scam lists."));
    }
    if (goplus.is_blacklisted) {
      flags.push(flag("critical", "BLACKLISTED", "Blacklist function present", "Owner can blacklist arbitrary addresses."));
    }
    if (goplus.transfer_pausable) {
      flags.push(flag("warn", "PAUSABLE", "Transfers pausable", "Owner can freeze all transfers."));
    }
    if (goplus.trading_cooldown) {
      flags.push(flag("warn", "TRADING_COOLDOWN", "Trading cooldown", "Forced delay between trades."));
    }
    if (goplus.is_anti_whale) {
      flags.push(flag("info", "ANTI_WHALE", "Anti-whale measures", "Max wallet / max tx limits in place."));
    }
    if (goplus.is_open_source === true) {
      flags.push(flag("info", "OPEN_SOURCE", "Source code verified", "Contract source is published on the explorer."));
    } else if (goplus.is_open_source === false) {
      flags.push(flag("critical", "UNVERIFIED", "Contract not verified", "Source not published — cannot audit logic."));
    }

    const bt = goplus.buy_tax || 0;
    const st = goplus.sell_tax || 0;
    if (bt > 0.1) flags.push(flag("critical", "HIGH_BUY_TAX", `Buy tax ${pct(bt)}`, "Tax over 10% is extreme."));
    else if (bt > 0.05) flags.push(flag("warn", "BUY_TAX", `Buy tax ${pct(bt)}`));
    if (st > 0.1) flags.push(flag("critical", "HIGH_SELL_TAX", `Sell tax ${pct(st)}`, "Tax over 10% destroys exits."));
    else if (st > 0.05) flags.push(flag("warn", "SELL_TAX", `Sell tax ${pct(st)}`));

    if (goplus.holder_count > 0 && goplus.holder_count < 50) {
      flags.push(flag("warn", "LOW_HOLDER_COUNT", `Only ${goplus.holder_count} holders`));
    }

    // Creator/owner holdings
    if (goplus.creator_percent > 0.2) {
      flags.push(
        flag("warn", "CREATOR_HEAVY", `Creator holds ${pct(goplus.creator_percent)}`, "Creator wallet retains a large stake.")
      );
    }
    if (goplus.owner_percent > 0.5) {
      flags.push(
        flag("critical", "OWNER_HEAVY", `Owner holds ${pct(goplus.owner_percent)}`, "Owner can crash price single-handedly.")
      );
    }

    // LP burned/locked analysis
    const lpHolders = goplus.lp_holders || [];
    if (lpHolders.length > 0) {
      const lockedOrBurned = lpHolders.filter(
        (h) =>
          h.is_locked === 1 ||
          h.is_locked === "1" ||
          BURN_ADDRESSES.has(String(h.address || "").toLowerCase())
      );
      const lockedPct = lockedOrBurned.reduce((s, h) => s + parseFloat(h.percent || 0), 0);
      if (lockedPct >= 0.9) {
        flags.push(flag("info", "LP_LOCKED", `${pct(lockedPct)} of LP locked/burned`));
      } else if (lockedPct < 0.5) {
        flags.push(
          flag("critical", "LP_NOT_LOCKED", `Only ${pct(lockedPct)} of LP locked`, "Remaining LP can be pulled at any time.")
        );
      }
    }

    // Top holder concentration
    const top = goplus.holders || [];
    if (top.length > 0) {
      const top1 = parseFloat(top[0]?.percent || 0);
      if (top1 > 0.5) {
        flags.push(
          flag("critical", "TOP_HOLDER_OVER_50", `Top holder ${pct(top1)}`, "Single wallet can dump and crash price.")
        );
      } else if (top1 > 0.2) {
        flags.push(flag("warn", "TOP_HOLDER_HIGH", `Top holder ${pct(top1)}`));
      }
      const top10 = top.slice(0, 10).reduce((s, h) => s + parseFloat(h.percent || 0), 0);
      if (top10 > 0.7) {
        flags.push(flag("critical", "TOP10_OVER_70", `Top 10 own ${pct(top10)}`, "Extreme concentration."));
      } else if (top10 > 0.4) {
        flags.push(flag("warn", "TOP10_OVER_40", `Top 10 own ${pct(top10)}`));
      }
    }
  }

  if (goplus?.found && chain === "solana") {
    if (goplus.mintable) {
      flags.push(flag("critical", "MINTABLE", "Mintable supply", "Mint authority can issue new tokens."));
    }
    if (goplus.freezable) {
      flags.push(flag("critical", "FREEZE_AUTHORITY", "Freeze authority active", "Owner can freeze your wallet."));
    }
    if (goplus.closable) {
      flags.push(flag("warn", "CLOSABLE", "Mint can be closed", "Mint account can be closed by authority."));
    }
    if (goplus.transfer_fee_upgradable) {
      flags.push(flag("warn", "FEE_UPGRADABLE", "Transfer fee can be changed", "Authority can raise transfer fees retroactively."));
    }
    if (goplus.transfer_hook_upgradable) {
      flags.push(flag("warn", "HOOK_UPGRADABLE", "Transfer hook upgradable", "Authority can install/replace custom transfer logic."));
    }
    if (goplus.non_transferable) {
      flags.push(flag("critical", "NON_TRANSFERABLE", "Non-transferable token", "Token cannot be transferred."));
    }
    if (goplus.transfer_fee > 0.05) {
      flags.push(flag("warn", "HIGH_TRANSFER_FEE", `Transfer fee ${pct(goplus.transfer_fee)}`));
    }
  }

  // ── Solana on-chain (RPC) ────────────────────────────────────────────
  if (chain === "solana" && solanaMint) {
    if (solanaMint.mint_authority) {
      flags.push(
        flag(
          "critical",
          "MINT_NOT_RENOUNCED",
          "Mint authority not renounced",
          `Authority: ${solanaMint.mint_authority}`
        )
      );
    } else {
      flags.push(flag("info", "MINT_RENOUNCED", "Mint authority renounced"));
    }
    if (solanaMint.freeze_authority) {
      flags.push(
        flag(
          "critical",
          "FREEZE_NOT_RENOUNCED",
          "Freeze authority not renounced",
          `Authority: ${solanaMint.freeze_authority}`
        )
      );
    } else {
      flags.push(flag("info", "FREEZE_RENOUNCED", "Freeze authority renounced"));
    }
  }

  if (chain === "solana" && Array.isArray(solanaHolders) && solanaHolders.length && solanaMint) {
    const decimals = solanaMint.decimals || 0;
    const supply = parseFloat(solanaMint.supply) / Math.pow(10, decimals);
    if (supply > 0) {
      const amounts = solanaHolders.map((h) =>
        parseFloat(
          h.uiAmountString != null
            ? h.uiAmountString
            : (parseFloat(h.amount || 0) / Math.pow(10, decimals)).toString()
        )
      );
      const top1 = amounts[0] / supply;
      if (top1 > 0.5) {
        flags.push(
          flag(
            "critical",
            "TOP_HOLDER_OVER_50",
            `Top account ${pct(top1)}`,
            "Note: top holder is often the LP pool — verify the address before reacting."
          )
        );
      } else if (top1 > 0.2) {
        flags.push(flag("warn", "TOP_HOLDER_HIGH", `Top account ${pct(top1)}`));
      }
      const top10 = amounts.slice(0, 10).reduce((s, n) => s + n, 0) / supply;
      if (top10 > 0.7) {
        flags.push(flag("critical", "TOP10_OVER_70", `Top 10 own ${pct(top10)}`, "Extreme concentration."));
      } else if (top10 > 0.4) {
        flags.push(flag("warn", "TOP10_OVER_40", `Top 10 own ${pct(top10)}`));
      }
    }
  }

  // ── RugCheck (Solana) ────────────────────────────────────────────────
  if (rugcheck?.found && Array.isArray(rugcheck.risks)) {
    for (const risk of rugcheck.risks) {
      const lvl =
        risk.level === "danger" || risk.level === "high"
          ? "critical"
          : risk.level === "warn" || risk.level === "medium"
          ? "warn"
          : "info";
      const code = "RUGCHECK_" + String(risk.name || "RISK").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
      flags.push(flag(lvl, code, `RugCheck: ${risk.name || "Risk"}`, risk.description || null));
    }
  }

  // ── Honeypot.is (Ethereum) ───────────────────────────────────────────
  if (honeypot?.found) {
    if (honeypot.is_honeypot) {
      flags.push(
        flag("critical", "HONEYPOT_CONFIRMED", "Honeypot.is: confirmed honeypot", honeypot.honeypot_reason)
      );
    }
    for (const f of honeypot.flags || []) {
      flags.push(
        flag("warn", "HONEYPOT_FLAG_" + String(f).toUpperCase().replace(/[^A-Z0-9]+/g, "_"), `Honeypot.is flag: ${f}`)
      );
    }
    if (honeypot.failed_txs && honeypot.successful_txs && honeypot.failed_txs > honeypot.successful_txs) {
      flags.push(
        flag(
          "warn",
          "MANY_FAILED_TXS",
          "More failed sells than successful",
          `${honeypot.failed_txs} failed vs ${honeypot.successful_txs} successful in sample.`
        )
      );
    }
  }

  // ── Score ─────────────────────────────────────────────────────────────
  // Dedupe by code first so we don't double-count signals that show up in
  // multiple sources (e.g. mintable from both GoPlus and Solana RPC).
  const seen = new Set();
  const deduped = flags.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });

  let score = 100;
  for (const f of deduped) {
    score -= WEIGHTS[f.level] ?? 0;
  }
  score = Math.max(0, Math.min(100, score));

  const level =
    score >= 80 ? "safe" : score >= 50 ? "caution" : score >= 25 ? "high" : "critical";

  // Sort: critical → warn → info; within each, code-alpha for stability
  const order = { critical: 0, warn: 1, info: 2 };
  deduped.sort((a, b) => order[a.level] - order[b.level] || a.code.localeCompare(b.code));

  const counts = deduped.reduce(
    (acc, f) => ({ ...acc, [f.level]: (acc[f.level] || 0) + 1 }),
    { critical: 0, warn: 0, info: 0 }
  );

  return { score, level, flags: deduped, counts };
}
