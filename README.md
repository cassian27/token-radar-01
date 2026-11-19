# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/cassian27/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/cassian27/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the protocols that record no token by what a token would be worth if the
protocol's record stayed as it is — and shows a reader how to farm each one before it issues one.

Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## The model (radar-2)

Every row is scored by one function of the snapshot's own figures — no protocol name is
special-cased, and no row is hand-picked:

```
implied = round( tvl_usd x comps x growth x maturity x breadth )
comps    = clamp( 0.6 x category peer median mcap/TVL + 0.4 x global median, 0.05, 0.80 )
growth   = 1 + clamp(change_7d, -40, 80) / 100 x 0.35
maturity = 0.7 + min(age_days, 730) / 730 x 0.5   (unknown age: 365d)
breadth  = 1 + 0.02 x min(chains - 1, 8), at most x1.16
```

The comps multiple prices a protocol the way its own market prices its peers — a DEX multiple
is not a lending multiple. The board covers all 40 watchlist protocols plus 186 pre-token
protocols below the $50M floor, 226 rows in all, each with a six-step farm plan (action, cost,
time). Protocols whose token already trades are set aside in a separate Live token view with
their market caps shown, never mixed into the ranking. Implied value is a model, not a promise.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot, writes the ranked board
to `out/board.json`, the dashboard's data to `out/data.js`, copies `dashboard/` and
`screenshots/` to `out/`, and writes `out/dossier.json`. The dashboard is a static page that
renders with no network: open `out/dashboard/index.html` in a desktop browser.

## Layout

- `main.ts` — entrypoint: snapshot in, board + dashboard + dossier out
- `lib/model.ts` — the radar-2 model, the farm-plan generator, the snapshot parser
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged
- `dashboard/` — the page: `index.html`, `app.css`, `app.js` (dark terminal theme, sortable,
  searchable, filterable by category / chain / min TVL / watchlist, detail view per protocol)
- `screenshots/` — 1-board, 2-detail, 3-filtered: real renders of this dashboard
