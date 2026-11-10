# Student manual — ENSIM Trade Center (trader side)

*Companion to `TP_2_DELIVERY_MANUAL_ensim_trade_center_trader.md` (the full
technical reference — exact tested behavior, troubleshooting) and
`project2_ensim_trade_center.md` (the actual assignment brief: what you're
evaluated on). If something breaks and you can't figure out why, check the
delivery manual or ask your instructor — troubleshooting isn't repeated here.*

This is a project, not a guided skills exercise: there are no reflection
questions and no `REFLECTIONS.md` here. Everything you produce — your algorithm,
your dashboard, your report — *is* the deliverable, evaluated per
`project2_ensim_trade_center.md`.

**Almost everything below is provided, working code** (this is a BI course, not a
programming course — the plumbing around your decision isn't what's being
assessed). **One piece is not provided: your trading signal.** That's the actual
assignment, and it's called out explicitly below.

---

## Framing — what you're actually building

*Connects to CM1 (decision support) and CM2 (KPI design / multi-objective
reasoning).*

Everything in this project exists to produce one file, `decision.json`, at the
root of your repo:

```json
{
  "A": 0.0,
  "B": 0.0,
  "C": 0.0,
  "updated_at": "2026-09-08T10:00:00Z"
}
```

Each value is your current demand for that product, in **[-1, +1]**: positive
buys `100 × value` units, negative sells `100 × |value|` units, `0` does nothing.
Every tick, the organizer's market reads whatever this file currently says —
nothing more, nothing less. There is no separate "automatic mode" flag anywhere
in the system: there is only ever "what does this file currently say," and how
often you change it is entirely up to you. Editing it by hand, on a schedule you
choose, is a complete, valid strategy — it's the "constant trading value" mode
from the assignment brief, not a fallback.

**One design choice worth understanding before you build anything:** the exact
trend/cycle formula behind each product's price is deliberately not published
anywhere — not in the organizer's repo, not in its commit history. You can read
every line of the market's own code and understand *how* price is computed in the
abstract, but not the actual numbers for your specific game. That's intentional:
the only real signal available to you is the price history you actually observe.
Reading source code isn't a shortcut here — this mirrors how a real market
works, and it's the reason the modeling stage below is a genuine forecasting
problem, not a puzzle with a hidden solution to find.

The decision itself also has a real exclusion/evaluation structure (CM1, and per
the brief): some actions are infeasible before they're worth comparing at all
(you cannot sell more than you hold; an all-in bet you can already rule out on
risk grounds shouldn't be compared against safer alternatives as if it were a
peer). And per CM2, the goal stated in the brief is explicitly **not** "maximize
final value" alone — return, risk/volatility, and performance relative to the
three baseline traders (random trader, random buyer, random seller) all matter,
and your report has to say what you optimized for and what you traded off to get
it.

## Acquisition — the two feeds you read from

*Connects to CM3 (data acquisition, Git-hosted feeds — same pattern TD2
practiced).*

### Step 1 — Create your repository

Public repo (needed so the organizer's market can fetch your `decision.json` over
plain HTTP with no authentication), e.g. `ensim-trader-<yourname>`.

### Step 2 — Add `decision.json` and give the organizer your URL

Add the file above at the repo root (all zeros to start — you have no price
history yet, there's nothing to base a real decision on). Your raw URL is:

```
https://raw.githubusercontent.com/<your-username>/<your-repo>/main/decision.json
```

Send this to the organizer — they register it and give you back two URLs of
their own:

- **`MARKET_URL`** — the shared price history, same for every trader.
- **`HOLDINGS_URL`** — your own current money and product holdings, specific to
  you.

Both are public raw JSON files in the organizer's repo; no authentication needed
to read them either. Data is pulled the same way TD2 practiced: a raw Git URL,
refreshed by re-running the query rather than by re-downloading a file by hand.

**If you want to trade entirely by hand, you can stop here.** Edit `decision.json`
via GitHub's web UI whenever you want to change your position, and leave it alone
otherwise — the market reads whatever it last saw. Everything from here on is for
building your own automated signal, which the brief explicitly encourages but does
not require.

## Modeling / prediction — your actual assignment

*Connects to CM2 (a signal is a modeling choice you have to justify, not a fact)
and CM5 (automating the execution of a decision doesn't remove your judgment from
the loop — it moves that judgment into the algorithm's design).*

### Step 3 — Add `scripts/algorithm.py`

The scaffold below is complete and runs as-is — it fetches both feeds, loops over
the three products, and writes a valid `decision.json`. **One function is a stub
you must implement: `compute_signal`.** As written, it always returns `0.0` (pure
hold), which is intentionally the safest possible default, not a hint.

```python
import json, time
import requests

# Fill these in with the URLs the organizer gave you when they registered you:
MARKET_URL = "https://raw.githubusercontent.com/exofri/ensim-trade-center/refs/heads/main/docs/data/market.json"
HOLDINGS_URL = "http://raw.githubusercontent.com/exofri/ensim-trade-center/refs/heads/main/traders/[YOUR_NAME]/holdings.json"

MIN_MONEY_RESERVE = 50 # never let a buy signal spend below this much money

def fetch_json(url):
    resp = requests.get(url, proxies={"http": None, "https": None}, timeout=(10, 20))
    resp.raise_for_status()
    return resp.json()

def compute_signal(prices):
    """
    YOUR TASK -- see "Your task: design your trading signal" below for the
    exact contract. Replace this body; as written it never trades.
    """
    return 0.0  # TODO: replace with your own signal logic

def apply_budget_guard(raw_signal, money, price, reserve=MIN_MONEY_RESERVE):
    # A buy signal (positive) that would spend into the reserve gets scaled down,
    # not silently zeroed out -- you still act on the signal, just smaller. A sell
    # signal is never touched here: selling only ever adds money, never risks it.
    if raw_signal <= 0:
        return raw_signal
    if money <= reserve:
        return 0.0
    max_affordable_units = (money - reserve) / price
    desired_units = 100 * raw_signal
    if desired_units <= max_affordable_units:
        return raw_signal
    return round(max_affordable_units / 100, 3)

def main():
    market = fetch_json(MARKET_URL)
    holdings = fetch_json(HOLDINGS_URL)
    products = market["products"]
    history = market["history"]

    decision = {}
    for p in products:
        prices = [row[p] for row in history]
        raw = compute_signal(prices)
        current_price = prices[-1] if prices else 0
        decision[p] = round(apply_budget_guard(raw, holdings["money"], current_price), 3)

    decision["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with open("decision.json", "w") as f:
        json.dump(decision, f, indent=2)
    print(f"Wrote decision.json: {decision}")

if __name__ == "__main__":
    main()
```

**`apply_budget_guard` and `fetch_json` are provided and already tested — trust
them, you don't need to modify or re-derive them.** Confirmed by real testing
against real generated market data: with plenty of money, a signal passes through
unchanged; with money down near the reserve, a strong buy signal is correctly
scaled down rather than zeroed or left at full strength; once money is already at
or under the reserve, buy signals are correctly suppressed to exactly `0`; a sell
signal is never touched, since selling only ever adds money, never risks it. This
is the plumbing so your effort goes into the decision logic, not systems glue.

### Your task: design your trading signal

Implement `compute_signal(prices)`:

- **Input:** `prices` — a list of real floats, the price history for *one*
  product observed so far, oldest to newest. It can be short, or even empty,
  early in the game.
- **Output:** a single float in `[-1, 1]`. Positive means buy (scaled by 100
  units per 1.0 of signal), negative means sell, `0` means hold. Your return
  value is passed through `apply_budget_guard` automatically — you don't call it
  yourself.
- **You do not know future prices.** Whatever you compute has to be a function of
  `prices` alone (and, if you want, of `holdings` — `main()` already fetches it
  from `HOLDINGS_URL`, so it's available if you extend `compute_signal`'s
  signature yourself to use it, e.g. to trade differently depending on how much
  of a product you already hold).

You have real options, not one prescribed technique — name-check only, no code
given, since designing this is the point:

- **Moving average / rolling mean** — is the current price above or below its
  recent average?
- **Bollinger Bands** — mean ± *k* standard deviations; how far outside its
  recent normal range is the current price? (The technique TD4 already had you
  practice, applied here to a live decision instead of a static report.)
- **Momentum / trend-following** — is the price on a sustained run in one
  direction?
- **Mean-reversion** — the opposite bet: a price that's moved a lot is more
  likely to move back.
- **Exponential smoothing** — you built this exact technique in
  `TD_4_STUDENT_MANUAL_time_series.md`; the smoothing code transfers directly,
  only the use (a live decision instead of a chart) is new.
- Combine more than one, weight them, apply different logic per product, or
  design something else entirely.

**The actual assignment (per `project2_ensim_trade_center.md`) is not which
formula you pick — it's being able to explain, in your report, why your choice
makes sense for this specific market.** An algorithm you can't explain is not a
stronger submission than a manual decision you can explain; it's a weaker one.

**Checkpoint:** run `python scripts/algorithm.py` once (after filling in your two
URLs) with the stub still in place — `decision.json` should update with valid
JSON, all zeros, and that's correct, not a bug. Once you implement
`compute_signal`, re-run it: you should see real, non-zero values once you have
enough price history for your own logic to produce one (how much history you need
depends entirely on what you implemented).

## Automation — running your signal on a schedule

*Connects to CM4 (orchestration and scheduling).*

### Step 4 — Automate it (`.github/workflows/auto_decide.yml`)

```yaml
name: Auto decide

"on":
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  decide:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: "3.12"
      - run: pip install requests
      - run: python scripts/algorithm.py
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add decision.json
          git commit -m "Update decision [automated]" || echo "Nothing to commit"
          git push
```

Every 30 minutes by default — more frequent than the organizer's hourly market
tick is harmless but adds no value, since the market only ever reads whatever
your file says *at tick time*; less frequent just means a stale decision persists
between your own updates, which is exactly manual-mode behavior and also
harmless. Adjust freely.

**Settings → Actions → General → Workflow permissions → "Read and write
permissions" → Save** first, same as every other project in this course — this
workflow commits its own output.

**Checkpoint:** after the workflow runs once (trigger it manually from the
Actions tab to check before waiting for the schedule), `decision.json`'s
`updated_at` should have changed and the values should reflect your algorithm's
real output against the current market state.

## Visualization for decision support — your actual dashboard

*Connects to CM1 (a dashboard exists to support a specific, repeated decision)
and CM2 (multi-objective KPI design).*

### A sanity check, not your dashboard (`docs/index.html`)

Before building anything analytical, confirm your two feed URLs actually work.
This is deliberately bare — it exists to catch a broken URL early, nothing more:

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Feed sanity check</title></head>
<body>
  <h1>Feed sanity check — not your dashboard</h1>
  <p>This just confirms your two feed URLs actually return real data. Your actual dashboard (return vs. baselines, risk/volatility, your product-level signal, a decision log) is a separate thing you build yourself — see below.</p>
  <pre id="out">Loading...</pre>
<script>
const MARKET_URL = "PASTE_YOUR_MARKET_URL_HERE";
const HOLDINGS_URL = "PASTE_YOUR_HOLDINGS_URL_HERE";
Promise.all([fetch(MARKET_URL).then(r => r.json()), fetch(HOLDINGS_URL).then(r => r.json())])
  .then(([market, holdings]) => {
    document.getElementById('out').textContent =
      'MARKET:\n' + JSON.stringify(market, null, 2) + '\n\nHOLDINGS:\n' + JSON.stringify(holdings, null, 2);
  })
  .catch(err => { document.getElementById('out').textContent = 'Could not load data: ' + err; });
</script>
</body>
</html>
```

**Checkpoint:** the page prints real JSON for both feeds — real price history,
real money/holdings numbers. If you see an error instead, your URLs are wrong
before you've written a single line of analysis.

### The real deliverable: your dashboard

That sanity check is not the assignment. Per `project2_ensim_trade_center.md`,
your actual deliverable is a live dashboard, refreshed from these same two feeds,
that you genuinely use round after round to decide — and a written report. At
minimum, per the brief's own required KPI list:

- **Performance** — total value over time, plotted against each of the three
  baseline traders (random trader, random buyer, random seller), not just your
  own trajectory in isolation.
- **Risk** — a volatility or drawdown measure over time, so a high-return,
  high-swing strategy doesn't look identical to a steady one.
- **Product-level signal** — whatever indicator(s) `compute_signal` actually
  uses, made visible (this is the one part of the dashboard directly downstream
  of the work you did above).
- **Decision log** — what you actually decided each round and a one-line reason,
  so your report can explain the trajectory, not just show it.

You already practiced exactly this design discipline in
`TD_5_STUDENT_MANUAL_dashboard_design.md` — the same habit of arguing *why* a
given chart fits a given decision, not defaulting to whatever's easiest to build,
applies here. Build and argue your own; nothing here hands it to you.

**A note on what "automatic" does and doesn't mean:** per the brief's
multi-objective framing (CM2) and CM5's human-in-the-loop principle, automating
your decision doesn't remove you from the loop — it changes *where* your
judgment shows up, into the algorithm's design rather than each individual tick.
Your report still has to explain what your signal is actually doing and why,
exactly as if you'd made every call by hand.

## Final checklist

- [ ] `decision.json` exists at your repo root and the organizer has registered
      your raw URL.
- [ ] Either: you're comfortable editing `decision.json` by hand as your trading
      mode, **or** `compute_signal` is implemented and `scripts/algorithm.py`
      produces real, history-informed values (not all zeros, once enough ticks
      exist).
- [ ] If automated: `auto_decide.yml` confirmed running (check the Actions tab),
      workflow permissions set to read/write.
- [ ] Your own dashboard actually informs your decisions, covering all four
      required KPI categories (performance vs. baselines, risk, product-level
      signal, decision log) — evidenced by your decision log and report, not
      just present.
- [ ] Your report explains what your signal does and why, per the brief's own
      evaluation criteria.
