// Logika Stroke Competition: ronde, grup (flight), skor per gate, ranking & tie-break.
(function (App) {
  const St = (App.stroke = {});

  St.TIEBREAKS = {
    'lowGates:last': 'Pukulan terkecil per fairway (ronde terakhir)',
    'lowGates:all': 'Pukulan terkecil per fairway (semua ronde)',
    bestMember: 'Skor pemain terbaik dalam tim',
    manual: 'Urutan manual (adu penalti / play-off)',
  };

  St.data = (ev) => {
    const all = App.S.stroke;
    if (!all[ev.id]) all[ev.id] = { rounds: [], manual: {} };
    const d = all[ev.id];
    const n = ev.kind === 'team' ? 0 : ev.config.rounds.length;
    while (d.rounds.length < n) d.rounds.push({ groups: [], scores: {}, scans: {} });
    d.manual = d.manual || {};
    return d;
  };

  St.score = (ev, ri, entryId, create) => {
    const r = St.data(ev).rounds[ri];
    if (!r.scores[entryId] && create) r.scores[entryId] = { g: [], ob: 0 };
    return r.scores[entryId] || { g: [], ob: 0 };
  };

  St.sumScore = (sc, gates) => {
    let sum = 0, played = 0;
    const list = [];
    for (let i = 0; i < gates; i++) {
      const v = sc.g[i];
      if (v !== null && v !== undefined && v !== '') { sum += +v; played++; list.push(+v); }
    }
    return { sum, played, gates: list, ob: +sc.ob || 0 };
  };

  // Jumlah gate dengan skor 1, 2, 3, 4, dan 5+ (urutan indeks 0..4).
  St.counts = (vals) => {
    const c = [0, 0, 0, 0, 0];
    vals.forEach((v) => { if (v > 0) c[Math.min(v, 5) - 1]++; });
    return c;
  };

  // Ronde penyisihan: semua ronde sebelum ronde ber-cut pertama (tanpa cut: semua ronde).
  St.prelimRounds = (ev) => {
    const rcs = ev.config.rounds || [];
    const cut = rcs.findIndex((rc) => rc.cut);
    return rcs.map((_, i) => i).slice(0, cut < 0 ? rcs.length : cut);
  };

  // Peringkat baru ditampilkan setelah semua peserta menyelesaikan seluruh gate ronde penyisihan.
  St.prelimDone = (ev) => {
    const pre = St.prelimRounds(ev);
    if (!pre.length) return true;
    return pre.every((ri) => {
      const ids = St.participants(ev, ri);
      return ids.length > 0 && ids.every((id) => St.sumScore(St.score(ev, ri, id), ev.config.rounds[ri].gates).played >= ev.config.rounds[ri].gates);
    });
  };

  St.inGroups = (ev, ri) => new Set(St.data(ev).rounds[ri].groups.flatMap((g) => g.entryIds));

  St.participants = (ev, ri) => {
    const d = St.data(ev);
    const r = d.rounds[ri];
    if (r.groups.length) return r.groups.flatMap((g) => g.entryIds);
    const rc = ev.config.rounds[ri];
    if (ri === 0 || !rc.cut) {
      // Peserta ronde tanpa cut = peserta ronde sebelumnya (atau semua entri).
      if (ri > 0 && d.rounds[ri - 1].groups.length) return d.rounds[ri - 1].groups.flatMap((g) => g.entryIds);
      return App.entriesOf(ev.id).map((e) => e.id);
    }
    return St.ranking(ev, ri).filter((row) => row.played > 0).slice(0, rc.cut).map((row) => row.entry.id);
  };

  function lowGatesCmp(a, b) {
    const x = a.slice().sort((p, q) => p - q);
    const y = b.slice().sort((p, q) => p - q);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  }

  function cmpRows(ev, a, b) {
    const manual = St.data(ev).manual;
    for (const tb of ev.config.tiebreak || []) {
      let c = 0;
      if (tb === 'lowGates:last') {
        const ra = a.rounds[a.reached], rb = b.rounds[b.reached];
        if (ra && rb) c = lowGatesCmp(ra.gates, rb.gates);
      } else if (tb === 'lowGates:all') {
        c = lowGatesCmp(a.rounds.flatMap((r) => r.gates), b.rounds.flatMap((r) => r.gates));
      } else if (tb === 'ob') {
        c = a.ob - b.ob;
      } else if (tb === 'bestMember') {
        c = (a.best ?? 1e9) - (b.best ?? 1e9);
      } else if (tb === 'manual') {
        const ma = manual[a.entry.id], mb = manual[b.entry.id];
        if (ma != null || mb != null) c = (ma ?? 1e9) - (mb ?? 1e9);
      }
      if (c !== 0) return { c, by: tb };
    }
    return { c: 0, by: null };
  }

  function assignRanks(ev, rows, primary) {
    rows.sort((a, b) => {
      const p = primary(a, b);
      if (p !== 0) return p;
      return cmpRows(ev, a, b).c;
    });
    rows.forEach((row, i) => {
      const prev = rows[i - 1];
      if (prev && primary(prev, row) === 0) {
        const t = cmpRows(ev, prev, row);
        if (t.c === 0) { row.rank = prev.rank; row.tied = prev.tied = row.played > 0; return; }
        row.tbBy = t.by;
        if (!prev.tbBy) prev.tbBy = t.by;
      }
      row.rank = i + 1;
    });
    return rows;
  }

  // Ranking individu/double. uptoRound = jumlah ronde yang dihitung (default semua).
  St.ranking = (ev, uptoRound) => {
    if (ev.kind === 'team') return St.teamRanking(ev);
    const d = St.data(ev);
    const rcs = ev.config.rounds;
    const upto = uptoRound ?? rcs.length;
    const groupSets = d.rounds.map((r) => new Set(r.groups.flatMap((g) => g.entryIds)));
    const rows = App.entriesOf(ev.id).map((entry) => {
      const rounds = [];
      let total = 0, played = 0, ob = 0, reached = 0;
      for (let ri = 0; ri < upto; ri++) {
        const s = St.sumScore(St.score(ev, ri, entry.id), rcs[ri].gates);
        rounds.push(s);
        total += s.sum; played += s.played; ob += s.ob;
        if (s.played > 0 || groupSets[ri].has(entry.id)) reached = ri;
      }
      // Ronde dengan cut hanya "dicapai" kalau peserta ada di grupnya.
      for (let ri = upto - 1; ri > 0; ri--) {
        if (rcs[ri].cut && !groupSets[ri].has(entry.id) && rounds[ri].played === 0) reached = Math.min(reached, ri - 1);
      }
      const expected = rcs.slice(0, reached + 1).reduce((s, r) => s + r.gates, 0);
      const counts = St.counts(rounds.flatMap((x) => x.gates)); // kumulatif semua ronde (R1 + R2 + Final)
      return { entry, rounds, total, played, ob, reached, counts, complete: played >= expected && played > 0 };
    });
    // Peserta yang lolos ke ronde cut selalu di atas yang tidak lolos; yang belum main paling bawah.
    const primary = (a, b) => (b.played > 0) - (a.played > 0) || b.reached - a.reached || a.total - b.total;
    return assignRanks(ev, rows, primary);
  };

  St.memberScore = (srcEv, athleteId, roundIdx) => {
    const e = App.entriesOf(srcEv.id).find((x) => x.members.includes(athleteId));
    if (!e) return { total: 0, played: 0, gates: [], ob: 0, found: false };
    let total = 0, played = 0, ob = 0;
    const gates = [];
    roundIdx.forEach((ri) => {
      if (!srcEv.config.rounds[ri]) return;
      const s = St.sumScore(St.score(srcEv, ri, e.id), srcEv.config.rounds[ri].gates);
      total += s.sum; played += s.played; ob += s.ob; gates.push(...s.gates);
    });
    return { total, played, gates, ob, found: true };
  };

  St.teamRanking = (ev) => {
    const src = App.event(ev.config.sourceEvent);
    const rows = App.entriesOf(ev.id).map((entry) => {
      const members = entry.members.filter(Boolean).map((aid) => ({ athleteId: aid, ...(src ? St.memberScore(src, aid, ev.config.sourceRounds) : { total: 0, played: 0, gates: [], ob: 0 }) }));
      const counted = members.filter((m) => m.played > 0).sort((a, b) => a.total - b.total).slice(0, ev.config.countBest);
      const total = counted.reduce((s, m) => s + m.total, 0);
      const played = counted.reduce((s, m) => s + m.played, 0);
      return {
        entry, members, total, played, reached: 0,
        ob: counted.reduce((s, m) => s + m.ob, 0),
        best: counted.length ? counted[0].total : null,
        counts: St.counts(counted.flatMap((m) => m.gates)),
        rounds: [{ gates: counted.flatMap((m) => m.gates) }],
        complete: counted.length >= Math.min(ev.config.countBest, members.length) && played > 0,
      };
    });
    const primary = (a, b) => (b.played > 0) - (a.played > 0) || a.total - b.total;
    return assignRanks(ev, rows, primary);
  };

  // Rincian Team Stroke: skor tiap gate per pemain (dari nomor single) dan jumlah tim per gate.
  // Hanya pemain yang dihitung (countBest terbaik) yang dijumlahkan.
  St.teamDetail = (ev) => {
    const src = App.event(ev.config.sourceEvent);
    if (!src) return null;
    const cols = [];
    (ev.config.sourceRounds || []).forEach((ri) => {
      const rc = src.config.rounds[ri];
      if (rc) for (let g = 0; g < rc.gates; g++) cols.push({ ri, g, round: rc.name });
    });
    const teams = St.ranking(ev).map((row) => {
      const counted = new Set(row.members.filter((m) => m.played > 0).sort((a, b) => a.total - b.total).slice(0, ev.config.countBest).map((m) => m.athleteId));
      const members = row.members.map((m) => {
        const e = App.entriesOf(src.id).find((x) => x.members.includes(m.athleteId));
        const vals = cols.map((c) => {
          const v = e ? St.score(src, c.ri, e.id).g[c.g] : null;
          return v === null || v === undefined || v === '' ? null : +v;
        });
        return { athleteId: m.athleteId, counted: counted.has(m.athleteId), vals, total: m.total, played: m.played };
      });
      const sums = cols.map((_, i) => {
        const xs = members.filter((m) => m.counted).map((m) => m.vals[i]).filter((v) => v !== null);
        return xs.length ? xs.reduce((s, v) => s + v, 0) : null;
      });
      return { row, members, sums };
    });
    return { src, cols, teams };
  };

  // ---------- Grup / flight ----------
  St.spreadOrder = (ids) => {
    const shuffled = App.shuffle(ids);
    const byK = {};
    shuffled.forEach((id) => {
      const k = (App.entry(id) || {}).kontingenId || '-';
      (byK[k] = byK[k] || []).push(id);
    });
    const buckets = App.shuffle(Object.values(byK)).sort((a, b) => b.length - a.length);
    const out = [];
    while (buckets.some((b) => b.length)) buckets.forEach((b) => b.length && out.push(b.shift()));
    return out;
  };

  St.generateGroups = (ev, ri, mode) => {
    const d = St.data(ev);
    if (mode === 'copy') {
      // Sama dengan ronde sebelumnya: orang, nomor pairing, lapangan, dan jam yang sama.
      d.rounds[ri].groups = d.rounds[ri - 1].groups.map((g) => ({ ...g, id: App.uid('g_'), entryIds: g.entryIds.slice() }));
      return;
    }
    d.rounds[ri].groups = [];
    let ids = St.participants(ev, ri);
    if (mode === 'random') ids = St.spreadOrder(ids);
    else if (mode === 'rank') {
      const order = St.ranking(ev, ri).map((r) => r.entry.id);
      ids = ids.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
    const lanes = (App.S.event.lanes || 'A').split(',').map((s) => s.trim()).filter(Boolean);
    d.rounds[ri].groups = App.chunk(ids, ev.config.groupSize || 4).map((entryIds, i) => ({
      id: App.uid('g_'), no: i + 1, lane: lanes[i % lanes.length] || '', time: '', entryIds,
    }));
  };

  St.moveToGroup = (ev, ri, entryId, groupNo) => {
    const r = St.data(ev).rounds[ri];
    r.groups.forEach((g) => (g.entryIds = g.entryIds.filter((id) => id !== entryId)));
    if (!groupNo) return;
    let g = r.groups.find((x) => x.no === groupNo);
    if (!g) {
      g = { id: App.uid('g_'), no: groupNo, lane: '', time: '', entryIds: [] };
      r.groups.push(g);
      r.groups.sort((a, b) => a.no - b.no);
    }
    g.entryIds.push(entryId);
  };

  St.cleanGroups = (ev, ri) => {
    const r = St.data(ev).rounds[ri];
    r.groups = r.groups.filter((g) => g.entryIds.length);
  };

  // Status ringkas per ronde untuk dashboard.
  St.progress = (ev) => {
    if (ev.kind === 'team') return null;
    return ev.config.rounds.map((rc, ri) => {
      const ids = St.participants(ev, ri);
      const done = ids.filter((id) => St.sumScore(St.score(ev, ri, id), rc.gates).played >= rc.gates).length;
      return { name: rc.name, total: ids.length, done };
    });
  };
})(window.App);
