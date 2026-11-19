// Token Radar dashboard — renders the board from window.TOKEN_RADAR.
//
// A dark terminal page: the ranked board, a detail view for each protocol
// with the whole model behind it, and the filters a reader needs to find
// something worth farming. No network, no framework, no storage: the page
// reads the data file written beside it and nothing else.

(function () {
  'use strict';

  var DATA = window.TOKEN_RADAR;
  var root = document.getElementById('board');
  if (!DATA || !root) return;

  // ------------------------------------------------------------ formatting

  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(value) {
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
    return '$' + String(Math.round(value));
  }

  function moneyFull(value) {
    return '$' + Math.round(value).toLocaleString('en-US');
  }

  function pct(value) {
    if (value === null || value === undefined) return '—';
    var sign = value > 0 ? '+' : '';
    return sign + value.toFixed(2) + '%';
  }

  function mult(value) {
    return 'x' + value.toFixed(2);
  }

  function ageLabel(days) {
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  // ------------------------------------------------------------ state

  var state = {
    tab: 'pre',
    query: '',
    category: '',
    chain: '',
    minTvl: 0,
    watchOnly: false,
    sortKey: 'rank',
    sortDir: 1,
  };

  function readHash() {
    var hash = window.location.hash.slice(1);
    if (!hash) return {};
    var out = {};
    hash.split('&').forEach(function (pair) {
      var parts = pair.split('=');
      if (parts.length === 2) out[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    });
    return out;
  }

  // ------------------------------------------------------------ filtering

  function visibleRows() {
    var rows = state.tab === 'live' ? DATA.live : DATA.rows;
    var query = state.query.trim().toLowerCase();
    return rows.filter(function (row) {
      if (state.tab === 'pre') {
        if (state.category && row.category !== state.category) return false;
        if (state.chain && row.chains.indexOf(state.chain) === -1) return false;
        if (state.minTvl && row.tvlUsd < state.minTvl) return false;
        if (state.watchOnly && !row.watchlist) return false;
      }
      if (query) {
        var hay = (row.name + ' ' + row.slug + ' ' + (row.category || '')).toLowerCase();
        if (hay.indexOf(query) === -1) return false;
      }
      return true;
    });
  }

  function sortedRows(rows) {
    var key = state.sortKey;
    var dir = state.sortDir;
    var copy = rows.slice();
    copy.sort(function (a, b) {
      var va = key === 'name' ? a.name.toLowerCase() : a[key];
      var vb = key === 'name' ? b.name.toLowerCase() : b[key];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return a.slug < b.slug ? -1 : 1;
    });
    return copy;
  }

  // ------------------------------------------------------------ the table

  function headerCell(label, key, numeric) {
    var arrow = state.sortKey === key ? (state.sortDir === 1 ? ' ▲' : ' ▼') : '';
    var cls = numeric ? 'num' : '';
    return (
      '<th class="' +
      cls +
      '" data-sort="' +
      key +
      '" tabindex="0" role="button" aria-sort="' +
      (state.sortKey === key ? (state.sortDir === 1 ? 'ascending' : 'descending') : 'none') +
      '">' +
      esc(label) +
      arrow +
      '</th>'
    );
  }

  function preTable(rows) {
    var head =
      '<tr>' +
      headerCell('#', 'rank', true) +
      headerCell('Protocol', 'name', false) +
      headerCell('Category', 'category', false) +
      '<th>Chains</th>' +
      headerCell('TVL', 'tvlUsd', true) +
      headerCell('7d', 'change7d', true) +
      headerCell('Age', 'ageDays', true) +
      headerCell('Comps', 'comps', true) +
      headerCell('Implied value', 'impliedValueUsd', true) +
      '</tr>';
    var body = rows
      .map(function (row) {
        var chg = row.change7d === null ? '—' : pct(row.change7d);
        var chgCls = row.change7d === null ? '' : row.change7d >= 0 ? 'up' : 'down';
        var chains = row.chains.slice(0, 3).join(', ') + (row.chains.length > 3 ? ' +' + (row.chains.length - 3) : '');
        return (
          '<tr data-slug="' +
          esc(row.slug) +
          '">' +
          '<td class="num rank">' +
          row.rank +
          '</td>' +
          '<td class="proto"><span class="name">' +
          esc(row.name) +
          '</span>' +
          (row.watchlist ? ' <span class="star" title="On the watchlist">★</span>' : '') +
          '<span class="slug">' +
          esc(row.slug) +
          '</span></td>' +
          '<td>' +
          esc(row.category || '—') +
          '</td>' +
          '<td class="chains">' +
          esc(chains) +
          '</td>' +
          '<td class="num">' +
          money(row.tvlUsd) +
          '</td>' +
          '<td class="num ' +
          chgCls +
          '">' +
          chg +
          '</td>' +
          '<td class="num">' +
          ageLabel(row.ageDays) +
          '</td>' +
          '<td class="num">' +
          mult(row.comps) +
          '</td>' +
          '<td class="num strong">' +
          money(row.impliedValueUsd) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
    return '<table class="grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  function liveTable(rows) {
    var head =
      '<tr>' +
      headerCell('#', 'mcapUsd', true) +
      headerCell('Protocol', 'name', false) +
      headerCell('Category', 'category', false) +
      '<th>Chains</th>' +
      headerCell('TVL', 'tvlUsd', true) +
      headerCell('7d', 'change7d', true) +
      headerCell('Market cap', 'mcapUsd', true) +
      '</tr>';
    var body = rows
      .map(function (row, index) {
        var chg = row.change7d === null ? '—' : pct(row.change7d);
        var chgCls = row.change7d === null ? '' : row.change7d >= 0 ? 'up' : 'down';
        var chains = row.chains.slice(0, 3).join(', ') + (row.chains.length > 3 ? ' +' + (row.chains.length - 3) : '');
        return (
          '<tr>' +
          '<td class="num rank">' +
          (index + 1) +
          '</td>' +
          '<td class="proto"><span class="name">' +
          esc(row.name) +
          '</span><span class="slug">' +
          esc(row.slug) +
          '</span></td>' +
          '<td>' +
          esc(row.category || '—') +
          '</td>' +
          '<td class="chains">' +
          esc(chains) +
          '</td>' +
          '<td class="num">' +
          money(row.tvlUsd) +
          '</td>' +
          '<td class="num ' +
          chgCls +
          '">' +
          chg +
          '</td>' +
          '<td class="num strong">' +
          money(row.mcapUsd) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
    return '<table class="grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  // ------------------------------------------------------------ the detail

  function factorLine(label, value, note) {
    return (
      '<div class="factor"><span class="flabel">' +
      esc(label) +
      '</span><span class="fvalue">' +
      esc(value) +
      '</span><span class="fnote">' +
      esc(note) +
      '</span></div>'
    );
  }

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) {
      if (DATA.rows[i].slug === slug) {
        row = DATA.rows[i];
        break;
      }
    }
    var overlay = document.getElementById('detail');
    if (!row || !overlay) return;
    var recomputed = Math.round(row.tvlUsd * row.comps * row.growth * row.maturity * row.breadth);
    var steps = row.farmSteps
      .map(function (step, index) {
        return '<li><span class="stepnum">' + (index + 1) + '</span><span>' + esc(step) + '</span></li>';
      })
      .join('');
    overlay.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' +
      esc(row.name) +
      ' detail">' +
      '<button class="close" id="detail-close" aria-label="Close detail">×</button>' +
      '<p class="eyebrow">Rank ' +
      row.rank +
      ' of ' +
      DATA.rows.length +
      (row.watchlist ? ' · on the watchlist' : '') +
      '</p>' +
      '<h2>' +
      esc(row.name) +
      '</h2>' +
      '<p class="sub">' +
      esc(row.category || 'No category') +
      ' · ' +
      esc(row.chains.join(', ')) +
      ' · tracked ' +
      ageLabel(row.ageDays) +
      '</p>' +
      '<div class="big">' +
      moneyFull(row.impliedValueUsd) +
      ' <span>implied value</span></div>' +
      '<p class="check">Recomputed from the factors below: ' +
      moneyFull(recomputed) +
      (recomputed === row.impliedValueUsd ? ' — matches the board.' : ' — differs from the board.') +
      '</p>' +
      '<h3>How the value is priced</h3>' +
      '<div class="factors">' +
      factorLine('TVL', moneyFull(row.tvlUsd), 'the snapshot figure') +
      factorLine('Peer median', mult(row.peerMedian) + ' mcap / TVL', 'category peers that already trade') +
      factorLine('Comps', mult(row.comps), '60% category median, 40% global, clamped 0.05–0.80') +
      factorLine('Growth', mult(row.growth), '7d change ' + (row.change7d === null ? 'unreported' : pct(row.change7d)) + ', clamped −40% to +80%') +
      factorLine('Maturity', mult(row.maturity), ageLabel(row.ageDays) + ' tracked, 0.70 new to 1.20 at two years') +
      factorLine('Breadth', mult(row.breadth), row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ', +2% each up to 8 extra') +
      '</div>' +
      '<h3>Farm plan</h3>' +
      '<ol class="steps">' +
      steps +
      '</ol>' +
      '</div>';
    overlay.classList.add('open');
    var closeBtn = document.getElementById('detail-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDetail);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeDetail();
    });
  }

  function closeDetail() {
    var overlay = document.getElementById('detail');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.innerHTML = '';
    }
  }

  // ------------------------------------------------------------ the page

  function optionList(values, current, allLabel) {
    var out = '<option value="">' + esc(allLabel) + '</option>';
    values.forEach(function (value) {
      out += '<option value="' + esc(value) + '"' + (value === current ? ' selected' : '') + '>' + esc(value) + '</option>';
    });
    return out;
  }

  function render() {
    var filtered = visibleRows();
    var sorted = sortedRows(filtered);
    var total = state.tab === 'live' ? DATA.live.length : DATA.rows.length;
    var table = state.tab === 'live' ? liveTable(sorted) : preTable(sorted);
    var filters =
      state.tab === 'pre'
        ? '<label>Category <select id="f-cat">' +
          optionList(DATA.categories, state.category, 'All categories') +
          '</select></label>' +
          '<label>Chain <select id="f-chain">' +
          optionList(DATA.chains, state.chain, 'All chains') +
          '</select></label>' +
          '<label>Min TVL <select id="f-tvl">' +
          '<option value="0"' +
          (state.minTvl === 0 ? ' selected' : '') +
          '>Any</option>' +
          '<option value="50000000"' +
          (state.minTvl === 50000000 ? ' selected' : '') +
          '>$50M</option>' +
          '<option value="100000000"' +
          (state.minTvl === 100000000 ? ' selected' : '') +
          '>$100M</option>' +
          '<option value="500000000"' +
          (state.minTvl === 500000000 ? ' selected' : '') +
          '>$500M</option>' +
          '<option value="1000000000"' +
          (state.minTvl === 1000000000 ? ' selected' : '') +
          '>$1B</option>' +
          '</select></label>' +
          '<label class="check"><input type="checkbox" id="f-watch"' +
          (state.watchOnly ? ' checked' : '') +
          '> Watchlist only</label>'
        : '<p class="live-note">Protocols whose token already trades, ranked by market cap. They never enter the ranking above — this tab is the separation, so a reader can tell a launch that already happened from one still to come.</p>';
    root.innerHTML =
      '<header>' +
      '<p class="eyebrow">TOKEN RADAR · snapshot ' +
      esc(DATA.asOf) +
      ' · floor ' +
      money(DATA.floorUsd) +
      '</p>' +
      '<h1>Pre-token protocols, ranked by implied value</h1>' +
      '<p class="lede">Every protocol below records no token. Its implied value is TVL × comps × growth × maturity × breadth, priced from the snapshot itself — never from a list of names. Click a row for the full breakdown and the six steps to farm it.</p>' +
      '</header>' +
      '<nav class="tabs" role="tablist">' +
      '<button class="tab' +
      (state.tab === 'pre' ? ' active' : '') +
      '" data-tab="pre" role="tab" aria-selected="' +
      (state.tab === 'pre') +
      '">Pre-token · ' +
      DATA.rows.length +
      '</button>' +
      '<button class="tab' +
      (state.tab === 'live' ? ' active' : '') +
      '" data-tab="live" role="tab" aria-selected="' +
      (state.tab === 'live') +
      '">Live token · ' +
      DATA.live.length +
      '</button>' +
      '</nav>' +
      '<div class="controls">' +
      '<label class="search">Search <input type="search" id="f-q" value="' +
      esc(state.query) +
      '" placeholder="Name or slug" aria-label="Search protocols"></label>' +
      filters +
      '</div>' +
      '<p class="count">Showing ' +
      sorted.length +
      ' of ' +
      total +
      ' rows' +
      (state.tab === 'pre' ? ' · ' + DATA.rows.filter(function (r) { return r.watchlist; }).length + ' on the watchlist, ' + DATA.earlySize + ' early' : '') +
      '</p>' +
      '<div class="tablewrap">' +
      table +
      '</div>' +
      '<footer><p>Implied value is this radar own claim, priced from the snapshot: category peer median mcap/TVL blended 60/40 with the global median and clamped 0.05–0.80, seven-day growth clamped −40% to +80%, maturity 0.70–1.20 over two years, breadth +2% per extra chain to 1.16. A protocol that records no token may still have one its record does not carry.</p></footer>' +
      '<div class="overlay" id="detail"></div>';
    root.setAttribute('aria-busy', 'false');
    wire();
  }

  function wire() {
    var tabs = root.querySelectorAll('.tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.tab = tab.getAttribute('data-tab');
        state.sortKey = state.tab === 'live' ? 'mcapUsd' : 'rank';
        state.sortDir = state.tab === 'live' ? -1 : 1;
        render();
      });
    });
    var q = document.getElementById('f-q');
    if (q) {
      q.addEventListener('input', function () {
        state.query = q.value;
        render();
        var again = document.getElementById('f-q');
        if (again) {
          again.focus();
          again.setSelectionRange(again.value.length, again.value.length);
        }
      });
    }
    var cat = document.getElementById('f-cat');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; render(); });
    var chain = document.getElementById('f-chain');
    if (chain) chain.addEventListener('change', function () { state.chain = chain.value; render(); });
    var tvl = document.getElementById('f-tvl');
    if (tvl) tvl.addEventListener('change', function () { state.minTvl = Number(tvl.value); render(); });
    var watch = document.getElementById('f-watch');
    if (watch) watch.addEventListener('change', function () { state.watchOnly = watch.checked; render(); });
    root.querySelectorAll('th[data-sort]').forEach(function (th) {
      var flip = function () {
        var key = th.getAttribute('data-sort');
        if (state.sortKey === key) state.sortDir = -state.sortDir;
        else {
          state.sortKey = key;
          state.sortDir = key === 'name' || key === 'category' ? 1 : -1;
        }
        render();
      };
      th.addEventListener('click', flip);
      th.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          flip();
        }
      });
    });
    root.querySelectorAll('tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        openDetail(tr.getAttribute('data-slug'));
      });
      tr.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') openDetail(tr.getAttribute('data-slug'));
      });
      tr.setAttribute('tabindex', '0');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDetail();
    });
  }

  // ------------------------------------------------------------ start

  var params = readHash();
  if (params.cat) state.category = params.cat;
  render();
  if (params.detail) openDetail(params.detail);
})();
