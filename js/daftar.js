// Formulir pendaftaran atlet untuk official kontingen (daftar.html). Berjalan mandiri tanpa mode admin:
// official memilih kabupaten/kota dan mengetik ulang namanya, lalu mengisi nama atlet dan nomor tanding.
// Isian tersimpan sebagai draf di browser official, lalu dikirim ke server (atau diunduh sebagai berkas cadangan).
(function (App) {
  const R = App.reg, esc = App.esc;
  const root = document.getElementById('reg');
  let C = null; // konfigurasi formulir (event, kontingen, nomor, aturan)
  let D = null; // draf pendaftaran official
  let edit = null; // atlet yang sedang diisi (salinan, disimpan ke D saat "Simpan atlet")
  let src = 'default';
  let sending = false;

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
        if (!draftWarned) App.toast('Isian tidak tersimpan otomatis di browser ini, segera kirim setelah selesai', 'err');
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

  // Koneksi server (tanpa login): membaca pengaturan publik dan mengirim pendaftaran.
  const CFG = App.CLOUD || {};
  let sb = null;
  try {
    if (CFG.url && window.supabase) sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false } });
  } catch (e) { sb = null; }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Koneksi lambat / terputus')), ms))]);

  // Urutan sumber: ?lokal -> data admin; lalu server (pengaturan terbaru); lalu pendaftaran.json; lalu data admin; lalu default.
  async function loadConfig() {
    const fromAdmin = async () => {
      const a = await adminState();
      return a ? R.buildConfig(a.state, (id) => a.files[id]) : null;
    };
    if (new URLSearchParams(location.search).has('lokal')) {
      const c = await fromAdmin();
      if (c) return [c, 'lokal'];
    }
    if (sb) {
      try {
        const { data } = await withTimeout(sb.from('public_state').select('state').eq('id', 'main').maybeSingle(), 8000);
        const ps = data && data.state;
        if (ps && ps.events) return [{ ...R.buildConfig({ ...App.defaultState(), ...ps }, (id) => (ps.logoUrls || {})[id]), exported: ps.publishedAt }, 'server'];
      } catch (e) { /* offline: pakai sumber berikutnya */ }
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

  const newDraft = () => ({ kontingenId: '', verified: '', athletes: [] });
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
    return `<a class="reg-back" href="index.html">← Beranda</a>
      <header class="card reg-head">
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

  // Nomor lawan jenis dinonaktifkan setelah atlet memilih nomor putra atau putri.
  function evChecks(a) {
    const g = R.genderOf(C, a.events);
    const group = (disc, label) => {
      const list = C.events.filter((ev) => ev.discipline === disc);
      if (!list.length) return '';
      return `<div class="evgroup"><span class="evgroup-t ${disc}">${label}</span><div class="evchips">${list.map((ev) => {
        const off = g && ev.gender !== 'X' && ev.gender !== g;
        return `<label class="evchip"><input type="checkbox" name="ev" value="${ev.id}" ${a.events.includes(ev.id) ? 'checked' : ''} ${off ? 'disabled' : ''}>
          <span><b>${esc(ev.code)}</b><small>${esc(ev.name)}</small></span></label>`;
      }).join('')}</div></div>`;
    };
    return group('stroke', 'Stroke') + group('fairway', 'Fairway');
  }

  // Hanya muncul kalau atlet cuma ikut nomor mix: putra/putri tidak bisa dibaca dari nomornya.
  const mixChoice = (a) => (a.events.length && !R.genderOf(C, a.events)
    ? `<label class="ed-mix">Atlet ini putra atau putri? <small class="muted">(perlu untuk pasangan nomor mix)</small>
        <select id="ed-gender"><option value="">- pilih -</option>${options([['L', 'Putra'], ['P', 'Putri']], a.gender)}</select></label>` : '');

  function editor() {
    const a = edit;
    const isNew = !D.athletes.some((x) => x.id === a.id);
    return `<div class="ath-editor" id="editor"><h3>${isNew ? 'Atlet baru' : 'Ubah atlet'}</h3>
      <label>Nama atlet<input id="ed-name" value="${esc(a.name)}" autocomplete="off"></label>
      <div class="field-t">Nomor tanding</div>
      <div class="evpick" id="ed-evs">${evChecks(a)}</div>
      <div id="ed-mix">${mixChoice(a)}</div>
      <div id="ed-check">${statusHtml(R.check(C, a))}</div>
      <div class="row gap wrap ed-foot"><button type="button" class="btn" id="ed-save">Simpan atlet</button><button type="button" class="btn ghost" id="ed-cancel">Batal</button></div>
    </div>`;
  }

  function athleteCard(a, i) {
    const evs = a.events.map(evById).filter(Boolean);
    const k = kontingen();
    return `<div class="ath-card">
      <div class="ath-info"><b>${i + 1}. ${esc(a.name || '(tanpa nama)')}</b>
        <div class="small muted">${esc(k ? k.name : '-')}</div>
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

  // Langkah pertama: pilih kabupaten/kota lalu ketik ulang namanya dengan huruf kapital.
  function gate() {
    const k = kontingen();
    return `<div class="reg-wrap">
      ${header()}
      <section class="card reg-gate"><h2>Verifikasi Kabupaten/Kota</h2>
        <p class="muted">Pilih kabupaten/kota, lalu ketik ulang namanya dengan <b>HURUF KAPITAL</b> untuk membuka formulir.</p>
        <form id="gate-form" autocomplete="off">
          <label>Kabupaten / Kota<select id="d-k"><option value="">- pilih kabupaten/kota -</option>${options(C.kontingen.map((x) => [x.id, x.name]), D.kontingenId)}</select></label>
          <label>Ketik ulang nama kabupaten/kota${k ? ` <small class="muted">(${esc(k.name)})</small>` : ''}<input id="d-confirm" class="reg-confirm" autocapitalize="characters" spellcheck="false" ${k ? '' : 'disabled'}></label>
          <div class="reg-miss hidden" id="gate-err"></div>
          <button class="btn" ${k ? '' : 'disabled'}>Lanjut ke formulir</button>
        </form>
      </section></div>`;
  }

  function render() {
    const reg = C.registration;
    if (!reg.open) {
      root.innerHTML = `<div class="reg-wrap">${header()}<div class="card"><h2>Pendaftaran ditutup</h2>
        <p>Formulir pendaftaran sedang tidak dibuka.${contactLine() ? ' Hubungi ' + contactLine() + '.' : ''}</p></div></div>`;
      return;
    }
    const k = kontingen();
    if (!k || D.verified !== k.id) { root.innerHTML = gate(); return; }
    const probs = problems();
    const wa = R.waNumber(reg.contactPhone);
    root.innerHTML = `<div class="reg-wrap">
      ${header()}
      <section class="card reg-kbar"><div><small>Asal Kota / Kabupaten</small><b>${esc(k.name)}</b></div>
        <span class="pill ok">✓ Terverifikasi</span><button type="button" class="btn sm ghost" id="d-change">Ganti</button></section>

      <section class="card"><div class="row between wrap"><h2><span class="step">1</span> Atlet <small class="muted">(${D.athletes.length})</small></h2>
        ${edit ? '' : '<button type="button" class="btn" id="ath-new">+ Tambah atlet</button>'}</div>
        ${edit ? editor() : ''}
        <div class="ath-cards">${D.athletes.map(athleteCard).join('') || (edit ? '' : empty('Belum ada atlet. Klik <b>+ Tambah atlet</b>.'))}</div>
      </section>

      <section class="card"><h2><span class="step">2</span> Rekap per nomor</h2>${quotaTable()}</section>

      <section class="card"><h2><span class="step">3</span> Kirim ke panitia</h2>
        ${probs.length ? `<div class="reg-probs"><b>Periksa dulu:</b><ul>${probs.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : '<p class="pill ok">Data siap dikirim</p>'}
        ${D.sentAt ? `<div class="reg-sent">✅ Terkirim ke panitia ${esc(new Date(D.sentAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}${D.sentCount != null ? ` · ${D.sentCount} atlet` : ''}.
          <span class="small">Kalau ada perubahan, perbaiki lalu kirim lagi.</span></div>` : ''}
        <div class="row gap wrap">
          ${sb ? `<button type="button" class="btn" id="d-send">📨 ${D.sentAt ? 'Kirim ulang' : 'Kirim ke panitia'}</button>` : ''}
          <button type="button" class="btn ${sb ? 'ghost' : ''}" id="d-download">💾 Unduh berkas</button>
          ${canShareFiles ? '<button type="button" class="btn ghost" id="d-share">📤 Bagikan berkas</button>' : ''}
          <button type="button" class="btn ghost" id="d-print">🖨️ Cetak rekap</button>
          ${wa ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(`Pendaftaran atlet woodball ${C.event.shortName} - kontingen ${k.name}`)}">💬 Chat panitia</a>` : ''}
        </div>
        <p class="muted small">${sb ? 'Kalau internet bermasalah, klik <b>Unduh berkas</b> lalu kirim file-nya ke panitia lewat WhatsApp/email' : 'Klik <b>Unduh berkas</b> lalu kirim file-nya ke panitia lewat WhatsApp/email'}${contactLine() ? ': <b>' + contactLine() + '</b>' : ''}.</p>
        <details class="reg-more"><summary class="small muted">Buka berkas lama / mulai baru</summary>
          <p class="muted small">Berkas yang sudah diunduh bisa dibuka lagi untuk diperbaiki, misalnya di perangkat lain. Isian di halaman ini tersimpan otomatis di browser ini.</p>
          <div class="row gap wrap"><label class="btn sm ghost upload">📂 Buka berkas pendaftaran<input type="file" accept=".json,application/json" id="d-open" hidden></label>
          <button type="button" class="btn sm danger" id="d-reset">Hapus semua isian</button></div>
        </details>
      </section>
    </div>`;
  }

  function refreshEditor() {
    if (!edit) return;
    document.getElementById('ed-evs').innerHTML = evChecks(edit);
    document.getElementById('ed-mix').innerHTML = mixChoice(edit);
    refreshCheck();
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
      athletes: D.athletes.map((a) => ({
        ref: a.id, name: a.name.trim(), gender: a.gender,
        events: a.events.map((id) => ({ id, code: (evById(id) || {}).code || id })),
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
    if (!D.athletes.length) { App.toast('Isi minimal 1 atlet', 'err'); return false; }
    const probs = problems();
    return !probs.length || (await App.ask('Masih ada catatan:\n- ' + probs.join('\n- ') + '\n\nTetap lanjut?'));
  }

  function loadFile(obj) {
    if (obj.app !== R.FILE_APP) throw new Error('Bukan berkas pendaftaran woodball');
    const k = obj.kontingen && (C.kontingen.find((x) => x.id === obj.kontingen.id) || C.kontingen.find((x) => x.name === obj.kontingen.name));
    const evId = (e) => (C.events.find((x) => x.id === e.id) || C.events.find((x) => x.code === e.code) || {}).id;
    D = {
      kontingenId: k ? k.id : '', verified: k && k.id === D.verified ? k.id : '',
      athletes: (obj.athletes || []).map((a) => ({
        id: a.ref || App.uid('a_'), name: a.name || '', gender: a.gender === 'P' || a.gender === 'L' ? a.gender : null,
        events: (a.events || []).map(evId).filter(Boolean),
      })),
    };
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
    const list = D.athletes.slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="page flow">${kop('DAFTAR PENDAFTARAN ATLET', 'Kontingen ' + (k ? k.name : '-'))}
      <table class="pt"><thead><tr><th>No</th><th>Nama</th><th>Asal Kota/Kabupaten</th><th>Nomor Tanding</th></tr></thead><tbody>
      ${list.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${esc(a.name)}</td><td>${esc(k ? k.name : '-')}</td>
        <td>${esc(a.events.map(evById).filter(Boolean).map((ev) => ev.code).join(', '))}</td></tr>`).join('')}
      </tbody></table>
      <div class="signs end"><div class="sign"><div>................................, ${esc(App.fmtDate(App.today()))}</div><div>Penanggung jawab</div>
        <div class="sign-space"></div><div class="sign-name">(....................................)</div></div></div>
    </section>`;
  }

  // ---------- kirim online ----------
  const errText = (e) => {
    const m = (e && e.message) || String(e);
    if (!navigator.onLine || /fetch|network|koneksi|timeout/i.test(m)) return 'Tidak bisa terhubung ke server. Periksa internet lalu coba lagi, atau pakai tombol Unduh berkas.';
    return m;
  };
  async function sendOnline() {
    if (sending || !(await readyToSend())) return;
    const k = kontingen();
    const file = buildFile();
    sending = true;
    App.toast('Mengirim pendaftaran…');
    try {
      const { data: token, error } = await withTimeout(sb.rpc('reg_start', { p_kontingen: k.id, p_nama: k.name }), 15000);
      if (error) throw error;
      const { error: se } = await withTimeout(sb.rpc('reg_submit', { p_token: token, p_payload: file }), 20000);
      if (se) throw se;
      D.sentAt = new Date().toISOString();
      D.sentCount = file.athletes.length;
      saveDraft();
      render();
      App.notice(`Pendaftaran kontingen ${k.name} (${file.athletes.length} atlet) sudah diterima server panitia.\n\nKalau ada perubahan, perbaiki di formulir ini lalu klik Kirim ulang.`, 'Terkirim ✓');
    } catch (e) {
      App.notice(errText(e), 'Gagal mengirim');
    } finally {
      sending = false;
    }
  }

  // ---------- event ----------
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (edit && t.id === 'ed-name') { edit.name = t.value; refreshCheck(); }
  });

  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'gate-form') return;
    e.preventDefault();
    const k = kontingen();
    const typed = document.getElementById('d-confirm').value.trim();
    if (!k || typed !== k.name) {
      const err = document.getElementById('gate-err');
      err.textContent = typed.toUpperCase() === (k && k.name) ? 'Gunakan huruf kapital semua.' : 'Nama tidak sama. Ketik ulang persis seperti nama kabupaten/kota yang dipilih.';
      err.classList.remove('hidden');
      return;
    }
    D.verified = k.id;
    saveDraft();
    render();
  });

  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'd-k') { D.kontingenId = t.value; saveDraft(); render(); document.getElementById('d-confirm').focus(); return; }
    if (t.id === 'd-open') {
      const file = t.files[0];
      if (!file) return;
      try {
        const obj = JSON.parse(await App.readFile(file, 'text'));
        if (D.athletes.length && !(await App.ask('Ganti isian sekarang dengan isi berkas ini?'))) return;
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
      edit.gender = t.value || null;
      refreshCheck();
    } else if (t.name === 'ev') {
      edit.events = Array.from(root.querySelectorAll('#ed-evs input[name=ev]:checked')).map((x) => x.value);
      edit.gender = R.genderOf(C, edit.events) || (edit.events.length ? edit.gender : null);
      refreshEditor();
    }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'd-theme') {
      const next = THEMES[(THEMES.indexOf(theme()) + 1) % THEMES.length];
      setTheme(next);
      b.outerHTML = themeBtn();
      App.toast(THEME_LABEL[next]);
    } else if (b.id === 'd-change') {
      if (D.athletes.length && !(await App.ask('Ganti kabupaten/kota? Daftar atlet di formulir ini akan dikosongkan.', 'Ya, ganti'))) return;
      D = newDraft();
      edit = null;
      saveDraft(); render();
    } else if (b.id === 'ath-new') {
      edit = { id: App.uid('a_'), name: '', gender: null, events: [] };
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
    } else if (b.id === 'd-send') {
      await sendOnline();
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
    App.S = C;
    document.documentElement.style.setProperty('--brand', C.event.themeColor || '#16a34a');
    document.documentElement.style.setProperty('--accent', C.event.accentColor || '#dc2626');
    document.title = `Pendaftaran Atlet · ${C.event.sport} ${C.event.shortName}`;
    const saved = await draftGet();
    D = saved && Array.isArray(saved.athletes) ? saved : newDraft();
    render();
    if (saved && saved.athletes && saved.athletes.length) App.toast(`Isian sebelumnya dipulihkan (${saved.athletes.length} atlet)`);
  }
  start();
})(window.App);
