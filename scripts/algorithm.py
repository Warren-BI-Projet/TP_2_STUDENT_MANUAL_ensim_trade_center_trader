"""Produce one bounded trade decision and a dashboard snapshot per market tick."""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
RESERVE = 50.0
MAX_PRODUCT_SHARE = 0.30
MAX_SIGNAL = 0.30
BASELINES = ("random_trader", "random_buyer", "random_seller")


def fetch_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "ensim-trader-student/1.0"})
    with urlopen(request, timeout=20) as response:
        return json.load(response)


def compute_signal(prices: list[float]) -> float:
    """Trade a confirmed 5/20 moving-average trend, capped at 30 units.

    Insufficient history, tiny differences, or a conflicting recent move mean hold.
    This is a decision rule, not a claim that the next price is known.
    """
    if len(prices) < 20 or any(not math.isfinite(p) or p <= 0 for p in prices):
        return 0.0
    fast = sum(prices[-5:]) / 5
    slow = sum(prices[-20:]) / 20
    gap = (fast - slow) / slow
    recent = (prices[-1] - prices[-5]) / prices[-5]
    if abs(gap) < 0.01 or gap * recent <= 0:
        return 0.0
    strength = min(MAX_SIGNAL, max(0.05, abs(gap) * 4))
    return round(math.copysign(strength, gap), 3)


def guarded_signal(signal: float, money: float, units: float, price: float,
                   total_value: float) -> float:
    """Respect cash reserve, inventory, and a 30% per-product exposure ceiling."""
    if signal > 0:
        affordable = max(0.0, (money - RESERVE) / price)
        remaining_share = max(0.0, (MAX_PRODUCT_SHARE * total_value - units * price) / price)
        bounded = max(0.0, min(signal, affordable / 100, remaining_share / 100))
        return math.floor((bounded + 1e-12) * 1000) / 1000
    if signal < 0:
        bounded = min(-signal, max(0.0, units) / 100)
        return -math.floor((bounded + 1e-12) * 1000) / 1000
    return 0.0


def reason(prices: list[float], raw: float, final: float) -> str:
    if len(prices) < 20:
        return "Attente de 20 prix pour calculer la tendance."
    if raw == 0:
        return "Tendance trop faible ou mouvement récent contradictoire : conserver."
    if final == 0:
        return "Signal écarté par la réserve, le plafond d'exposition ou le stock."
    action = "Achat" if final > 0 else "Vente"
    suffix = " (réduit par les limites de risque)" if abs(final) < abs(raw) else ""
    return f"{action} : moyenne 5 tours {'>' if raw > 0 else '<'} moyenne 20 tours, mouvement confirmé{suffix}."


def produce(market: dict, holdings: dict, leaderboard: dict) -> tuple[dict, dict]:
    history = market["history"]
    if not history:
        raise ValueError("Le marché ne contient aucun prix.")
    products = market["products"]
    latest = history[-1]
    inventory = holdings["products"]
    money = float(holdings["money"])
    prices_now = {p: float(latest[p]) for p in products}
    total_value = money + sum(float(inventory.get(p, 0)) * prices_now[p] for p in products)
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    decision: dict = {}
    detail: dict = {}
    # Sell first: proceeds can fund later buys without double counting the budget.
    signals = {p: compute_signal([float(row[p]) for row in history]) for p in products}
    for p in sorted(products, key=lambda item: signals[item]):
        current_units = float(inventory.get(p, 0))
        final = guarded_signal(signals[p], money, current_units, prices_now[p], total_value)
        decision[p] = final
        money -= 100 * final * prices_now[p]
        detail[p] = {"raw_signal": signals[p], "signal": final,
                     "price": prices_now[p], "reason": reason(history_prices(history, p), signals[p], final)}
    decision["updated_at"] = timestamp
    rows = leaderboard.get("leaderboard", [])
    values = {row["id"]: row["total_value"] for row in rows if row.get("id") in BASELINES}
    snapshot = {"tick": latest.get("t", len(history)), "timestamp": latest.get("timestamp", timestamp),
                "recorded_at": timestamp, "total_value": round(total_value, 2),
                "money": round(float(holdings["money"]), 2), "baselines": values,
                "decisions": detail}
    return decision, snapshot


def history_prices(history: list[dict], product: str) -> list[float]:
    return [float(row[product]) for row in history]


def main() -> None:
    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    trader_id = config["trader_id"].strip()
    if not trader_id:
        print("En attente d'inscription : renseigner trader_id dans config.json.")
        return
    base = config["organizer_base_url"].rstrip("/")
    market = fetch_json(config["market_url"])
    holdings = fetch_json(f"{base}/traders/{trader_id}/holdings.json")
    leaderboard = fetch_json(config["leaderboard_url"])
    decision, snapshot = produce(market, holdings, leaderboard)
    path = ROOT / "data" / "performance.json"
    snapshots = json.loads(path.read_text(encoding="utf-8"))
    if snapshots and snapshots[-1]["tick"] == snapshot["tick"]:
        snapshots[-1] = snapshot
    else:
        snapshots.append(snapshot)
    (ROOT / "decision.json").write_text(json.dumps(decision, indent=2) + "\n", encoding="utf-8")
    path.write_text(json.dumps(snapshots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "docs" / "performance.json").write_text(
        json.dumps(snapshots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "docs" / "config.json").write_text(
        json.dumps({"trader_id": trader_id,
                    "organizer_base_url": base,
                    "market_url": config["market_url"],
                    "leaderboard_url": config["leaderboard_url"]}, indent=2) + "\n",
        encoding="utf-8")
    print(f"Tick {snapshot['tick']}: {decision}")


if __name__ == "__main__":
    main()
