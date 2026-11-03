// State aplikasi: memuat/menyimpan ke IndexedDB dan selector umum.
(function (App) {
  let saveTimer = null;

  App.load = async () => {
    await App.files.loadAll();
    const saved = await App.db.get('kv', 'state');
    App.S = saved ? migrate(saved) : App.defaultState();
    if (!saved) await App.db.put('kv', 'state', App.S);
    const snap = await App.db.get('kv', 'simSnapshot');
    App.sim = snap ? { started: snap.started, cleared: snap.cleared, fileKeys: new Set(snap.fileKeys) } : null;
  };

  // ---------- Mode simulasi ----------
  // Salinan data disimpan dulu; semua yang dicoba selama simulasi dibuang saat simulasi diakhiri.
  App.startSim = async (clear) => {
    const snap = { state: JSON.parse(JSON.stringify(App.S)), fileKeys: [...App.files.cache.keys()], started: new Date().toISOString(), cleared: !!clear };
    await App.db.put('kv', 'simSnapshot', snap);
    App.sim = { started: snap.started, cleared: snap.cleared, fileKeys: new Set(snap.fileKeys) };
    if (clear) { App.S.stroke = {}; App.S.fairway = {}; } // atlet & entri tetap, pairing/skor/bagan kosong
    await App.save(true);
  };
  App.endSim = async () => {
    const snap = await App.db.get('kv', 'simSnapshot');
    if (snap) {
      const keep = new Set(snap.fileKeys);
      for (const id of [...App.files.cache.keys()]) if (!keep.has(id)) await App.files.remove(id);
      App.S = migrate(snap.state);
      await App.save(true);
    }
    await App.db.del('kv', 'simSnapshot');
    App.sim = null;
    App.files.cache.clear();
    await App.files.loadAll(); // file yang "dihapus" saat simulasi masih ada di database
  };

  function migrate(s) {
    const d = App.defaultState();
    s.event = Object.assign({}, d.event, s.event || {});
    s.menu = Object.assign({}, d.menu, s.menu || {});
    s.validation = Object.assign({}, d.validation, s.validation || {});
    ['kontingen', 'athletes', 'events', 'entries'].forEach((k) => (s[k] = s[k] || d[k]));
    s.stroke = s.stroke || {};
    s.fairway = s.fairway || {};
    s.admin = s.admin || { pinHash: null };
    s.registration = Object.assign(App.reg.defaults(), s.registration || {});
    s.registrations = s.registrations || [];
    // OB tidak dipakai lagi: buang dari urutan tie-break.
    s.events.forEach((e) => { if (Array.isArray(e.config?.tiebreak)) e.config.tiebreak = e.config.tiebreak.filter((k) => k !== "ob"); });
    return s;
  }
  App.migrate = migrate;

  App.save = (immediate) => {
    clearTimeout(saveTimer);
    const run = () => App.db.put('kv', 'state', App.S).catch((e) => App.toast('Gagal menyimpan: ' + e.message, 'err'));
    if (immediate) return run();
    saveTimer = setTimeout(run, 300);
  };

  // ---------- Selector ----------
  App.kontingen = (id) => App.S.kontingen.find((k) => k.id === id);
  App.kShort = (id) => { const k = App.kontingen(id); return k ? (k.short || k.name) : '-'; };
  App.kName = (id) => { const k = App.kontingen(id); return k ? k.name : '-'; };
  App.athlete = (id) => App.S.athletes.find((a) => a.id === id);
  App.event = (id) => App.S.events.find((e) => e.id === id);
  App.entry = (id) => App.S.entries.find((e) => e.id === id);
  App.entriesOf = (evId) => App.S.entries.filter((e) => e.eventId === evId);

  App.genderLabel = (g) => (g === 'L' ? 'Putra' : g === 'P' ? 'Putri' : 'Campuran');
  App.kindLabel = (k) => (k === 'single' ? 'Single' : k === 'double' ? 'Double' : 'Team');

  App.athName = (id) => { const a = App.athlete(id); return a ? a.name : '?'; };

  App.entryName = (entry) => {
    if (!entry) return '-';
    if (entry === 'BYE') return 'BYE';
    const ev = App.event(entry.eventId);
    if (entry.name) return entry.name;
    if (ev && ev.kind === 'team') return App.kName(entry.kontingenId);
    return entry.members.filter(Boolean).map(App.athName).join(' / ') || '(kosong)';
  };
  App.entryLabel = (entry) => {
    if (!entry || entry === 'BYE') return entry === 'BYE' ? 'BYE' : '-';
    return `${App.entryName(entry)} (${App.kShort(entry.kontingenId)})`;
  };
  App.entryById = (id) => (id === 'BYE' ? 'BYE' : App.entry(id));

  // Daftar atlet tiap kontingen yang boleh masuk nomor tertentu (berdasarkan gender).
  App.eligibleAthletes = (ev, kontingenId) => App.S.athletes.filter((a) =>
    (!kontingenId || a.kontingenId === kontingenId) && (ev.gender === 'X' || a.gender === ev.gender));

  // Buat entri otomatis dari pendaftaran nomor di data atlet.
  App.autoEntries = (ev) => {
    const existing = App.entriesOf(ev.id);
    const used = new Set(existing.flatMap((e) => e.members));
    const reg = App.S.athletes.filter((a) => (a.events || []).includes(ev.id) && !used.has(a.id));
    const byK = {};
    reg.forEach((a) => (byK[a.kontingenId] = byK[a.kontingenId] || []).push(a));
    let added = 0;
    Object.entries(byK).forEach(([kid, list]) => {
      if (ev.kind === 'double' && ev.gender === 'X') {
        const men = list.filter((a) => a.gender === 'L');
        const women = list.filter((a) => a.gender === 'P');
        while (men.length && women.length) {
          App.S.entries.push({ id: App.uid('e_'), eventId: ev.id, kontingenId: kid, members: [men.shift().id, women.shift().id] });
          added++;
        }
        return;
      }
      App.chunk(list, ev.members).forEach((grp) => {
        const members = grp.map((a) => a.id);
        while (members.length < ev.members) members.push(null);
        App.S.entries.push({ id: App.uid('e_'), eventId: ev.id, kontingenId: kid, members });
        added++;
      });
    });
    return added;
  };

  App.removeEntry = (entryId) => {
    App.S.entries = App.S.entries.filter((e) => e.id !== entryId);
  };
})(window.App);
