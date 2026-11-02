// Pendaftaran atlet oleh official kontingen: format berkas, konfigurasi formulir, dan aturan pengecekan
// yang dipakai bersama oleh formulir official (daftar.html) dan menu Pendaftaran admin.
(function (App) {
  const R = (App.reg = {});
  R.FILE_APP = 'woodball-pendaftaran'; // berkas kiriman official
  R.CONFIG_APP = 'woodball-formulir'; // pendaftaran.json (pengaturan formulir untuk versi online)

  R.defaults = () => ({
    open: true,
    deadline: '',
    contactName: '',
    contactPhone: '',
    note: '',
    requireNik: true,
    requirePhoto: true,
    requireDocs: true,
    roles: 'Manajer Tim, Pelatih, Asisten Pelatih, Official',
  });

  R.roles = (reg) => (reg.roles || '').split(',').map((s) => s.trim()).filter(Boolean);

  // Konfigurasi ringkas untuk formulir. logoUrl(id) -> dataURL logo.
  R.buildConfig = (S, logoUrl) => ({
    app: R.CONFIG_APP,
    version: 1,
    exported: new Date().toISOString(),
    event: (({ title, sport, region, shortName, dateStart, dateEnd, venue, city, organizer, themeColor, accentColor }) =>
      ({ title, sport, region, shortName, dateStart, dateEnd, venue, city, organizer, themeColor, accentColor }))(S.event),
    logos: (S.event.logos || []).map(logoUrl).filter(Boolean),
    kontingen: S.kontingen.map(({ id, name, short }) => ({ id, name, short })),
    events: S.events.map(({ id, code, name, discipline, kind, gender, members, config }) => ({
      id, code, name, discipline, kind, gender, members,
      config: { maxPerKontingen: config.maxPerKontingen || null, sourceEvent: config.sourceEvent || null },
    })),
    validation: { ...S.validation },
    registration: { ...R.defaults(), ...(S.registration || {}) },
  });

  R.nikOk = (nik) => /^\d{16}$/.test(nik || '');

  // Jumlah nomor yang dihitung untuk batas per atlet (Single + Team Stroke dihitung 1 bila diatur).
  R.countEvents = (C, evIds) => {
    const evs = (evIds || []).map((id) => C.events.find((e) => e.id === id)).filter(Boolean);
    let n = evs.length;
    if (C.validation.teamStrokeIncluded) {
      evs.forEach((ev) => { if (ev.discipline === 'stroke' && ev.kind === 'team' && evs.some((x) => x.id === ev.config.sourceEvent)) n--; });
    }
    return n;
  };

  // Kekurangan data wajib dan peringatan aturan untuk satu atlet.
  // C = {events, validation, registration}; a = {name, gender, birth, nik, events, photo, docs}
  R.check = (C, a) => {
    const missing = [];
    const warns = [];
    const reg = C.registration || R.defaults();
    if (!a.name) missing.push('nama');
    if (!a.birth) missing.push('tanggal lahir');
    if (reg.requireNik && !a.nik) missing.push('NIK');
    else if (a.nik && !R.nikOk(a.nik)) warns.push('NIK harus 16 angka');
    if (reg.requirePhoto && !a.photo) missing.push('pas foto');
    if (reg.requireDocs && !(a.docs || []).length) missing.push('dokumen identitas');
    if (!(a.events || []).length) missing.push('nomor pertandingan');

    const V = C.validation || {};
    if (V.enabled !== false) {
      const evs = (a.events || []).map((id) => C.events.find((e) => e.id === id)).filter(Boolean);
      const n = R.countEvents(C, a.events);
      if (V.maxEventsPerAthlete && n > V.maxEventsPerAthlete) warns.push(`ikut ${n} nomor, maksimal ${V.maxEventsPerAthlete}`);
      if (V.separateDisciplines && evs.some((x) => x.discipline === 'stroke') && evs.some((x) => x.discipline === 'fairway')) warns.push('Stroke dan Fairway tidak boleh dirangkap');
      if (V.minBirthDate && a.birth && a.birth < V.minBirthDate) warns.push(`lahir sebelum batas usia (${App.fmtDate(V.minBirthDate)})`);
      evs.forEach((ev) => {
        if (ev.gender !== 'X' && a.gender && ev.gender !== a.gender) warns.push(`${ev.code} bukan untuk ${a.gender === 'L' ? 'putra' : 'putri'}`);
        if (ev.discipline === 'stroke' && ev.kind === 'team' && ev.config.sourceEvent && !evs.some((x) => x.id === ev.config.sourceEvent)) {
          const src = C.events.find((x) => x.id === ev.config.sourceEvent);
          warns.push(`${ev.code} harus juga ikut ${src ? src.code : 'nomor single'}`);
        }
      });
    }
    return { missing, warns };
  };

  // Rekap jumlah atlet per nomor dibanding kuota kontingen (kuota entri × jumlah pemain per entri).
  R.quota = (C, athletes) => C.events.map((ev) => {
    const list = athletes.filter((a) => (a.events || []).includes(ev.id));
    const max = ev.config.maxPerKontingen ? ev.config.maxPerKontingen * ev.members : null;
    const notes = [];
    if (max && list.length > max) notes.push(`melebihi kuota ${max} atlet`);
    if (ev.members > 1 && list.length % ev.members) notes.push(`jumlah harus kelipatan ${ev.members}`);
    if (ev.gender === 'X' && ev.kind === 'double' && list.length) {
      const l = list.filter((a) => a.gender === 'L').length;
      if (l * 2 !== list.length) notes.push('pasangan mix harus 1 putra + 1 putri');
    }
    return { ev, list, max, notes };
  });

  // Nomor HP Indonesia -> format wa.me (62…).
  R.waNumber = (phone) => {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('0')) return '62' + d.slice(1);
    return d.startsWith('62') ? d : '62' + d;
  };
})(window.App);
