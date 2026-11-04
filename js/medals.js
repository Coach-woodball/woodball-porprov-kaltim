// Peringkat akhir tiap nomor, rekap medali per kontingen, dan validasi peserta (peringatan saja).
(function (App) {
  App.placements = (ev) => {
    if (ev.discipline === 'fairway') return App.fairway.placements(ev);
    const rows = App.stroke.ranking(ev).filter((r) => r.played > 0);
    return { list: rows.map((r) => ({ rank: r.rank, entryId: r.entry.id, tied: r.tied })), final: rows.length > 0 && rows.every((r) => r.complete) };
  };

  App.medalTally = () => {
    const tally = Object.fromEntries(App.S.kontingen.map((k) => [k.id, { k, gold: 0, silver: 0, bronze: 0, pieces: 0, wins: [] }]));
    const perEvent = [];
    App.S.events.forEach((ev) => {
      const pl = App.placements(ev);
      const medalists = pl.list.filter((p) => p.rank <= 3);
      perEvent.push({ ev, medalists, final: pl.final });
      medalists.forEach((p) => {
        const e = App.entry(p.entryId);
        if (!e || !tally[e.kontingenId]) return;
        const t = tally[e.kontingenId];
        const key = p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : 'bronze';
        t[key]++;
        t.pieces += e.members.filter(Boolean).length;
        t.wins.push({ ev, rank: p.rank, entry: e });
      });
    });
    const rows = Object.values(tally).sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.k.name.localeCompare(b.k.name));
    rows.forEach((r, i) => {
      const p = rows[i - 1];
      r.rank = p && p.gold === r.gold && p.silver === r.silver && p.bronze === r.bronze ? p.rank : i + 1;
      r.total = r.gold + r.silver + r.bronze;
    });
    return { rows, perEvent };
  };

  App.validate = () => {
    const V = App.S.validation;
    const out = [];
    if (!V.enabled) return out;
    const warn = (msg) => out.push(msg);
    const byAthlete = {};
    App.S.entries.forEach((e) => e.members.filter(Boolean).forEach((aid) => (byAthlete[aid] = byAthlete[aid] || []).push(App.event(e.eventId))));

    App.S.athletes.forEach((a) => {
      const evs = (byAthlete[a.id] || []).filter(Boolean);
      let count = evs.length;
      if (V.teamStrokeIncluded) {
        evs.forEach((ev) => {
          if (ev.discipline === 'stroke' && ev.kind === 'team' && evs.some((x) => x.id === ev.config.sourceEvent)) count--;
        });
      }
      if (V.maxEventsPerAthlete && count > V.maxEventsPerAthlete) warn(`${a.name} (${App.kShort(a.kontingenId)}) mengikuti ${count} nomor, melebihi batas ${V.maxEventsPerAthlete}.`);
      if (V.separateDisciplines && evs.some((x) => x.discipline === 'stroke') && evs.some((x) => x.discipline === 'fairway')) warn(`${a.name} (${App.kShort(a.kontingenId)}) bermain di Stroke dan Fairway sekaligus.`);
    });

    App.S.events.forEach((ev) => {
      const list = App.entriesOf(ev.id);
      const perK = {};
      list.forEach((e) => {
        perK[e.kontingenId] = (perK[e.kontingenId] || 0) + 1;
        const ms = e.members.filter(Boolean);
        if (ms.length < ev.members) warn(`${ev.name}: entri ${App.entryLabel(e)} belum lengkap (${ms.length}/${ev.members} pemain).`);
        ms.forEach((aid) => {
          const a = App.athlete(aid);
          if (!a) return;
          if (ev.gender !== 'X' && a.gender !== ev.gender) warn(`${ev.name}: ${a.name} tidak sesuai kategori ${App.genderLabel(ev.gender)}.`);
          if (a.kontingenId !== e.kontingenId) warn(`${ev.name}: ${a.name} bukan dari kontingen ${App.kShort(e.kontingenId)}.`);
        });
        if (ev.gender === 'X' && ev.kind === 'double' && ms.length === 2) {
          const g = ms.map((id) => (App.athlete(id) || {}).gender).sort().join('');
          if (g !== 'LP') warn(`${ev.name}: pasangan ${App.entryName(e)} harus 1 putra + 1 putri.`);
        }
        if (ev.discipline === 'stroke' && ev.kind === 'team') {
          const src = App.event(ev.config.sourceEvent);
          if (src) ms.forEach((aid) => {
            if (!App.entriesOf(src.id).some((x) => x.members.includes(aid))) warn(`${ev.name}: ${App.athName(aid)} tidak terdaftar di ${src.name}.`);
          });
        }
      });
      if (V.perKontingen && ev.config.maxPerKontingen) {
        Object.entries(perK).forEach(([kid, n]) => {
          if (n > ev.config.maxPerKontingen) warn(`${ev.name}: ${App.kShort(kid)} punya ${n} entri, maksimal ${ev.config.maxPerKontingen}.`);
        });
      }
    });
    return out;
  };
})(window.App);
