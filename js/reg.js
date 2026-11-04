// Pendaftaran atlet oleh official kontingen: format berkas, konfigurasi formulir, dan aturan pengecekan
// yang dipakai bersama oleh formulir official (daftar.html) dan menu Pendaftaran admin.
(function (App) {
  const R = (App.reg = {});
  R.FILE_APP = 'woodball-pendaftaran'; // berkas kiriman official
  R.CONFIG_APP = 'woodball-formulir'; // pendaftaran.json (pengaturan formulir untuk versi online)

  R.defaults = () => ({ open: true, deadline: '', contactName: '', contactPhone: '', note: '' });

  // Hanya pengaturan yang boleh terbaca publik.
  R.publicSettings = (reg) => {
    const { open, deadline, contactName, contactPhone, note } = { ...R.defaults(), ...(reg || {}) };
    return { open, deadline, contactName, contactPhone, note };
  };

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
    registration: R.publicSettings(S.registration),
  });

  // Putra/putri mengikuti nomor yang dipilih. Nomor mix berlaku untuk keduanya, jadi null bila hanya memilih mix.
  R.genderOf = (C, evIds) => {
    const ev = (evIds || []).map((id) => C.events.find((e) => e.id === id)).find((e) => e && e.gender !== 'X');
    return ev ? ev.gender : null;
  };

  // Jumlah nomor yang dihitung untuk batas per atlet (Single + Team Stroke dihitung 1 bila diatur).
  R.countEvents = (C, evIds) => {
    const evs = (evIds || []).map((id) => C.events.find((e) => e.id === id)).filter(Boolean);
    let n = evs.length;
    if (C.validation.teamStrokeIncluded) {
      evs.forEach((ev) => { if (ev.discipline === 'stroke' && ev.kind === 'team' && evs.some((x) => x.id === ev.config.sourceEvent)) n--; });
    }
    return n;
  };

  // Kekurangan data wajib dan peringatan aturan untuk satu atlet. C = {events, validation}; a = {name, gender, events}
  R.check = (C, a) => {
    const missing = [];
    const warns = [];
    if (!a.name) missing.push('nama');
    if (!(a.events || []).length) missing.push('nomor tanding');
    else if (!a.gender) missing.push('kategori putra/putri');

    const V = C.validation || {};
    if (V.enabled !== false) {
      const evs = (a.events || []).map((id) => C.events.find((e) => e.id === id)).filter(Boolean);
      const n = R.countEvents(C, a.events);
      if (V.maxEventsPerAthlete && n > V.maxEventsPerAthlete) warns.push(`ikut ${n} nomor, maksimal ${V.maxEventsPerAthlete}`);
      if (V.separateDisciplines && evs.some((x) => x.discipline === 'stroke') && evs.some((x) => x.discipline === 'fairway')) warns.push('Stroke dan Fairway tidak boleh dirangkap');
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
