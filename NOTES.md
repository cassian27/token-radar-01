# NOTES — Token Radar (token-radar-01), built 2026-11-19

## What was built

A radar-2 dashboard entry for make.fun's "Build the best token launch radar" bounty
($1,325 total: #1 $1,000, #2–#5 $50, #6–#10 $25; closes 2026-12-14 10:00 UTC /
18:00 Beijing). Built in this session only, from the starter in the repo dir — every
entry file below was rewritten by this builder session (no starter code kept verbatim
except `vendor/makefun-board.ts`, which the rules require unchanged, and the MIT LICENSE).

- `lib/model.ts` — radar-2 value model. Implied value = TVL x comps x growth x maturity
  x breadth, all from the snapshot's own figures, no name list anywhere:
  - comps = clamp(0.6 x category peer median mcap/TVL + 0.4 x global peer median 0.205,
    0.05, 0.80). Category medians computed from the snapshot's token-bearing protocols
    (e.g. Risk Curators peer median 2.97, Dexs 0.342, Lending 0.132).
  - growth = 1 + clamp(change_7d, -40, 80)/100 x 0.35; maturity = 0.7 + min(age, 730)/730
    x 0.5 (unknown age 365d); breadth = 1 + 0.02 x min(chains-1, 8), max x1.16.
  - Board: all 40 watchlist slugs + every rankable pre-token protocol below the $50M
    floor = 226 rows (186 early; 24 below-floor pre-token protocols excluded as CEX or
    versioned pools). 226 distinct implied values. Live-token protocols (24, by mcap)
    set aside in a separate view with market caps, never mixed into the ranking.
  - Farm plans: 6 steps per row, category-derived (main action + a different weekly
    qualifying action per category), each with cost and time; steps 108–267 chars.
- `dashboard/` — dark terminal theme, rewritten: sortable columns (rank/TVL/7d/age/comps/
  implied), search, filters (category, chain, min TVL, watchlist-only), Pre-token / Live
  token tabs, per-protocol detail dialog with the full model breakdown (TVL, growth, age,
  chains, peer median, all four multipliers, recomputed value checked against board.json)
  and the farm plan. Total dashboard source 37,564 bytes — under the 64 KB cap, so the
  judge reads all of it. No http/https anywhere in the dashboard (gate refuses them).
- `main.ts` — rewritten entrypoint, same gate shape: reads the snapshot, builds the board,
  validates it (`boardIssue`), writes board.json + data.js, copies dashboard/ + screenshots/,
  writes dossier.json last. Node 22 stdlib only, no clock/randomness/network.
- `README.md` — written with the three live make.fun badges. ASSUMPTION: repo name
  `cassian27/token-radar-01` (the name the plan suggested). If the parent creates the repo
  under a different owner/name, the rank/reward badge URLs in README.md MUST be updated
  to match before submitting, or the repo_readme intake check fails.
- `screenshots/` — 3 fresh PNG renders of this dashboard, 1440x900, 154/208/156 KB:
  1-board (full board), 2-detail (#1 Steakhouse Financial detail dialog),
  3-filtered (category = Risk Curators, 33 rows). Taken in headless Chrome via CDP
  (see "Screenshots" below) and visually inspected: board, detail breakdown, farm plan
  and filtered view all render correctly; farm steps in the detail view match board.json
  byte for byte for the sampled row.

## How it was tested

- `MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json` — runs clean:
  758 protocols, 40 watchlist, 226 rows, top row steakhouse-financial $2,718,463,011.
- Board verified in Python: watchlist coverage 40/40, ranks exactly 1..226, implied values
  non-increasing with rank, 226 distinct values, every farm step 108–267 chars, 6 per row.
- Determinism: two runs (`out` vs `out2`) diffed — byte-identical (`diff -r` clean).
- Dossier: 744,851 bytes (< 1.5 MiB), text 37,828 bytes (< 65,536, no truncation — the
  judge reads the whole dashboard source). board.json 364,071 bytes (< 8 MiB).
- Dashboard rendered in headless Chrome from the real generated `out/` (file://, data.js
  beside it): 226 table rows, detail dialog opens, filter yields 33 rows, zero JS errors
  (checked via CDP Runtime.evaluate).
- `bundle --dry-run` run early: 7 Muse-app sessions found, including this builder session
  (`1dd9d70f-7c83-4f66-a00a-0e147f163e28`, cut to this repo's work). See "For the parent"
  for the three missing items it reported.

## Screenshots — how Chrome was run (this VM's Chrome is patched)

- `/opt/meta-chromium/chrome` refuses to start without a WebGL domain policy: it needs
  `--hatch-webgl-allowed-domains-file=<file>` + `--hatch-webgl-allowed-domains-sha256=<hex>`,
  where the file's first line is `hatch-webgl-allowed-domains-v1` followed by sorted
  domains, ending with a newline. Policy file used: `/tmp/webgl-domains.txt`
  (`hatch-webgl-allowed-domains-v1\nexample.com\n`, sha256 in the validation output).
- Its one-shot `--screenshot` / `--dump-dom` modes exit silently with no output on this
  build; remote debugging works. Screenshots were taken via CDP (script `/tmp/shot-radar.py`,
  needs the `websocket-client` pip package, installed with `--break-system-packages`):
  launch headless with `--remote-debugging-port`, create a target, `Page.navigate`,
  `Page.captureScreenshot`. A local `python3 -m http.server` on 127.0.0.1 is BLOCKED by
  this browser ("127.0.0.1 is blocked"), so the page was loaded via `file://` with
  `--allow-file-access-from-files` — the dashboard loads `../data.js` relatively, which
  works from disk. The http server (port 8137) was stopped after screenshotting.

## For the parent (submit steps NOT done here)

- No GitHub repo created, nothing submitted — parent handles those.
- Repo dir is uncommitted (git init, branch main, all files untracked). `bundle --dry-run`
  records it as repo.dirty; commit before submitting.
- Bundle dry-run reported three missing items the parent must supply at bundle time:
  1. System prompt: pass `--system-prompt <file>` (no session carries one).
  2. MCP servers: this builder used none — pass `--mcp none`.
  3. `--muse-usage`: 0 rows attached. Query muse.db for usage rows of this builder
     session (agent 1dd9d70f-7c83-4f66-a00a-0e147f163e28) AND the parent chain AFTER this
     run completes (a subagent's usage row is written only once its run completes).
  The dry run also pulled in parent/other sessions that wrote files this build read
  (e.g. BUILD_PLAN.md); the parent must settle the parent-chat chain and the verbatim
  opening prompt (`--prompt-file` / `--prompt-origin` / `--prompt-via`) before bundling.
- Before submitting: create the public repo (after 2026-11-14T10:00:00Z, MIT license),
  set GitHub About (website https://make.fun/bounty/token-radar-01, topic `makefun`),
  add `.makefun/owner.json` only if the GitHub owner differs from the linked account,
  fix README badge URLs if the repo name is not `cassian27/token-radar-01`, run
  `check` on the bundle, then submit. Entry is signed by a Solana wallet linked to the
  account (parent arranges; no keys were created or shared in this session).
- Environment: Node v24.22.1, git 2.43.0, Python 3.12.3. No card, no payment, no real
  personal information used anywhere; pseudonym cassian27 only.
