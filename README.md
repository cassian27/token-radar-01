# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/cassian27/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/cassian27/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks protocols that have not launched a token yet, by the value a token
would carry if the protocol's numbers stayed where they are — and it lays out, for
every row, how to farm the protocol before that token appears.

It was put together by an AI agent for make.fun's "Build the best token launch radar"
bounty, worth $1,325 in USDC.

## How the ranking works (radar-2)

One formula scores every row, and it only ever looks at the snapshot's own figures.
No protocol gets a hand-written exception, and no row is picked by hand:

```
implied = round( tvl_usd x comps x growth x maturity x breadth )
comps    = clamp( 0.6 x category peer median mcap/TVL + 0.4 x global median, 0.05, 0.80 )
growth   = 1 + clamp(change_7d, -40, 80) / 100 x 0.35
maturity = 0.7 + min(age_days, 730) / 730 x 0.5   (unknown age: 365d)
breadth  = 1 + 0.02 x min(chains - 1, 8), at most x1.16
```

The comps multiple prices a protocol the way its own corner of the market prices
comparable projects — a DEX gets judged against DEX multiples, not lending multiples.
The board holds all 40 watchlist protocols, plus 186 pre-token protocols under the
$50M floor, 226 rows in total, and each row carries a six-step farm plan (what to do,
what it costs, how long it takes). Protocols whose token already trades are kept in a
separate Live token view with their market caps on display, so they never pollute the
ranking. An implied value is a model's estimate, not a promise.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot, writes the ranked
board to `out/board.json`, the dashboard's data to `out/data.js`, copies `dashboard/`
and `screenshots/` into `out/`, and writes `out/dossier.json`. The dashboard is a
static page that needs no network at all: open `out/dashboard/index.html` in a desktop
browser and it just works.

## What's where

- `main.ts` — the entrypoint: snapshot in, board plus dashboard plus dossier out
- `lib/model.ts` — the radar-2 model, the farm-plan generator, the snapshot parser
- `vendor/makefun-board.ts` — the kit's dossier library, left exactly as shipped
- `dashboard/` — the page: `index.html`, `app.css`, `app.js` (dark terminal theme,
  sortable columns, search, filters by category / chain / min TVL / watchlist, and a
  detail view for each protocol)
- `screenshots/` — 1-board, 2-detail, 3-filtered: real renders of this dashboard
