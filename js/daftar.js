// Formulir pendaftaran atlet untuk official kontingen (daftar.html). Berjalan mandiri tanpa mode admin:
// isian tersimpan sebagai draf di browser official, lalu diunduh sebagai berkas untuk dikirim ke panitia.
(function (App) {
  const R = App.reg, esc = App.esc;
  const root = document.getElementById('reg');
  let C = null; // konfigurasi formulir (event, kontingen, nomor, aturan)
  let D = null; // draf pendaftaran official
  let edit = null; // atlet yang sedang diisi (salinan, disimpan ke D saat "Simpan atlet")
  let src = 'default';

  // ---------- draf di IndexedDB terpisah, tidak menyentuh data admin ----------
  const idb = () => new Promise((resolve, reject) => {
    const r = indexedDB.open('woodball-daftar', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  async function draftGet() {
    try {
      const db = await idb();
      return await new Promise((resolve) => {
        const q = db.transaction('kv').objectStore('kv').get('draft');
        q.onsuccess = () => resolve(q.result || null);
        q.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  }
  let saveTimer, draftWarned = false;
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const db = await idb();
        db.transaction('kv', 'readwrite').objectStore('kv').put({ ...D, updated: Date.now() }, 'draft');
      } catch (e) {
        if (!draftWarned) App.toast('Isian tidak tersimpan otomatis di browser ini, segera unduh berkas setelah selesai', 'err');
        draftWarned = true;
      }
    }, 300);
  }

  // Data admin di browser yang sama (dipakai saat admin membuka formulir dari laptopnya).
  const adminState = () => new Promise((resolve) => {
    let req;
    try { req = indexedDB.open('woodball-app'); } catch (e) { return resolve(null); } // penyimpanan diblokir (mis. mode privat)
    req.onupgradeneeded = () => req.transaction.abort(); // admin belum pernah memakai browser ini
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const t = db.transaction(['kv', 'files']);
        const files = {};
        let state = null;
        const q = t.objectStore('kv').get('state');
        q.onsuccess = () => {
          state = q.result;
          (state?.event?.logos || []).forEach((id) => {
            const f = t.objectStore('files').get(id);
            f.onsuccess = () => { if (f.result) files[id] = f.result.dataUrl; };
          });
        };
        t.oncomplete = () => { db.close(); resolve(state ? { state, files } : null); };
        t.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    };
  });

  // Urutan sumber: ?lokal -> data admin; lalu pendaftaran.json (versi online); lalu data admin; lalu default.
  async function loadConfig() {
    const fromAdmin = async () => {
      const a = await adminState();
      return a ? R.buildConfig(a.state, (id) => a.files[id]) : null;
    };
    if (new URLSearchParams(location.search).has('lokal')) {
      const c = await fromAdmin();
      if (c) return [c, 'lokal'];
    }
    try {
      const r = await fetch('pendaftaran.json', { cache: 'no-store' });
      if (r.ok) {
        const c = await r.json();
        if (c.app === R.CONFIG_APP) return [c, 'berkas'];
      }
    } catch (e) { /* dibuka dari file:// atau belum ada pendaftaran.json */ }
    const c = await fromAdmin();
    if (c) return [c, 'lokal'];
    return [R.buildConfig(App.defaultState(), () => ''), 'default'];
  }

  const newDraft = () => ({ kontingenId: '', officials: [{ id: App.uid('o_'), role: R.roles(C.registration)[0] || 'Manajer Tim', name: '', phone: '' }], athletes: [] });
  const evById = (id) => C.events.find((e) => e.id === id);
  const kontingen = () => C.kontingen.find((k) => k.id === D.kontingenId);
  const empty = (msg) => `<div class="empty">${msg}</div>`;
  const options = (list, value) => list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('');

  function statusHtml(chk) {
    if (!chk.missing.length && !chk.warns.length) return '<span class="pill ok">Lengkap</span>';
    return (chk.missing.length ? `<div class="reg-miss">Belum diisi: ${esc(chk.missing.join(', '))}</div>` : '')
      + (chk.warns.length ? `<div class="reg-warn">⚠️ ${esc(chk.warns.join(' · '))}</div>` : '');
  }

  // ---------- tema: ikut sistem / terang / gelap (disimpan per perangkat, sama dengan aplikasi utama) ----------
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_LABEL = { auto: 'Tema: ikut sistem', light: 'Tema: terang', dark: 'Tema: gelap' };
  const THEME_ICON = {
    light: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dark: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  };
  const theme = () => { try { return localStorage.getItem('wb-theme') || 'auto'; } catch (e) { return 'auto'; } };
  function setTheme(t) {
    try { localStorage.setItem('wb-theme', t); } catch (e) { /* abaikan */ }
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  const themeBtn = () => {
    const t = theme();
    return `<button type="button" class="icon-btn reg-theme" id="d-theme" title="${THEME_LABEL[t]}" aria-label="${THEME_LABEL[t]}">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${THEME_ICON[t]}</svg></button>`;
  };

  // ---------- tampilan ----------
  function header() {
    const E = C.event, reg = C.registration;
    const late = reg.deadline && App.today() > reg.deadline;
    return `<header class="card reg-head">
      ${C.logos.length ? `<div class="reg-logos">${C.logos.map((u) => `<img src="${u}" alt="">`).join('')}</div>` : ''}
      <div class="reg-title"><small>Formulir Pendaftaran Atlet</small>
        <h1>${esc(E.sport)} · ${esc(E.shortName)}</h1>
        <p class="muted">${esc(App.fmtDateRange(E.dateStart, E.dateEnd))} · ${esc(E.venue)}, ${esc(E.city)}</p>
        ${reg.deadline ? `<span class="pill ${late ? 'live' : 'ok'}">Batas pendaftaran ${esc(App.fmtDate(reg.deadline))}${late ? ' · sudah lewat' : ''}</span>` : ''}
      </div>${themeBtn()}</header>
      ${reg.note ? `<div class="card reg-note">${esc(reg.note).replace(/\n/g, '<br>')}</div>` : ''}`;
  }

  function contactLine() {
    const reg = C.registration;
    if (!reg.contactName && !reg.contactPhone) return '';
    return `${esc(reg.contactName || 'Panitia')}${reg.contactPhone ? ` (${esc(reg.contactPhone)})` : ''}`;
  }

  function evChecks(a) {
    const evs = C.events.filter((ev) => ev.gender === 'X' || ev.gender === a.gender);
    const group = (disc, label) => {
      const list = evs.filter((ev) => ev.discipline === disc);
      if (!list.length) return '';
      return `<div class="evgroup"><span class="evgroup-t ${disc}">${label}</span><div class="evchips">${list.map((ev) =>
        `<label class="evchip"><input type="checkbox" name="ev" value="${ev.id}" ${a.events.includes(ev.id) ? 'checked' : ''}>
          <span><b>${esc(ev.code)}</b><small>${esc(ev.name)}</small></span></label>`).join('')}</div></div>`;
    };
    return group('stroke', 'Stroke') + group('fairway', 'Fairway');
  }

  function docThumbs(docs) {
    return docs.map((f, i) => `<div class="scan">${f.type.startsWith('image/') ? `<img src="${f.dataUrl}" alt="">` : '<div class="pdf">PDF</div>'}
      <button type="button" class="x" data-doc-del="${i}" title="Hapus">×</button><small>${esc(f.name)}</small></div>`).join('');
  }

  function editor() {
    const a = edit;
    const isNew = !D.athletes.some((x) => x.id === a.id);
    return `<div class="ath-editor" id="editor"><h3>${isNew ? 'Atlet baru' : 'Ubah atlet'}</h3>
      <div class="ed-grid">
        <div class="ed-photo">
          <div class="photo-box">${a.photo ? `<img src="${a.photo.dataUrl}" alt="">` : '<span>Pas foto<br><small>3×4</small></span>'}</div>
          <label class="btn sm ghost upload">📷 ${a.photo ? 'Ganti foto' : 'Upload foto'}<input type="file" accept="image/*" id="ed-photo" hidden></label>
          ${a.photo ? '<button type="button" class="btn sm danger" id="ed-photo-del">Hapus foto</button>' : ''}
        </div>
        <div class="grid3 ed-fields">
          <label>Nama lengkap (sesuai KTP/KK)<input id="ed-name" value="${esc(a.name)}" autocomplete="off"></label>
          <label>Jenis kelamin<select id="ed-gender">${options([['L', 'Putra'], ['P', 'Putri']], a.gender)}</select></label>
          <label>Tanggal lahir<input type="date" id="ed-birth" value="${esc(a.birth)}"><small class="muted" id="ed-age">${esc(App.ageText(a.birth))}</small></label>
          <label>NIK (16 angka)<input id="ed-nik" inputmode="numeric" maxlength="16" value="${esc(a.nik)}" autocomplete="off"><small class="muted" id="ed-nik-info">${a.nik ? a.nik.length + '/16' : ''}</small></label>
        </div>
      </div>
      <div class="field-t">Dokumen identitas <small class="muted">(foto/scan KTP, KK, atau akta kelahiran · gambar atau PDF)</small></div>
      <div class="scans">${docThumbs(a.docs)}<label class="btn sm ghost upload">📎 Tambah dokumen<input type="file" accept="image/*,application/pdf" multiple id="ed-docs" hidden></label></div>
      <div class="field-t">Nomor pertandingan yang diikuti <small class="muted">(daftar menyesuaikan jenis kelamin)</small></div>
      <div class="evpick" id="ed-evs">${evChecks(a)}</div>
      <div id="ed-check">${statusHtml(R.check(C, a))}</div>
      <div class="row gap wrap ed-foot"><button type="button" class="btn" id="ed-save">Simpan atlet</button><button type="button" class="btn ghost" id="ed-cancel">Batal</button></div>
    </div>`;
  }

  function athleteCard(a, i) {
    const evs = a.events.map(evById).filter(Boolean);
    return `<div class="ath-card">
      <div class="ath-photo">${a.photo ? `<img src="${a.photo.dataUrl}" alt="">` : '<span>Foto</span>'}</div>
      <div class="ath-info"><b>${i + 1}. ${esc(a.name || '(tanpa nama)')}</b>
        <div class="small muted">${a.gender === 'L' ? 'Putra' : 'Putri'} · ${a.birth ? esc(App.fmtDate(a.birth)) + ' · ' + esc(App.ageText(a.birth)) : 'tanggal lahir belum diisi'}</div>
        <div class="small muted">NIK ${esc(a.nik || '-')} · ${a.docs.length} dokumen</div>
        <div>${evs.map((ev) => `<span class="code" title="${esc(ev.name)}">${esc(ev.code)}</span>`).join(' ')}</div>
        ${statusHtml(R.check(C, a))}</div>
      <div class="ath-act"><button class="btn sm ghost" data-ath-edit="${a.id}">Ubah</button><button class="btn sm danger" data-ath-del="${a.id}">Hapus</button></div>
    </div>`;
  }

  function quotaTable() {
    const rows = R.quota(C, D.athletes);
    return `<div class="table-wrap"><table><thead><tr><th>Nomor</th><th>Atlet</th><th class="c">Jumlah</th><th>Keterangan</th></tr></thead><tbody>
      ${rows.map(({ ev, list, max, notes }) => `<tr class="${list.length ? '' : 'dim'}"><td><span class="code">${esc(ev.code)}</span> ${esc(ev.name)}</td>
        <td class="small">${list.map((a) => esc(a.name)).join(', ') || '-'}</td><td class="c nowrap">${list.length}${max ? ' / ' + max : ''}</td>
        <td class="small">${list.length && notes.length ? `<span class="reg-warn">⚠️ ${esc(notes.join(' · '))}</span>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  function problems() {
    const out = [];
    if (!D.kontingenId) out.push('Kabupaten/Kota belum dipilih.');
    if (!D.officials.some((o) => o.name.trim())) out.push('Belum ada official/penanggung jawab.');
    if (!D.athletes.length) out.push('Belum ada atlet.');
    const inc = D.athletes.filter((a) => R.check(C, a).missing.length).length;
    if (inc) out.push(`${inc} atlet datanya belum lengkap.`);
    const warn = D.athletes.filter((a) => R.check(C, a).warns.length).length;
    if (warn) out.push(`${warn} atlet punya peringatan aturan.`);
    R.quota(C, D.athletes).forEach(({ ev, list, notes }) => { if (list.length && notes.length) out.push(`${ev.code}: ${notes.join(', ')}.`); });
    return out;
  }

  let canShareFiles = false;
  try { canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'cek.json', { type: 'application/json' })] })); } catch (e) { canShareFiles = false; }

  function render() {
    const reg = C.registration;
    if (!reg.open) {
      root.innerHTML = `<div class="reg-wrap">${header()}<div class="card"><h2>Pendaftaran ditutup</h2>
        <p>Formulir pendaftaran sedang tidak dibuka.${contactLine() ? ' Hubungi ' + contactLine() + '.' : ''}</p></div></div>`;
      return;
    }
    const k = kontingen();
    const roles = R.roles(reg);
    const probs = problems();
    const wa = R.waNumber(reg.contactPhone);
    root.innerHTML = `<div class="reg-wrap">
      ${header()}
      <section class="card"><h2><span class="step">1</span> Kontingen</h2>
        <label>Kabupaten / Kota<select id="d-k"><option value="">- pilih kabupaten/kota -</option>${options(C.kontingen.map((x) => [x.id, x.name]), D.kontingenId)}</select></label>
      </section>

      <section class="card"><h2><span class="step">2</span> Official &amp; Pelatih</h2>
        <p class="muted small">Baris pertama adalah penanggung jawab kontingen (nama ini tercetak di kolom tanda tangan).</p>
        <div class="off-list">${D.officials.map((o, i) => `<div class="off-row" data-i="${i}">
          <select data-of="role">${options((roles.includes(o.role) ? roles : [o.role, ...roles]).map((r) => [r, r]), o.role)}</select>
          <input data-of="name" placeholder="Nama lengkap" value="${esc(o.name)}" autocomplete="off">
          <input data-of="phone" type="tel" inputmode="tel" placeholder="No. HP / WhatsApp" value="${esc(o.phone)}">
          ${i ? `<button type="button" class="btn sm danger" data-off-del="${i}">Hapus</button>` : ''}</div>`).join('')}</div>
        <button type="button" class="btn sm ghost" id="off-add">+ Tambah official</button>
      </section>

      <section class="card"><div class="row between wrap"><h2><span class="step">3</span> Atlet <small class="muted">(${D.athletes.length})</small></h2>
        ${edit ? '' : '<button type="button" class="btn" id="ath-new">+ Tambah atlet</button>'}</div>
        ${edit ? editor() : ''}
        <div class="ath-cards">${D.athletes.map(athleteCard).join('') || (edit ? '' : empty('Belum ada atlet. Klik <b>+ Tambah atlet</b>.'))}</div>
      </section>

      <section class="card"><h2><span class="step">4</span> Rekap per nomor</h2>${quotaTable()}</section>

      <section class="card"><h2><span class="step">5</span> Kirim ke panitia</h2>
        ${probs.length ? `<div class="reg-probs"><b>Periksa dulu:</b><ul>${probs.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : '<p class="pill ok">Data siap dikirim</p>'}
        <ol class="small reg-steps">
          <li>Klik <b>Unduh berkas pendaftaran</b>. File <code>.json</code> tersimpan di folder Download.</li>
          <li>Kirim file itu ke panitia lewat WhatsApp atau email${contactLine() ? ': <b>' + contactLine() + '</b>' : ''}.</li>
          <li>Cetak rekap, tanda tangani oleh penanggung jawab, lalu serahkan sesuai arahan panitia.</li>
        </ol>
        <div class="row gap wrap">
          <button type="button" class="btn" id="d-download">💾 Unduh berkas pendaftaran</button>
          ${canShareFiles ? '<button type="button" class="btn ghost" id="d-share">📤 Bagikan berkas</button>' : ''}
          <button type="button" class="btn ghost" id="d-print">🖨️ Cetak rekap</button>
          ${wa ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(`Pendaftaran atlet woodball ${C.event.shortName} - kontingen ${k ? k.name : ''}`)}">💬 Chat panitia</a>` : ''}
        </div>
        <details class="reg-more"><summary class="small muted">Buka berkas lama / mulai baru</summary>
          <p class="muted small">Berkas yang sudah diunduh bisa dibuka lagi untuk diperbaiki, misalnya di perangkat lain. Isian di halaman ini tersimpan otomatis di browser ini.</p>
          <div class="row gap wrap"><label class="btn sm ghost upload">📂 Buka berkas pendaftaran<input type="file" accept=".json,application/json" id="d-open" hidden></label>
          <button type="button" class="btn sm danger" id="d-reset">Hapus semua isian</button></div>
        </details>
      </section>
      <p class="muted small c reg-src">${src === 'default' ? 'Pengaturan formulir: bawaan aplikasi' : src === 'lokal' ? 'Pengaturan formulir: data admin di perangkat ini' : 'Pengaturan formulir diperbarui ' + esc(App.fmtDate((C.exported || '').slice(0, 10)))}</p>
    </div>`;
  }

  function refreshCheck() {
    const box = document.getElementById('ed-check');
    if (box && edit) box.innerHTML = statusHtml(R.check(C, edit));
  }

  // ---------- berkas kiriman ----------
  function buildFile() {
    const k = kontingen();
    return {
      app: R.FILE_APP, version: 1, created: new Date().toISOString(), event: C.event.shortName,
      kontingen: k ? { id: k.id, name: k.name, short: k.short } : null,
      officials: D.officials.filter((o) => o.name.trim()).map((o) => ({ role: o.role, name: o.name.trim(), phone: o.phone.trim() })),
      athletes: D.athletes.map((a) => ({
        ref: a.id, name: a.name.trim(), gender: a.gender, birth: a.birth, nik: a.nik,
        events: a.events.map((id) => ({ id, code: (evById(id) || {}).code || id })),
        photo: a.photo, docs: a.docs,
      })),
    };
  }
  function fileName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const k = kontingen();
    return `Pendaftaran-Woodball-${(k ? k.short || k.name : 'kontingen').replace(/[^\w-]+/g, '_')}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  }
  async function readyToSend() {
    if (edit) { App.toast('Simpan atau batalkan isian atlet dulu', 'err'); return false; }
    if (!D.kontingenId || !D.athletes.length) { App.toast('Pilih kabupaten/kota dan isi minimal 1 atlet', 'err'); return false; }
    const probs = problems();
    return !probs.length || (await App.ask('Masih ada catatan:\n- ' + probs.join('\n- ') + '\n\nTetap lanjut?'));
  }

  function loadFile(obj) {
    if (obj.app !== R.FILE_APP) throw new Error('Bukan berkas pendaftaran woodball');
    const k = obj.kontingen && (C.kontingen.find((x) => x.id === obj.kontingen.id) || C.kontingen.find((x) => x.name === obj.kontingen.name));
    const evId = (e) => (C.events.find((x) => x.id === e.id) || C.events.find((x) => x.code === e.code) || {}).id;
    D = {
      kontingenId: k ? k.id : '',
      officials: (obj.officials || []).map((o) => ({ id: App.uid('o_'), role: o.role || '', name: o.name || '', phone: o.phone || '' })),
      athletes: (obj.athletes || []).map((a) => ({
        id: a.ref || App.uid('a_'), name: a.name || '', gender: a.gender === 'P' ? 'P' : 'L', birth: a.birth || '', nik: a.nik || '',
        events: (a.events || []).map(evId).filter(Boolean), photo: a.photo || null, docs: a.docs || [],
      })),
    };
    if (!D.officials.length) D.officials = newDraft().officials;
  }

  // ---------- cetak rekap ----------
  function kop(title, sub) {
    const E = C.event;
    const half = Math.ceil(C.logos.length / 2);
    const img = (u) => `<img src="${u}" alt="">`;
    return `<div class="kop"><div class="kl">${C.logos.slice(0, half).map(img).join('')}</div>
      <div class="kc"><div class="k1">${esc(E.title)}</div><div class="k2">${esc(E.sport)} ${esc(E.region)}</div>
      <div class="k3">${esc(App.fmtDateRange(E.dateStart, E.dateEnd))} · ${esc(E.venue)}, ${esc(E.city)}</div></div>
      <div class="kr">${C.logos.slice(half).map(img).join('')}</div></div>
      <div class="doc-title">${esc(title)}</div>${sub ? `<div class="doc-sub">${esc(sub)}</div>` : ''}`;
  }
  function printHtml() {
    const k = kontingen();
    const offs = D.officials.filter((o) => o.name.trim());
    const lead = offs[0];
    const list = D.athletes.slice().sort((a, b) => a.gender.localeCompare(b.gender) || a.name.localeCompare(b.name));
    return `<section class="page flow">${kop('DAFTAR PENDAFTARAN ATLET', 'Kontingen ' + (k ? k.name : '-'))}
      <h4>Official</h4>
      <table class="pt"><thead><tr><th>No</th><th>Jabatan</th><th>Nama</th><th>No. HP</th></tr></thead><tbody>
      ${offs.map((o, i) => `<tr><td class="c">${i + 1}</td><td>${esc(o.role)}</td><td>${esc(o.name)}</td><td>${esc(o.phone)}</td></tr>`).join('') || '<tr><td colspan="4" class="c">-</td></tr>'}
      </tbody></table>
      <h4>Atlet</h4>
      <table class="pt reg-pt"><thead><tr><th>No</th><th>Foto</th><th>Nama</th><th>L/P</th><th>Tanggal Lahir</th><th>Umur per ${esc(App.fmtDate(C.event.dateStart))}</th><th>NIK</th><th>Nomor</th></tr></thead><tbody>
      ${list.map((a, i) => `<tr><td class="c">${i + 1}</td><td class="ph">${a.photo ? `<img src="${a.photo.dataUrl}" alt="">` : ''}</td><td>${esc(a.name)}</td><td class="c">${a.gender}</td>
        <td>${esc(a.birth ? App.fmtDate(a.birth) : '-')}</td><td>${esc(App.ageText(a.birth) || '-')}</td><td>${esc(a.nik || '-')}</td>
        <td>${esc(a.events.map(evById).filter(Boolean).map((ev) => ev.code).join(', '))}</td></tr>`).join('')}
      </tbody></table>
      <h4>Rekap per nomor</h4>
      <table class="pt"><thead><tr><th>Nomor</th><th>Atlet</th><th>Jumlah</th></tr></thead><tbody>
      ${R.quota(C, D.athletes).filter((q) => q.list.length).map((q) => `<tr><td>${esc(q.ev.code)} · ${esc(q.ev.name)}</td><td>${q.list.map((a) => esc(a.name)).join(', ')}</td><td class="c">${q.list.length}</td></tr>`).join('')}
      </tbody></table>
      <div class="signs end"><div class="sign"><div>................................, ${esc(App.fmtDate(App.today()))}</div><div>${esc(lead ? lead.role : 'Penanggung jawab')}</div>
        <div class="sign-space"></div><div class="sign-name">${esc(lead ? lead.name : '(....................................)')}</div></div></div>
    </section>`;
  }

  // ---------- unggah gambar/dokumen ----------
  async function readImage(file, maxSide, quality) {
    const url = await App.compressImage(await App.readFile(file), maxSide, quality);
    return { name: file.name, type: url.slice(5, url.indexOf(';')), dataUrl: url };
  }
  async function addDocs(files) {
    for (const file of files) {
      if (file.type === 'application/pdf') {
        if (file.size > 3 * 1024 * 1024) { App.toast(`${file.name} lebih dari 3 MB, kirim versi lebih kecil atau foto`, 'err'); continue; }
        edit.docs.push({ name: file.name, type: file.type, dataUrl: await App.readFile(file) });
      } else if (file.type.startsWith('image/')) edit.docs.push(await readImage(file, 1600, 0.75));
      else App.toast(`${file.name}: hanya gambar atau PDF`, 'err');
    }
  }

  // ---------- event ----------
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.of) {
      D.officials[+t.closest('.off-row').dataset.i][t.dataset.of] = t.value;
      saveDraft();
      return;
    }
    if (!edit) return;
    if (t.id === 'ed-name') edit.name = t.value;
    else if (t.id === 'ed-birth') { edit.birth = t.value; document.getElementById('ed-age').textContent = App.ageText(t.value); }
    else if (t.id === 'ed-nik') {
      t.value = t.value.replace(/\D/g, '').slice(0, 16);
      edit.nik = t.value;
      document.getElementById('ed-nik-info').textContent = t.value ? t.value.length + '/16' : '';
    } else return;
    refreshCheck();
  });

  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'd-k') { D.kontingenId = t.value; saveDraft(); render(); return; }
    if (t.id === 'd-open') {
      const file = t.files[0];
      if (!file) return;
      try {
        const obj = JSON.parse(await App.readFile(file, 'text'));
        if ((D.athletes.length || D.kontingenId) && !(await App.ask('Ganti isian sekarang dengan isi berkas ini?'))) return;
        loadFile(obj);
        edit = null;
        saveDraft();
        render();
        App.toast('Berkas dibuka');
      } catch (err) { App.toast('Gagal membuka: ' + err.message, 'err'); }
      return;
    }
    if (!edit) return;
    if (t.id === 'ed-gender') {
      edit.gender = t.value;
      edit.events = edit.events.filter((id) => { const ev = evById(id); return ev && (ev.gender === 'X' || ev.gender === edit.gender); });
      document.getElementById('ed-evs').innerHTML = evChecks(edit);
      refreshCheck();
    } else if (t.name === 'ev') {
      edit.events = Array.from(root.querySelectorAll('#ed-evs input[name=ev]:checked')).map((x) => x.value);
      refreshCheck();
    } else if (t.id === 'ed-photo' && t.files[0]) {
      edit.photo = await readImage(t.files[0], 600, 0.82);
      render();
    } else if (t.id === 'ed-docs' && t.files.length) {
      await addDocs(t.files);
      render();
    }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button, [data-ath-edit], [data-ath-del]');
    if (!b) return;
    if (b.id === 'off-add') {
      const roles = R.roles(C.registration);
      D.officials.push({ id: App.uid('o_'), role: roles[1] || roles[0] || 'Official', name: '', phone: '' });
      saveDraft(); render();
    } else if (b.dataset.offDel) {
      D.officials.splice(+b.dataset.offDel, 1);
      saveDraft(); render();
    } else if (b.id === 'ath-new') {
      edit = { id: App.uid('a_'), name: '', gender: 'L', birth: '', nik: '', events: [], photo: null, docs: [] };
      render();
      document.getElementById('editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('ed-name').focus({ preventScroll: true });
    } else if (b.dataset.athEdit) {
      edit = JSON.parse(JSON.stringify(D.athletes.find((a) => a.id === b.dataset.athEdit)));
      render();
      document.getElementById('editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (b.dataset.athDel) {
      const a = D.athletes.find((x) => x.id === b.dataset.athDel);
      if (!(await App.ask(`Hapus ${a.name || 'atlet ini'}?`))) return;
      D.athletes = D.athletes.filter((x) => x.id !== a.id);
      saveDraft(); render();
    } else if (b.id === 'ed-save') {
      if (!edit.name.trim()) { App.toast('Nama atlet wajib diisi', 'err'); return; }
      edit.name = edit.name.trim().replace(/\s+/g, ' ');
      const i = D.athletes.findIndex((a) => a.id === edit.id);
      if (i >= 0) D.athletes[i] = edit; else D.athletes.push(edit);
      edit = null;
      saveDraft(); render();
      App.toast('Atlet tersimpan');
    } else if (b.id === 'ed-cancel') {
      edit = null; render();
    } else if (b.id === 'ed-photo-del') {
      edit.photo = null; render();
    } else if (b.dataset.docDel) {
      edit.docs.splice(+b.dataset.docDel, 1); render();
    } else if (b.id === 'd-download') {
      if (!(await readyToSend())) return;
      App.download(fileName(), JSON.stringify(buildFile()));
      App.toast('Berkas diunduh, kirim ke panitia');
    } else if (b.id === 'd-share') {
      if (!(await readyToSend())) return;
      const file = new File([JSON.stringify(buildFile())], fileName(), { type: 'application/json' });
      try { await navigator.share({ files: [file], title: 'Pendaftaran Woodball', text: `Pendaftaran atlet woodball ${C.event.shortName} - ${(kontingen() || {}).name || ''}` }); }
      catch (err) { if (err.name !== 'AbortError') App.toast('Tidak bisa membagikan, pakai tombol Unduh', 'err'); }
    } else if (b.id === 'd-print') {
      if (edit) { App.toast('Simpan atau batalkan isian atlet dulu', 'err'); return; }
      document.getElementById('reg-print').innerHTML = printHtml();
      setTimeout(() => window.print(), 300); // beri waktu gambar dimuat
    } else if (b.id === 'd-theme') {
      const next = THEMES[(THEMES.indexOf(theme()) + 1) % THEMES.length];
      setTheme(next);
      b.outerHTML = themeBtn();
      App.toast(THEME_LABEL[next]);
    } else if (b.id === 'd-reset') {
      if (!(await App.ask('Hapus semua isian di formulir ini? Berkas yang sudah diunduh tidak terpengaruh.'))) return;
      D = newDraft(); edit = null;
      saveDraft(); render();
    }
  });

  async function start() {
    try {
      [C, src] = await loadConfig();
    } catch (e) {
      root.innerHTML = `<div class="reg-wrap"><div class="card"><h2>Formulir gagal dimuat</h2><pre>${esc(e.stack || e)}</pre></div></div>`;
      return;
    }
    const d = App.defaultState();
    C.registration = { ...R.defaults(), ...(C.registration || {}) };
    C.validation = { ...d.validation, ...(C.validation || {}) };
    C.logos = C.logos || [];
    App.S = C; // App.ageText memakai tanggal mulai event
    document.documentElement.style.setProperty('--brand', C.event.themeColor || '#16a34a');
    document.documentElement.style.setProperty('--accent', C.event.accentColor || '#dc2626');
    document.title = `Pendaftaran Atlet · ${C.event.sport} ${C.event.shortName}`;
    const saved = await draftGet();
    D = saved && saved.officials ? saved : newDraft();
    render();
    if (saved && (saved.athletes || []).length) App.toast(`Isian sebelumnya dipulihkan (${saved.athletes.length} atlet)`);
  }
  start();
})(window.App);
