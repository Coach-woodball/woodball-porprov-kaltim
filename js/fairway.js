// Logika Fairway Competition: hasil per gate, sudden death, grup (round-robin), bagan gugur, tim (best of 3).
(function (App) {
  const Fw = (App.fairway = {});

  Fw.FORMATS = {
    ko: 'Sistem gugur (bagan langsung)',
    group_ko: 'Grup (setengah kompetisi) + bagan gugur',
    rr: 'Setengah kompetisi penuh (klasemen)',
  };
  Fw.THIRD = { match: 'Perebutan juara 3', shared: 'Juara 3 bersama (2 perunggu)', none: 'Tanpa juara 3' };

  Fw.data = (ev) => {
    const all = App.S.fairway;
    if (!all[ev.id]) all[ev.id] = { groups: [], matches: [], seeds: [], manual: {} };
    const d = all[ev.id];
    d.manual = d.manual || {};
    d.seeds = d.seeds || [];
    return d;
  };

  Fw.newGames = (ev) => (ev.kind === 'team'
    ? ev.config.games.map((g) => ({ label: g.label, slots: g.slots.slice(), gates: [], extra: [], override: null, scans: [] }))
    : [{ label: '', slots: null, gates: [], extra: [], override: null, scans: [] }]);

  Fw.newMatch = (ev, props) => Object.assign({
    id: App.uid('m_'), stage: 'group', group: null, round: 1, pos: 0, a: null, b: null,
    srcA: null, srcB: null, games: Fw.newGames(ev), override: null, note: '', lane: '', time: '', date: '',
  }, props);

  Fw.match = (ev, id) => Fw.data(ev).matches.find((m) => m.id === id);

  const has = (v) => v !== null && v !== undefined && v !== '';

  Fw.gameResult = (ev, game) => {
    const N = ev.config.gates || 12;
    let pa = 0, pb = 0, played = 0, even = 0;
    for (let i = 0; i < N; i++) {
      const [x, y] = game.gates[i] || [];
      if (!has(x) || !has(y)) continue;
      played++;
      if (+x < +y) pa++; else if (+y < +x) pb++; else even++;
    }
    let winner = null, sd = null, status = played ? 'live' : 'none';
    const remaining = N - played;
    if (game.override === 'a' || game.override === 'b') { winner = game.override; status = 'done'; }
    else if (pa - pb > remaining) { winner = 'a'; status = 'done'; }
    else if (pb - pa > remaining) { winner = 'b'; status = 'done'; }
    else if (remaining === 0 && pa === pb) {
      status = 'sd';
      for (let i = 0; i < (game.extra || []).length; i++) {
        const [x, y] = game.extra[i] || [];
        if (!has(x) || !has(y)) break;
        if (+x !== +y) { winner = +x < +y ? 'a' : 'b'; sd = i + 1; status = 'done'; break; }
      }
    }
    return { pa, pb, even, played, remaining, winner, sd, status };
  };

  // Resolusi peserta di sisi a/b (bisa dari pemenang/kalah pertandingan sebelumnya).
  Fw.sideId = (ev, m, side, depth = 0) => {
    if (m[side]) return m[side];
    const src = side === 'a' ? m.srcA : m.srcB;
    if (!src || depth > 12) return null;
    const sm = Fw.match(ev, src.m);
    if (!sm) return null;
    const r = Fw.matchResult(ev, sm, depth + 1);
    return src.take === 'L' ? r.loserId : r.winnerId;
  };

  Fw.matchResult = (ev, m, depth = 0) => {
    const a = Fw.sideId(ev, m, 'a', depth), b = Fw.sideId(ev, m, 'b', depth);
    const out = { a, b, winner: null, winnerId: null, loserId: null, sa: 0, sb: 0, pa: 0, pb: 0, status: 'none', games: [] };
    if (a === 'BYE' || b === 'BYE') {
      if (a === 'BYE' && b === 'BYE') { out.winnerId = 'BYE'; out.loserId = 'BYE'; out.status = 'done'; return out; }
      const real = a === 'BYE' ? b : a;
      if (real) { out.winner = a === 'BYE' ? 'b' : 'a'; out.winnerId = real; out.loserId = 'BYE'; out.status = 'bye'; }
      return out;
    }
    out.games = m.games.map((g) => Fw.gameResult(ev, g));
    out.pa = out.games.reduce((s, g) => s + g.pa, 0);
    out.pb = out.games.reduce((s, g) => s + g.pb, 0);
    if (ev.kind === 'team') {
      out.sa = out.games.filter((g) => g.winner === 'a').length;
      out.sb = out.games.filter((g) => g.winner === 'b').length;
      const need = Math.floor(m.games.length / 2) + 1;
      if (out.sa >= need) out.winner = 'a'; else if (out.sb >= need) out.winner = 'b';
    } else {
      const g = out.games[0];
      out.sa = g.pa; out.sb = g.pb;
      out.winner = g.winner;
      out.sd = g.sd;
    }
    if (m.override === 'a' || m.override === 'b') out.winner = m.override;
    const anyPlayed = out.games.some((g) => g.played > 0);
    out.status = out.winner ? 'done' : anyPlayed ? 'live' : 'none';
    if (out.winner && a && b) {
      out.winnerId = out.winner === 'a' ? a : b;
      out.loserId = out.winner === 'a' ? b : a;
    }
    return out;
  };

  // ---------- Round robin ----------
  Fw.roundRobin = (ids) => {
    const list = ids.slice();
    if (list.length % 2) list.push(null);
    const n = list.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const x = list[i], y = list[n - 1 - i];
        if (x && y) pairs.push(r % 2 ? [y, x] : [x, y]);
      }
      rounds.push(pairs);
      list.splice(1, 0, list.pop());
    }
    return rounds;
  };

  Fw.generateGroups = (ev, mode, groupCount) => {
    const d = Fw.data(ev);
    const ids = App.entriesOf(ev.id).map((e) => e.id);
    const order = mode === 'random' ? App.stroke.spreadOrder(ids) : ids;
    const G = Math.max(1, Math.min(groupCount || 1, Math.floor(ids.length / 2) || 1));
    const groups = Array.from({ length: G }, (_, i) => ({ id: App.uid('gr_'), name: String.fromCharCode(65 + i), entryIds: [] }));
    order.forEach((id, i) => groups[i % G].entryIds.push(id));
    d.groups = groups;
    d.matches = d.matches.filter((m) => m.stage !== 'group');
    Fw.createGroupMatches(ev);
  };

  Fw.createGroupMatches = (ev) => {
    const d = Fw.data(ev);
    d.matches = d.matches.filter((m) => m.stage !== 'group');
    d.groups.forEach((g) => {
      Fw.roundRobin(g.entryIds).forEach((pairs, ri) => pairs.forEach(([a, b], pi) => {
        d.matches.push(Fw.newMatch(ev, { stage: 'group', group: g.id, round: ri + 1, pos: pi, a, b }));
      }));
    });
  };

  Fw.groupMatches = (ev, groupId) => Fw.data(ev).matches.filter((m) => m.stage === 'group' && m.group === groupId)
    .sort((x, y) => x.round - y.round || x.pos - y.pos);

  Fw.standings = (ev, group) => {
    const d = Fw.data(ev);
    const wp = ev.config.winPoints ?? 2;
    const rows = group.entryIds.map((id) => ({ entryId: id, main: 0, menang: 0, kalah: 0, pm: 0, pk: 0, sk: 0, poin: 0, gp: 0 }));
    const by = Object.fromEntries(rows.map((r) => [r.entryId, r]));
    Fw.groupMatches(ev, group.id).forEach((m) => {
      const r = Fw.matchResult(ev, m);
      if (r.status !== 'done') return;
      const A = by[r.a], B = by[r.b];
      if (!A || !B) return;
      A.main++; B.main++;
      A.pm += r.sa; A.pk += r.sb; B.pm += r.sb; B.pk += r.sa;
      A.gp += r.pa - r.pb; B.gp += r.pb - r.pa;
      if (r.winner === 'a') { A.menang++; B.kalah++; } else { B.menang++; A.kalah++; }
    });
    rows.forEach((r) => { r.sk = r.pm - r.pk; r.poin = r.menang * wp; });
    const manual = d.manual[group.id] || {};
    rows.sort((a, b) => b.poin - a.poin || b.sk - a.sk || b.gp - a.gp || b.pm - a.pm
      || (manual[a.entryId] ?? 1e9) - (manual[b.entryId] ?? 1e9));
    rows.forEach((r, i) => {
      const p = rows[i - 1];
      r.rank = p && p.poin === r.poin && p.sk === r.sk && p.gp === r.gp && p.pm === r.pm
        && (manual[p.entryId] ?? 1e9) === (manual[r.entryId] ?? 1e9) ? p.rank : i + 1;
      if (p && p.rank === r.rank) r.tied = p.tied = true;
    });
    return rows;
  };

  Fw.groupDone = (ev, groupId) => Fw.groupMatches(ev, groupId).every((m) => Fw.matchResult(ev, m).status === 'done');

  // ---------- Bagan gugur ----------
  const seedOrder = (n) => {
    let r = [1];
    while (r.length < n) { const m = r.length * 2 + 1; r = r.flatMap((x) => [x, m - x]); }
    return r;
  };

  Fw.roundName = (matchesInRound) => (matchesInRound === 1 ? 'Final' : matchesInRound === 2 ? 'Semifinal'
    : matchesInRound === 4 ? 'Perempat Final' : `${matchesInRound * 2} Besar`);

  Fw.buildKO = (ev, seeds) => {
    const d = Fw.data(ev);
    d.matches = d.matches.filter((m) => m.stage === 'group');
    const n = seeds.length;
    if (n < 2) return;
    let size = 2;
    while (size < n) size *= 2;
    const order = seedOrder(size);
    const R = Math.log2(size);
    let prev = [];
    for (let r = 1; r <= R; r++) {
      const count = size / Math.pow(2, r);
      const cur = [];
      for (let i = 0; i < count; i++) {
        const props = { stage: 'ko', round: r, pos: i };
        if (r === 1) {
          const sa = order[i * 2], sb = order[i * 2 + 1];
          props.a = sa <= n ? seeds[sa - 1] : 'BYE';
          props.b = sb <= n ? seeds[sb - 1] : 'BYE';
        } else {
          props.srcA = { m: prev[i * 2].id, take: 'W' };
          props.srcB = { m: prev[i * 2 + 1].id, take: 'W' };
        }
        const m = Fw.newMatch(ev, props);
        cur.push(m);
        d.matches.push(m);
      }
      if (r === R && R >= 2 && ev.config.thirdPlace === 'match') {
        const sf = d.matches.filter((m) => m.stage === 'ko' && m.round === R - 1);
        d.matches.push(Fw.newMatch(ev, { stage: 'third', round: R, pos: 1, srcA: { m: sf[0].id, take: 'L' }, srcB: { m: sf[1].id, take: 'L' } }));
      }
      prev = cur;
    }
  };

  Fw.koMatches = (ev) => Fw.data(ev).matches.filter((m) => m.stage === 'ko' || m.stage === 'third')
    .sort((x, y) => x.round - y.round || (x.stage === 'third') - (y.stage === 'third') || x.pos - y.pos);

  Fw.koRounds = (ev) => {
    const ko = Fw.data(ev).matches.filter((m) => m.stage === 'ko');
    const R = Math.max(0, ...ko.map((m) => m.round));
    return Array.from({ length: R }, (_, i) => ko.filter((m) => m.round === i + 1).sort((a, b) => a.pos - b.pos));
  };

  Fw.groupSeeds = (ev) => {
    const d = Fw.data(ev);
    const q = ev.config.qualify || 2;
    const tables = d.groups.map((g) => Fw.standings(ev, g));
    const G = tables.length;
    const seeds = [];
    for (let place = 0; place < q; place++) {
      let idx = tables.map((_, i) => i);
      if (place % 2 === 1) {
        const rot = Math.floor(G / 2);
        idx = idx.slice(rot).concat(idx.slice(0, rot)).reverse();
      }
      idx.forEach((gi) => tables[gi][place] && seeds.push(tables[gi][place].entryId));
    }
    return seeds;
  };

  // ---------- Peringkat akhir untuk medali ----------
  Fw.placements = (ev) => {
    const d = Fw.data(ev);
    const fmt = ev.config.format;
    const out = [];
    if (fmt === 'rr' || (fmt === 'group_ko' && !Fw.koMatches(ev).length && d.groups.length === 1)) {
      const g = d.groups[0];
      if (!g) return { list: [], final: false };
      const table = Fw.standings(ev, g);
      const final = Fw.groupDone(ev, g.id);
      table.forEach((r) => out.push({ rank: r.rank, entryId: r.entryId }));
      return { list: out, final };
    }
    const rounds = Fw.koRounds(ev);
    if (!rounds.length) return { list: [], final: false };
    const fin = rounds[rounds.length - 1][0];
    const fr = Fw.matchResult(ev, fin);
    let final = fr.status === 'done';
    if (fr.winnerId && fr.winnerId !== 'BYE') out.push({ rank: 1, entryId: fr.winnerId });
    if (fr.loserId && fr.loserId !== 'BYE') out.push({ rank: 2, entryId: fr.loserId });
    const third = d.matches.find((m) => m.stage === 'third');
    if (ev.config.thirdPlace === 'match' && third) {
      const tr = Fw.matchResult(ev, third);
      if (tr.winnerId && tr.winnerId !== 'BYE') out.push({ rank: 3, entryId: tr.winnerId });
      if (tr.loserId && tr.loserId !== 'BYE') out.push({ rank: 4, entryId: tr.loserId });
      final = final && tr.status === 'done';
    } else if (ev.config.thirdPlace === 'shared' && rounds.length >= 2) {
      rounds[rounds.length - 2].forEach((m) => {
        const r = Fw.matchResult(ev, m);
        if (r.loserId && r.loserId !== 'BYE') out.push({ rank: 3, entryId: r.loserId });
      });
    }
    return { list: out, final };
  };

  Fw.stageLabel = (ev, m) => {
    if (m.stage === 'group') {
      const g = Fw.data(ev).groups.find((x) => x.id === m.group);
      return `Grup ${g ? g.name : '?'} - Putaran ${m.round}`;
    }
    if (m.stage === 'third') return 'Perebutan Juara 3';
    const rounds = Fw.koRounds(ev);
    return Fw.roundName(rounds[m.round - 1]?.length || 1);
  };

  // Nama pemain di partai tim (Tunggal I, Ganda, dst).
  Fw.gamePlayers = (ev, entryId, game) => {
    const e = App.entry(entryId);
    if (!e) return entryId === 'BYE' ? 'BYE' : '-';
    if (ev.kind !== 'team' || !game.slots) return App.entryName(e);
    return game.slots.map((s) => App.athName(e.members[s])).join(' / ');
  };

  Fw.progress = (ev) => {
    const ms = Fw.data(ev).matches.filter((m) => {
      const r = Fw.matchResult(ev, m);
      return r.status !== 'bye' && !(r.a === 'BYE' && r.b === 'BYE');
    });
    return { total: ms.length, done: ms.filter((m) => Fw.matchResult(ev, m).status === 'done').length };
  };
})(window.App);
