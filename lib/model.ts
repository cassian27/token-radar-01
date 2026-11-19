// Token Radar — the radar-2 value model.
//
// A protocol with no token is priced from the snapshot alone: its TVL, the
// market-cap-to-TVL ratio its category's token-bearing peers trade at, its
// seven-day growth, how long it has run, and how many chains it spans. No
// list of names anywhere: every number below is computed from the snapshot
// the program is handed, so the same code prices any snapshot the same way.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  asOf: string;
  source: string;
  floorUsd: number;
  protocols: Protocol[];
  watchlist: string[];
}

/** One ranked row of the board, with the whole model behind it. */
export interface BoardRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvlUsd: number;
  change7d: number | null;
  ageDays: number;
  rank: number;
  impliedValueUsd: number;
  comps: number;
  peerMedian: number;
  growth: number;
  maturity: number;
  breadth: number;
  watchlist: boolean;
  farmSteps: string[];
}

/** A protocol whose token already trades, set aside from the ranking. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvlUsd: number;
  mcapUsd: number;
  change7d: number | null;
}

export interface Radar {
  asOf: string;
  floorUsd: number;
  rows: BoardRow[];
  live: LiveRow[];
  earlySize: number;
  liveSize: number;
  categories: string[];
  chains: string[];
}

// ---------------------------------------------------------------- snapshot

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read and check the sealed snapshot; throws on anything malformed. */
export function parseSnapshot(text: string): Snapshot {
  const raw: unknown = JSON.parse(text);
  if (!isRecord(raw)) throw new Error('snapshot: the top level is not an object');
  const asOf = raw.as_of;
  const floorUsd = raw.floor_usd;
  const protocols = raw.protocols;
  const watchlist = raw.watchlist;
  if (typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('snapshot: as_of is not a date');
  if (typeof floorUsd !== 'number' || floorUsd <= 0) throw new Error('snapshot: floor_usd is not a positive number');
  if (!Array.isArray(protocols) || protocols.length === 0) throw new Error('snapshot: protocols is empty');
  if (!Array.isArray(watchlist)) throw new Error('snapshot: watchlist is not an array');
  const seen = new Set<string>();
  const clean: Protocol[] = protocols.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`snapshot: protocol ${index} is not an object`);
    const slug = entry.slug;
    const name = entry.name;
    const category = entry.category;
    const chains = entry.chains;
    const tvl = entry.tvl_usd;
    const change = entry.change_7d;
    const mcap = entry.mcap_usd;
    const listed = entry.listed_at;
    const gecko = entry.gecko_id;
    const symbol = entry.symbol;
    if (typeof slug !== 'string' || slug.length === 0 || /\s/.test(slug)) throw new Error(`snapshot: protocol ${index} has no slug`);
    if (seen.has(slug)) throw new Error(`snapshot: slug ${slug} appears twice`);
    seen.add(slug);
    if (typeof name !== 'string' || name.length === 0) throw new Error(`snapshot: ${slug} has no name`);
    if (category !== null && typeof category !== 'string') throw new Error(`snapshot: ${slug} has a bad category`);
    if (!Array.isArray(chains) || chains.some((c) => typeof c !== 'string')) throw new Error(`snapshot: ${slug} has bad chains`);
    if (typeof tvl !== 'number' || tvl < 0) throw new Error(`snapshot: ${slug} has a bad tvl_usd`);
    if (change !== null && typeof change !== 'number') throw new Error(`snapshot: ${slug} has a bad change_7d`);
    if (mcap !== null && typeof mcap !== 'number') throw new Error(`snapshot: ${slug} has a bad mcap_usd`);
    // DefiLlama writes -1 where a market cap is unknown: it is no market cap.
    const mcapValue = mcap === -1 ? null : (mcap as number | null);
    if (listed !== null && (typeof listed !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(listed))) throw new Error(`snapshot: ${slug} has a bad listed_at`);
    if (gecko !== null && typeof gecko !== 'string') throw new Error(`snapshot: ${slug} has a bad gecko_id`);
    if (symbol !== null && typeof symbol !== 'string') throw new Error(`snapshot: ${slug} has a bad symbol`);
    return {
      slug,
      name,
      category: category as string | null,
      chains: chains as string[],
      tvl_usd: tvl,
      change_7d: change as number | null,
      mcap_usd: mcapValue,
      listed_at: listed as string | null,
      gecko_id: gecko as string | null,
      symbol: symbol as string | null,
    };
  });
  const list = watchlist.filter((s): s is string => typeof s === 'string');
  if (list.length !== watchlist.length) throw new Error('snapshot: watchlist holds a non-string');
  return { asOf, source: typeof raw.source === 'string' ? raw.source : '', floorUsd, protocols: clean, watchlist: list };
}

// ---------------------------------------------------------------- peers

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

interface PeerTable {
  global: number;
  byCategory: Map<string, number>;
}

/**
 * The market-cap-to-TVL ratio the market already pays, per category and
 * overall, from the token-bearing protocols in the snapshot itself. A
 * category with no token-bearing peer falls back to the global median.
 */
function peerTable(protocols: Protocol[]): PeerTable {
  const all: number[] = [];
  const perCategory = new Map<string, number[]>();
  for (const p of protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    if (p.category !== null) {
      const bucket = perCategory.get(p.category);
      if (bucket === undefined) perCategory.set(p.category, [ratio]);
      else bucket.push(ratio);
    }
  }
  if (all.length === 0) throw new Error('model: the snapshot has no token-bearing protocol to price from');
  const byCategory = new Map<string, number>();
  for (const [category, ratios] of perCategory) byCategory.set(category, median(ratios));
  return { global: median(all), byCategory };
}

// ---------------------------------------------------------------- the model

function dayCount(day: string): number {
  const [y, m, d] = day.split('-').map((part) => Number.parseInt(part, 10));
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
}

/** Days a protocol has been tracked; an unknown start counts as one year. */
function ageDays(protocol: Protocol, asOf: string): number {
  if (protocol.listed_at === null) return 365;
  const age = dayCount(asOf) - dayCount(protocol.listed_at);
  return age < 0 ? 0 : age;
}

interface Factors {
  comps: number;
  peerMedian: number;
  growth: number;
  maturity: number;
  breadth: number;
  implied: number;
}

/**
 * Implied value = TVL x comps x growth x maturity x breadth.
 * comps blends the category peer median (60%) with the global median
 * (40%), clamped to [0.05, 0.80]. growth adds up to 35% of the seven-day
 * TVL change, the change clamped to [-40, 80] and an unreported change
 * counting as flat. maturity runs 0.70 for a newborn protocol to 1.20 at
 * two years. breadth adds 2% per extra chain, up to eight extra chains.
 */
function score(protocol: Protocol, peers: PeerTable, asOf: string): Factors {
  const peerMedian = protocol.category === null ? peers.global : (peers.byCategory.get(protocol.category) ?? peers.global);
  const comps = clamp(0.6 * peerMedian + 0.4 * peers.global, 0.05, 0.8);
  const change = protocol.change_7d === null ? 0 : clamp(protocol.change_7d, -40, 80);
  const growth = 1 + (change / 100) * 0.35;
  const age = ageDays(protocol, asOf);
  const maturity = 0.7 + (Math.min(age, 730) / 730) * 0.5;
  const breadth = 1 + 0.02 * Math.min(Math.max(protocol.chains.length - 1, 0), 8);
  const implied = Math.round(protocol.tvl_usd * comps * growth * maturity * breadth);
  return { comps, peerMedian, growth, maturity, breadth, implied };
}

// ---------------------------------------------------------------- farm plans

interface Playbook {
  act: string;
  weekly: string;
}

/** What to do with a protocol of each kind, and what to repeat weekly. */
const PLAYBOOK: Record<string, Playbook> = {
  'Risk Curators': {
    act: 'Deposit into a curator vault and let the curator allocate the capital',
    weekly: 'Rebalance toward the vault with the best risk-adjusted yield and claim any points',
  },
  Dexs: {
    act: 'Provide liquidity to a core trading pool',
    weekly: 'Add liquidity to a newly listed pool and route a small swap through it',
  },
  Lending: {
    act: 'Supply assets as collateral to the lending market',
    weekly: 'Borrow a small amount against the collateral and repay it to keep the position active',
  },
  Yield: {
    act: 'Deposit into the yield vault',
    weekly: 'Harvest the yield and restake it into the same vault',
  },
  RWA: {
    act: 'Buy into a tokenized real-world-asset vault',
    weekly: 'Top up the position and verify the latest reserve attestation',
  },
  'Onchain Capital Allocator': {
    act: 'Allocate capital to an allocator vault',
    weekly: 'Vote in the next allocation round and shift weight to the winning strategy',
  },
  Bridge: {
    act: 'Bridge assets through the protocol to a chain you already use',
    weekly: 'Bridge a small amount on a new route to keep the address active',
  },
  'Canonical Bridge': {
    act: 'Bridge assets through the canonical bridge to a chain you already use',
    weekly: 'Bridge a small amount on a new route to keep the address active',
  },
  Derivatives: {
    act: 'Open a small hedged derivatives position',
    weekly: 'Place a small trade and close it before the funding window ends',
  },
  CDP: {
    act: 'Mint stablecoins against collateral in the CDP',
    weekly: 'Adjust the collateral ratio after any sharp price move',
  },
  'Yield Aggregator': {
    act: 'Deposit into the aggregator vault',
    weekly: 'Move the deposit to the newest strategy when one opens',
  },
  'Basis Trading': {
    act: 'Deposit into the basis-trading vault',
    weekly: 'Roll the position into the next funding cycle',
  },
  'Staking Pool': {
    act: 'Stake assets into the pool',
    weekly: 'Restake the staking rewards into the same pool',
  },
  Chain: {
    act: 'Bridge assets to the chain and use its flagship app',
    weekly: 'Run one transaction on the chain core app',
  },
  'Liquidity Manager': {
    act: 'Deposit into a managed liquidity position',
    weekly: 'Rebalance the range when the price drifts out of it',
  },
  'Liquid Staking': {
    act: 'Stake through the liquid staking protocol and hold the receipt token',
    weekly: 'Restake the staking rewards',
  },
  'Liquid Restaking': {
    act: 'Restake liquid staking tokens through the protocol',
    weekly: 'Delegate the restaked position to a new operator',
  },
  'Leveraged Farming': {
    act: 'Open a small leveraged farm position',
    weekly: 'Top up margin before the liquidation price gets close',
  },
  Restaking: {
    act: 'Restake staked assets through the protocol',
    weekly: 'Delegate to a new operator and check the slashing reports',
  },
  'Anchor BTC': {
    act: 'Deposit BTC into the anchor vault',
    weekly: 'Verify the latest reserve attestation for the vault',
  },
  'Decentralized BTC': {
    act: 'Mint decentralized BTC against collateral',
    weekly: 'Provide liquidity for the BTC trading pair',
  },
  CeDeFi: {
    act: 'Deposit into the CeDeFi vault',
    weekly: 'Check the custodian attestation and withdraw a small test amount',
  },
  'Dual-Token Stablecoin': {
    act: 'Mint the dual-token stablecoin pair',
    weekly: 'Adjust the mint ratio after price moves',
  },
  Farm: {
    act: 'Deposit into the farm',
    weekly: 'Harvest the rewards and compound them back in',
  },
  'Uncollateralized Lending': {
    act: 'Lend through the uncollateralized credit pool',
    weekly: 'Review borrower performance and rotate to a better pool',
  },
  'Interest Rate Derivatives': {
    act: 'Open a small interest-rate swap',
    weekly: 'Roll the swap into the next tenor',
  },
  Insurance: {
    act: 'Buy cover for a protocol you already use',
    weekly: 'Check the cover terms and renew before expiry',
  },
  Payments: {
    act: 'Use the protocol to pay for a routine purchase',
    weekly: 'Route one regular payment through it',
  },
  'Governance Incentives': {
    act: 'Lock tokens to vote on a governance proposal',
    weekly: 'Vote on the newest proposal and claim the incentive',
  },
  'Crypto Card Issuer': {
    act: 'Order the card and load it with a small balance',
    weekly: 'Spend through the card on a routine purchase',
  },
  'Prediction Market': {
    act: 'Trade a small position on an outcome market',
    weekly: 'Place a small trade on a market close to resolving',
  },
  'Stablecoin Wrapper': {
    act: 'Wrap stablecoins through the protocol',
    weekly: 'Mint and redeem a small amount to keep the address active',
  },
  Indexes: {
    act: 'Buy the index token',
    weekly: 'Rebalance toward the index newest weights',
  },
  'Collateral Markets': {
    act: 'Supply collateral to the market',
    weekly: 'Adjust the collateral mix after price moves',
  },
};

const DEFAULT_PLAY: Playbook = {
  act: 'Use the protocol core product with a small position',
  weekly: 'Repeat the core action once a week to stay active',
};

/** Six concrete steps to farm one row, each with a cost and a time. */
function farmPlan(row: BoardRow): string[] {
  const play = row.category === null ? DEFAULT_PLAY : (PLAYBOOK[row.category] ?? DEFAULT_PLAY);
  const secondChain = row.chains.length > 1 ? row.chains[1]! : row.chains[0]!;
  return [
    `Read ${row.name} docs and audits, and check its TVL history before depositing anything. Cost: $0. Time: about 30 minutes.`,
    `Start with $100-$500: ${play.act.charAt(0).toLowerCase()}${play.act.slice(1)}. Cost: about $1-$5 in gas plus the deposit. Time: about 20 minutes.`,
    `${play.weekly}. Cost: about $2-$10 in gas. Time: about 15 minutes a week.`,
    `Split the position across ${row.chains[0]!} and ${secondChain} so one chain outage cannot trap the whole deposit. Cost: about $2-$8 in bridge fees. Time: about 20 minutes.`,
    `Record every deposit, keep the transaction hashes, and check the dashboard weekly for TVL and points changes. Cost: $0. Time: about 10 minutes a week.`,
    `Decide the exit before any token launch: what share to claim and sell at launch and what to leave earning. Cost: $0. Time: about 20 minutes.`,
  ];
}

// ---------------------------------------------------------------- the board

const VERSION_MARKER = /\s(v|V)\d+\s*$|\s\d+\.\d+\s*$/;

/** A protocol whose name ends in a version marker, like V2 or 2.0. */
function isVersioned(name: string): boolean {
  return VERSION_MARKER.test(name);
}

/** A protocol records no token when both its token fields are null. */
function isPreToken(protocol: Protocol): boolean {
  return protocol.gecko_id === null && protocol.symbol === null;
}

/**
 * The board: every watchlist protocol, plus every pre-token protocol below
 * the floor that is not a centralised exchange and not a versioned pool.
 * Protocols whose token already trades never enter the ranking; the 24
 * largest of them at or above the floor, ranked by market cap, are set
 * aside for the live-token view instead.
 */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: Radar } {
  const peers = peerTable(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const candidates = snapshot.protocols.filter(
    (p) =>
      isPreToken(p) &&
      (watch.has(p.slug) || (p.tvl_usd < snapshot.floorUsd && p.category !== 'CEX' && !isVersioned(p.name))),
  );
  const scored = candidates.map((p) => {
    const factors = score(p, peers, snapshot.asOf);
    const row: BoardRow = {
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: [...p.chains],
      tvlUsd: p.tvl_usd,
      change7d: p.change_7d,
      ageDays: ageDays(p, snapshot.asOf),
      rank: 0,
      impliedValueUsd: factors.implied,
      comps: factors.comps,
      peerMedian: factors.peerMedian,
      growth: factors.growth,
      maturity: factors.maturity,
      breadth: factors.breadth,
      watchlist: watch.has(p.slug),
      farmSteps: [],
    };
    row.farmSteps = farmPlan(row);
    return row;
  });
  // Most valuable first; ties break by slug so the order never wobbles.
  scored.sort((a, b) => b.impliedValueUsd - a.impliedValueUsd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  scored.forEach((row, index) => {
    row.rank = index + 1;
  });
  const live = snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.tvl_usd >= snapshot.floorUsd)
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: [...p.chains],
      tvlUsd: p.tvl_usd,
      mcapUsd: p.mcap_usd!,
      change7d: p.change_7d,
    }));
  const categories = [...new Set(scored.map((r) => r.category).filter((c): c is string => c !== null))].sort();
  const chains = [...new Set(scored.flatMap((r) => r.chains))].sort();
  const radar: Radar = {
    asOf: snapshot.asOf,
    floorUsd: snapshot.floorUsd,
    rows: scored,
    live,
    earlySize: scored.filter((r) => !r.watchlist).length,
    liveSize: live.length,
    categories,
    chains,
  };
  return { board: scored, radar };
}

/**
 * The gate's own shape checks, run before anything is written: row count,
 * one slug each from the snapshot, ranks exactly 1..N, values never rising
 * with rank and not all equal, full watchlist coverage, and farm steps of
 * 3 to 12 strings of 20 to 600 characters.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100 to 4000`;
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const row of board) {
    if (!known.has(row.slug)) return `row ${row.slug} is not in the snapshot`;
    if (seen.has(row.slug)) return `slug ${row.slug} appears twice`;
    seen.add(row.slug);
    if (!Number.isInteger(row.impliedValueUsd) || row.impliedValueUsd <= 0 || row.impliedValueUsd > 100_000_000_000_000) {
      return `row ${row.slug} has a bad implied value`;
    }
    if (row.farmSteps.length < 3 || row.farmSteps.length > 12) return `row ${row.slug} holds ${row.farmSteps.length} farm steps`;
    for (const step of row.farmSteps) {
      const trimmed = step.trim();
      if (trimmed.length < 20 || trimmed.length > 600) return `row ${row.slug} has a farm step of ${trimmed.length} characters`;
    }
  }
  const ranks = [...board.map((r) => r.rank)].sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return `ranks are not exactly 1 to ${board.length}`;
  }
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.impliedValueUsd > byRank[i - 1]!.impliedValueUsd) return 'implied value rises with rank';
  }
  if (new Set(board.map((r) => r.impliedValueUsd)).size === 1) return 'every implied value is the same';
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist protocol ${slug} is missing from the board`;
  }
  return null;
}

/** The dashboard's data file: one global the page reads, nothing else. */
export function dataScript(radar: Radar): string {
  return `window.TOKEN_RADAR = ${JSON.stringify(radar)};\n`;
}
