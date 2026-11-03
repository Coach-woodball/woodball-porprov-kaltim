// Halaman Beranda, Kontingen, Atlet.
(function (App) {
  const esc = App.esc;

  // ---------- Beranda ----------
  App.views.dashboard = {
    render() {
      const S = App.S, E = S.event;
      const warns = App.isAdmin() ? App.validate() : [];
      const { rows } = App.medalTally();
      const evRows = S.events.map((ev) => {
        const n = App.entriesOf(ev.id).length;
        let prog = '-';
        if (ev.discipline === 'stroke' && ev.kind !== 'team') {
          prog = App.stroke.progress(ev).map((p) => `${esc(p.name)}: ${p.done}/${p.total}`).join(' · ');
        } else if (ev.discipline === 'fairway') {
          const p = App.fairway.progress(ev);
          prog = p.total ? `${p.done}/${p.total} pertandingan` : 'Belum diundi';
        } else prog = 'Otomatis dari ' + esc((App.event(ev.config.sourceEvent) || {}).name || '-');
        const pl = App.placements(ev);
        const champ = pl.list.find((p) => p.rank === 1);
        const link = App.isAdmin() ? `#/${ev.discipline}/${ev.id}` : `#/results/${ev.id}`;
        return `<tr><td><a href="${link}">${esc(ev.name)}</a></td><td class="c">${n}</td><td>${prog}</td>
          <td>${champ ? '🥇 ' + esc(App.entryLabel(App.entry(champ.entryId))) + (pl.final ? '' : ' <small class="muted">(sementara)</small>') : '<span class="muted">-</span>'}</td></tr>`;
      }).join('');
      return `
        <section class="hero card">
          <div class="hero-logos">${App.logoImgs('logo')}</div>
          <div>
            <h1>${esc(E.title)}</h1>
            <p class="lead">Cabang Olahraga ${esc(E.sport)} · ${esc(E.region)}</p>
            <p>${esc(App.fmtDateRange(E.dateStart, E.dateEnd))} · ${esc(E.venue)}, ${esc(E.city)}</p>
          </div>
        </section>
        <div class="stats">
          <div class="stat"><i>${App.icon('kontingen')}</i><b>${S.kontingen.length}</b><span>Kontingen</span></div>
          <div class="stat"><i>${App.icon('athletes')}</i><b>${S.athletes.length}</b><span>Atlet</span></div>
          <div class="stat red"><i>${App.icon('events')}</i><b>${S.events.length}</b><span>Nomor</span></div>
          <div class="stat red"><i>${App.icon('fairway')}</i><b>${S.entries.length}</b><span>Entri</span></div>
        </div>
        ${warns.length ? `<div class="card warn"><b>⚠️ ${warns.length} peringatan validasi</b> - lihat di <a href="#/athletes">${esc(S.menu.athletes)}</a>.</div>` : ''}
        ${App.db.isFallback ? '<div class="card warn">Browser ini tidak mendukung IndexedDB; scan & logo tidak tersimpan permanen. Gunakan Chrome/Edge.</div>' : ''}
        <div class="card"><h2>Progres Pertandingan</h2>
          <div class="table-wrap"><table><thead><tr><th>Nomor</th><th>Entri</th><th>Progres</th><th>Juara 1</th></tr></thead><tbody>${evRows}</tbody></table></div>
        </div>
        <div class="card"><h2>Klasemen Medali</h2>${medalTable(rows.filter((r) => r.total > 0).slice(0, 10))}
          <p><a href="#/results">Lihat lengkap →</a></p></div>`;
    },
  };

  function medalTable(rows) {
    if (!rows.length) return App.ui.empty('Belum ada medali.');
    return `<div class="table-wrap"><table class="medal"><thead><tr><th>#</th><th>Kontingen</th><th>🥇</th><th>🥈</th><th>🥉</th><th>Total</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="c">${r.rank}</td><td>${esc(r.k.name)}</td><td class="c">${r.gold}</td><td class="c">${r.silver}</td><td class="c">${r.bronze}</td><td class="c"><b>${r.total}</b></td></tr>`).join('')}
      </tbody></table></div>`;
  }
  App.medalTableHtml = medalTable;

  // ---------- Kontingen ----------
  App.views.kontingen = {
    admin: true,
    render() {
      const rows = App.S.kontingen.map((k) => {
        const nA = App.S.athletes.filter((a) => a.kontingenId === k.id).length;
        return `<tr data-id="${k.id}"><td><input class="k-name" value="${esc(k.name)}"></td><td><input class="k-short" value="${esc(k.short)}" style="max-width:120px"></td>
          <td class="c">${nA}</td><td class="k-offs">${(k.officials || []).map((o) => `${esc(o.role)}: <b>${esc(o.name)}</b>${o.phone ? ' (' + esc(o.phone) + ')' : ''}`).join('<br>') || '-'}</td><td><button class="btn sm danger k-del" ${nA ? 'disabled title="Masih ada atlet"' : ''}>Hapus</button></td></tr>`;
      }).join('');
      return `<div class="card"><h2>${esc(App.S.menu.kontingen)} (Kab/Kota)</h2>
        <p class="muted">Nama lengkap dipakai di dokumen; singkatan dipakai di tabel & bagan.</p>
        <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Singkatan</th><th>Atlet</th><th>Official</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <form class="row gap" id="k-add"><input name="name" placeholder="Nama kontingen baru" required><input name="short" placeholder="Singkatan" style="max-width:140px"><button class="btn">+ Tambah</button></form>
      </div>`;
    },
    mount(root) {
      root.querySelectorAll('tr[data-id]').forEach((tr) => {
        const k = App.kontingen(tr.dataset.id);
        tr.querySelector('.k-name').addEventListener('change', (e) => { k.name = e.target.value.trim(); App.save(); });
        tr.querySelector('.k-short').addEventListener('change', (e) => { k.short = e.target.value.trim(); App.save(); });
        tr.querySelector('.k-del').addEventListener('click', async () => {
          if (!(await App.ask(`Hapus kontingen ${k.name}?`))) return;
          App.S.kontingen = App.S.kontingen.filter((x) => x.id !== k.id);
          App.S.entries = App.S.entries.filter((e) => e.kontingenId !== k.id);
          App.commit('Kontingen dihapus');
        });
      });
      root.querySelector('#k-add').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        App.S.kontingen.push({ id: App.uid('k_'), name: f.get('name').trim().toUpperCase(), short: (f.get('short') || '').trim().toUpperCase() });
        App.commit('Kontingen ditambahkan');
      });
    },
  };

  // ---------- Atlet ----------
  let athFilter = { k: '', g: '', q: '' };
  let editId = null;

  const evChecks = (gender, selected) => {
    const evs = App.S.events.filter((ev) => ev.gender === 'X' || ev.gender === gender);
    const group = (disc, label) => {
      const list = evs.filter((ev) => ev.discipline === disc);
      if (!list.length) return '';
      return `<div class="evgroup"><span class="evgroup-t ${disc}">${label}</span><div class="evchips">${list.map((ev) =>
        `<label class="evchip"><input type="checkbox" name="ev" value="${ev.id}" ${(selected || []).includes(ev.id) ? 'checked' : ''}>
          <span><b>${esc(ev.code)}</b><small>${esc(ev.name)}</small></span></label>`).join('')}</div></div>`;
    };
    return group('stroke', 'Stroke') + group('fairway', 'Fairway');
  };

  App.eventLegend = () => `<div class="legend">${App.S.events.map((ev) => `<span><b>${esc(ev.code)}</b> ${esc(ev.name)}</span>`).join('')}</div>`;

  function athleteForm(a) {
    a = a || { name: '', gender: 'L', kontingenId: athFilter.k, birth: '', nik: '', events: [] };
    const photo = App.files.url(a.photo);
    return `<form id="ath-form" class="card form">
      <h3>${a.id ? 'Ubah atlet' : 'Tambah atlet'}</h3>
      <div class="grid4">
        <label>Nama<input name="name" value="${esc(a.name)}" required></label>
        <label>Jenis kelamin<select name="gender">${App.ui.options([['L', 'Putra'], ['P', 'Putri']], a.gender)}</select></label>
        <label>Kontingen<select name="kontingenId" required>${App.ui.kontingenOptions(a.kontingenId)}</select></label>
        <label>Tanggal lahir<input type="date" name="birth" value="${esc(a.birth || '')}"><small class="muted" id="ath-age">${esc(App.ageText(a.birth))}</small></label>
        <label>NIK<input name="nik" inputmode="numeric" maxlength="16" value="${esc(a.nik || '')}"></label>
      </div>
      ${a.id ? `<div class="ath-media">
        <div><div class="field-t">Pas foto</div><div class="photo-box">${photo ? `<img src="${photo}" alt="">` : 'Belum ada'}</div>
          <div class="row gap"><label class="btn xs ghost upload">📷 Upload<input type="file" accept="image/*" id="ath-photo" hidden></label>${a.photo ? '<button type="button" class="btn xs danger" id="ath-photo-del">Hapus</button>' : ''}</div></div>
        <div><div class="field-t">Dokumen identitas (KTP / KK / akta)</div>${App.ui.scanBlock(a.docs, 'docs', '📎 Upload dokumen')}</div>
      </div>` : '<p class="muted small">Pas foto dan dokumen identitas bisa ditambahkan setelah atlet disimpan (klik <b>Ubah</b>).</p>'}
      <div class="field-t">Nomor yang diikuti <small class="muted">(daftar menyesuaikan jenis kelamin)</small></div>
      <div id="ath-evs" class="evpick">${evChecks(a.gender, a.events)}</div>
      <div class="row gap"><button class="btn">${a.id ? 'Simpan' : '+ Tambah'}</button>${a.id ? '<button type="button" class="btn ghost" id="ath-cancel">Batal</button>' : ''}</div>
    </form>`;
  }

  App.views.athletes = {
    admin: true,
    render() {
      const S = App.S;
      const q = athFilter.q.toLowerCase();
      const list = S.athletes.filter((a) => (!athFilter.k || a.kontingenId === athFilter.k) && (!athFilter.g || a.gender === athFilter.g) && (!q || a.name.toLowerCase().includes(q)))
        .sort((a, b) => App.kName(a.kontingenId).localeCompare(App.kName(b.kontingenId)) || a.gender.localeCompare(b.gender) || a.name.localeCompare(b.name));
      const inEntries = {};
      S.entries.forEach((e) => e.members.forEach((m) => m && (inEntries[m] = (inEntries[m] || []).concat(App.event(e.eventId)?.code || '?'))));
      const warns = App.validate();
      const editing = editId ? App.athlete(editId) : null;
      return `
        <div class="row between"><h2>${esc(S.menu.athletes)} <small class="muted">(${S.athletes.length})</small></h2>
          <div class="row gap"><button class="btn ghost" id="ath-auto">⚡ Buat entri otomatis</button><button class="btn ghost" id="ath-import-toggle">📥 Tempel dari Excel</button></div></div>
        <div class="card hidden" id="ath-import">
          <h3>Tempel data dari Excel</h3>
          <p class="muted">Salin kolom dari Excel lalu tempel. Urutan kolom: <b>Nama</b> | <b>L/P</b> | <b>Kontingen</b> (nama/singkatan) | <b>Tgl lahir</b> (opsional, YYYY-MM-DD atau DD/MM/YYYY) | <b>Nomor</b> (kode, pisahkan koma, mis. <code>SS-PA, TS-PA</code>).</p>
          <details><summary class="muted small">Lihat arti kode nomor</summary>${App.eventLegend()}</details>
          <textarea id="ath-paste" rows="8" placeholder="Rahmat Anan Muhaimin	L	KUKAR		SS-PA, DS-PA, TS-PA"></textarea>
          <button class="btn" id="ath-import-go">Impor</button>
        </div>
        ${athleteForm(editing)}
        ${warns.length ? `<details class="card warn"><summary><b>⚠️ ${warns.length} peringatan validasi (sesuai THB, bisa diatur di Pengaturan)</b></summary><ul>${warns.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
        <div class="card">
          <div class="row gap wrap filters">
            <select id="f-k">${App.ui.options([['', 'Semua kontingen'], ...S.kontingen.map((k) => [k.id, k.name])], athFilter.k)}</select>
            <select id="f-g">${App.ui.options([['', 'Putra & Putri'], ['L', 'Putra'], ['P', 'Putri']], athFilter.g)}</select>
            <input id="f-q" placeholder="Cari nama…" value="${esc(athFilter.q)}">
          </div>
          <details class="legend-wrap"><summary class="muted small">Arti kode nomor</summary>${App.eventLegend()}</details>
          <div class="table-wrap"><table><thead><tr><th>#</th><th>Nama</th><th>L/P</th><th>Kontingen</th><th>Tgl lahir</th><th title="Dihitung per ${esc(App.fmtDate(S.event.dateStart))} (hari pertama pertandingan)">Umur <small>per ${esc(App.fmtDate(S.event.dateStart))}</small></th><th>Daftar nomor</th><th>Masuk entri</th><th></th></tr></thead><tbody>
          ${list.map((a, i) => `<tr><td class="c">${i + 1}</td><td class="nowrap">${App.files.url(a.photo) ? `<img class="ath-thumb" src="${App.files.url(a.photo)}" alt="">` : ''}<span class="ath-nm">${esc(a.name)}${a.nik || (a.docs || []).length ? `<small class="muted">${a.nik ? 'NIK ' + esc(a.nik) : ''}${(a.docs || []).length ? ' · 📄 ' + a.docs.length : ''}</small>` : ''}</span></td><td class="c">${a.gender}</td><td>${esc(App.kShort(a.kontingenId))}</td>
            <td class="nowrap">${esc(a.birth ? App.fmtDate(a.birth) : '-')}</td><td class="nowrap small">${esc(App.ageText(a.birth) || '-')}</td><td>${(a.events || []).map(App.event).filter(Boolean).map((ev) => `<span class="code" title="${esc(ev.name)}">${esc(ev.code)}</span>`).join(' ')}</td>
            <td>${(inEntries[a.id] || []).map((c) => `<span class="code" title="${esc((App.S.events.find((ev) => ev.code === c) || {}).name || '')}">${esc(c)}</span>`).join(' ')}</td>
            <td class="nowrap"><button class="btn sm ghost" data-edit="${a.id}">Ubah</button> <button class="btn sm danger" data-del="${a.id}">Hapus</button></td></tr>`).join('') || `<tr><td colspan="9">${App.ui.empty('Belum ada atlet.')}</td></tr>`}
          </tbody></table></div>
        </div>`;
    },
    mount(root) {
      const form = root.querySelector('#ath-form');
      form.gender.addEventListener('change', () => {
        const sel = Array.from(form.querySelectorAll('input[name=ev]:checked')).map((x) => x.value);
        root.querySelector('#ath-evs').innerHTML = evChecks(form.gender.value, sel);
      });
      form.birth.addEventListener('input', () => { root.querySelector('#ath-age').textContent = App.ageText(form.birth.value); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const data = { name: f.get('name').trim(), gender: f.get('gender'), kontingenId: f.get('kontingenId'), birth: f.get('birth'), nik: (f.get('nik') || '').replace(/\D/g, ''), events: f.getAll('ev') };
        if (editId) Object.assign(App.athlete(editId), data);
        else App.S.athletes.push({ id: App.uid('a_'), ...data });
        athFilter.k = data.kontingenId;
        editId = null;
        App.commit('Atlet tersimpan');
      });
      const cur = editId && App.athlete(editId);
      if (cur) {
        App.bindScans(root, () => (cur.docs = cur.docs || []));
        root.querySelector('#ath-photo').addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const url = await App.compressImage(await App.readFile(file), 600, 0.82);
          cur.photo = await App.files.add(file.name, url.slice(5, url.indexOf(';')), url);
          App.commit('Foto tersimpan');
        });
        root.querySelector('#ath-photo-del')?.addEventListener('click', () => { cur.photo = null; App.commit('Foto dihapus'); });
      }
      root.querySelector('#ath-cancel')?.addEventListener('click', () => { editId = null; App.rerender(); });
      root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => { editId = b.dataset.edit; App.rerender(); window.scrollTo(0, 0); }));
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        const a = App.athlete(b.dataset.del);
        if (!(await App.ask(`Hapus ${a.name}? Atlet juga dikeluarkan dari semua entri.`))) return;
        App.S.athletes = App.S.athletes.filter((x) => x.id !== a.id);
        App.S.entries.forEach((e) => (e.members = e.members.map((m) => (m === a.id ? null : m))));
        App.commit('Atlet dihapus');
      }));
      const refilter = () => { athFilter = { k: root.querySelector('#f-k').value, g: root.querySelector('#f-g').value, q: root.querySelector('#f-q').value }; App.rerender(); };
      root.querySelector('#f-k').addEventListener('change', refilter);
      root.querySelector('#f-g').addEventListener('change', refilter);
      root.querySelector('#f-q').addEventListener('change', refilter);
      root.querySelector('#ath-import-toggle').addEventListener('click', () => root.querySelector('#ath-import').classList.toggle('hidden'));
      root.querySelector('#ath-import-go').addEventListener('click', () => {
        const res = importPaste(root.querySelector('#ath-paste').value);
        App.commit(`${res.added} atlet diimpor` + (res.skipped.length ? `, ${res.skipped.length} baris dilewati` : ''));
        if (res.skipped.length) App.notice('Baris dilewati:\n' + res.skipped.join('\n'));
      });
      root.querySelector('#ath-auto').addEventListener('click', () => {
        let n = 0;
        App.S.events.forEach((ev) => (n += App.autoEntries(ev)));
        App.commit(n ? `${n} entri dibuat dari pendaftaran nomor` : 'Tidak ada entri baru (semua sudah dibuat)');
      });
    },
  };

  function parseDate(s) {
    s = (s || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
  }

  function importPaste(text) {
    const res = { added: 0, skipped: [] };
    const findK = (s) => {
      const t = (s || '').trim().toUpperCase();
      return App.S.kontingen.find((k) => k.name.toUpperCase() === t || (k.short || '').toUpperCase() === t);
    };
    text.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const c = line.split('\t');
      const name = (c[0] || '').trim();
      const g = (c[1] || '').trim().toUpperCase();
      const gender = g.startsWith('P') && !g.startsWith('PA') ? 'P' : g.startsWith('L') || g.startsWith('PA') ? 'L' : null;
      const k = findK(c[2]);
      if (!name || !gender || !k) { res.skipped.push(`Baris ${i + 1}: ${line.slice(0, 60)}`); return; }
      const codes = (c[4] || '').split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
      const events = codes.map((code) => App.S.events.find((ev) => ev.code.toUpperCase() === code)).filter(Boolean).map((ev) => ev.id);
      App.S.athletes.push({ id: App.uid('a_'), name, gender, kontingenId: k.id, birth: parseDate(c[3]), events });
      res.added++;
    });
    return res;
  }
})(window.App);
