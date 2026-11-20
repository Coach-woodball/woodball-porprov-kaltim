// Kerangka UI: router berbasis hash, layout, mode admin.
(function (App) {
  App.views = {};
  App.isAdmin = () => sessionStorage.getItem('wb-admin') === '1';

  const ICON = {
    dashboard: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    kontingen: '<path d="M5 21V4m0 0h12l-2.5 4.5L17 13H5"/>',
    athletes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
    peserta: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M15 8h6M15 12h6M17 16h4"/>',
    announcements: '<path d="M4 10v4l3 .5 2 5.5h3l-1.6-5L20 18V6L7 9.5z"/>',
    daftar: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    registration: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>',
    events: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 3.5h6M9 10h6M9 14h6M9 18h3.5"/>',
    stroke: '<path d="M12 18V3l7 3.5-7 3.5"/><ellipse cx="12" cy="19" rx="7" ry="2.5"/>',
    fairway: '<path d="M4 4l7 7M4 4v4M4 4h4M20 20l-7-7M20 20v-4M20 20h-4M20 4l-6 6M4 20l6-6"/>',
    results: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    display: '<rect x="2" y="4" width="20" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M2.5 12h3M18.5 12h3M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    backup: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    light: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dark: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  };
  App.icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ''}</svg>`;

  // Tema: auto (ikut sistem) / terang / gelap, disimpan per perangkat.
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_LABEL = { auto: 'Tema: ikut sistem', light: 'Tema: terang', dark: 'Tema: gelap' };
  App.theme = () => { try { return localStorage.getItem('wb-theme') || 'auto'; } catch (e) { return 'auto'; } };
  App.applyTheme = (t) => {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  };

  const NAV = [
    ['dashboard', false], ['daftar', 'public'], ['peserta', false], ['kontingen', true], ['athletes', true], ['registration', true], ['announcements', true], ['events', true], ['stroke', true], ['fairway', true],
    ['results', false], ['print', false], ['display', true], ['settings', true], ['backup', true],
  ];

  App.route = () => {
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/').map(decodeURIComponent);
    return { name: parts[0], params: parts.slice(1) };
  };
  App.go = (path) => { location.hash = '#/' + path; };

  App.logoImgs = (cls = 'logo') => (App.S.event.logos || []).map((id) => {
    const u = App.files.url(id);
    return u ? `<img class="${cls}" src="${u}" alt="">` : '';
  }).join('');

  function layout(inner, routeName) {
    const E = App.S.event;
    const admin = App.isAdmin();
    // 'public': hanya untuk pengunjung umum; daftar membuka formulir pendaftaran.
    // Menu Pendaftaran umum hanya tampil selama formulir dibuka.
    const regOpen = (App.S.registration || {}).open !== false;
    // List Peserta untuk umum hanya tampil kalau dibuka admin (admin selalu melihatnya).
    const hidden = (key) => (key === 'daftar' && !regOpen) || (key === 'peserta' && !admin && !App.S.publicPages.peserta);
    const nav = NAV.filter(([key, adm]) => !hidden(key) && (adm === 'public' ? !admin : admin || !adm)).map(([key]) =>
      `<a href="${key === 'daftar' ? 'daftar.html' : '#/' + key}" class="${routeName === key ? 'active' : ''}">${App.icon(key)}<span>${App.esc(App.S.menu[key] || key)}</span></a>`).join('');
    const th = App.theme();
    return `
      <header class="topbar glass no-print">
        <button class="hamb" data-act="toggle-nav" aria-label="Menu"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
        <div class="brand">${App.logoImgs('logo-sm')}<div><b>${App.esc(E.sport)} <span class="dot">•</span> ${App.esc(E.shortName)}</b><small>${App.esc(App.fmtDateRange(E.dateStart, E.dateEnd))} · ${App.esc(E.city)}</small></div></div>
        <div class="spacer"></div>
        <button class="icon-btn" data-act="theme" title="${THEME_LABEL[th]}" aria-label="${THEME_LABEL[th]}">${App.icon(th)}</button>
        ${admin ? `${App.cloud.badge()}<span class="badge admin">ADMIN</span><button class="btn sm ghost" data-act="logout">Keluar</button>`
          : '<button class="btn sm" data-act="login">Masuk Admin</button>'}
      </header>
      <nav class="sidebar glass no-print" id="sidebar">${nav}</nav>
      <div class="scrim no-print" data-act="toggle-nav"></div>
      <main class="main" id="main">${simBanner(admin)}${inner}</main>`;
  }

  function simBanner(admin) {
    if (!App.sim) return '';
    const t = new Date(App.sim.started).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    return `<div class="card sim-banner no-print"><div><b>🧪 Mode simulasi</b> <span class="muted small">sejak ${App.esc(t)}${App.sim.cleared ? ' · pairing, skor & bagan dikosongkan' : ''}</span>
      <div class="small">Silakan coba undi pairing, bagan, dan input skor. Semua perubahan dibuang dan data asli kembali saat simulasi diakhiri.${App.cloud.admin ? ' Selama simulasi, data tidak dikirim ke server dan hasil publik tidak berubah.' : ''}</div></div>
      ${admin ? '<button class="btn sm" data-act="sim-end">Akhiri &amp; kembalikan data</button>' : ''}</div>`;
  }

  App.render = () => {
    const { name, params } = App.route();
    const view = App.views[name] || App.views.dashboard;
    const root = document.getElementById('app');
    document.documentElement.style.setProperty('--brand', App.S.event.themeColor || '#16a34a');
    document.documentElement.style.setProperty('--accent', App.S.event.accentColor || '#dc2626');
    document.documentElement.classList.toggle('score-neutral', App.scoreMode() === 'neutral');
    if (view.admin && !App.isAdmin()) {
      root.innerHTML = layout(`<div class="card"><h2>Butuh mode admin</h2><p>Halaman ini hanya untuk admin.</p><button class="btn" data-act="login">Masuk Admin</button></div>`, name);
      return;
    }
    if (view.bare) {
      root.innerHTML = view.render(params);
    } else {
      root.innerHTML = layout(view.render(params), name);
    }
    document.body.classList.toggle('bare', !!view.bare);
    if (view.mount) view.mount(root, params);
    if (App.drawBrackets) requestAnimationFrame(() => App.drawBrackets(root));
    document.body.classList.remove('nav-open');
  };

  App.rerender = () => {
    const y = window.scrollY;
    App.render();
    window.scrollTo(0, y);
  };

  // Simpan + render ulang, dipakai setelah aksi admin.
  App.commit = (msg) => {
    App.save();
    App.rerender();
    if (msg) App.toast(msg);
  };

  // Buat PIN baru (dua kali ketik). Mengembalikan hash PIN atau null.
  App.newPin = async (title) => {
    const v = await App.dialog({ title, text: 'Minimal 4 karakter. Simpan PIN ini baik-baik.', ok: 'Simpan PIN',
      fields: [{ label: 'PIN baru', type: 'password', numeric: true }, { label: 'Ulangi PIN', type: 'password', numeric: true }] });
    if (!v) return null;
    if (v[0].length < 4) { App.toast('PIN minimal 4 karakter', 'err'); return null; }
    if (v[0] !== v[1]) { App.toast('PIN tidak sama', 'err'); return null; }
    return App.hash(v[0]);
  };

  // Online: masuk dengan akun admin (email + password). PIN hanya untuk mode di perangkat / saat offline.
  App.login = async () => {
    if (App.cloud.enabled && navigator.onLine) return App.cloud.login();
    const A = App.S.admin;
    if (!A.pinHash) {
      const h = await App.newPin('Belum ada PIN admin, buat PIN baru');
      if (!h) return;
      A.pinHash = h;
      App.save(true);
    } else {
      const v = await App.dialog({ title: App.cloud.enabled ? 'Masuk Admin (offline)' : 'Masuk Admin',
        text: App.cloud.enabled ? 'Tidak ada koneksi internet. Masuk dengan PIN perangkat ini (bukan password akun). Data dikirim ke server saat internet kembali.' : '',
        fields: [{ label: 'PIN admin', type: 'password', numeric: true }], ok: 'Masuk' });
      if (!v) return;
      if (App.hash(v[0]) !== A.pinHash) return App.toast(App.cloud.enabled ? 'PIN salah (saat offline, pakai PIN perangkat, bukan password akun)' : 'PIN salah', 'err');
    }
    sessionStorage.setItem('wb-admin', '1');
    App.toast('Mode admin aktif');
    App.rerender();
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'toggle-nav') document.body.classList.toggle('nav-open');
    else if (act === 'theme') {
      const next = THEMES[(THEMES.indexOf(App.theme()) + 1) % THEMES.length];
      try { localStorage.setItem('wb-theme', next); } catch (err) { /* abaikan */ }
      App.applyTheme(next);
      App.rerender();
      App.toast(THEME_LABEL[next]);
    }
    else if (act === 'login') App.login();
    else if (act === 'scoremode') {
      const next = App.scoreMode() === 'neutral' ? 'color' : 'neutral';
      try { localStorage.setItem('wb-scoremode', next); } catch (err) { /* abaikan */ }
      App.rerender();
      App.toast(next === 'neutral' ? 'Angka gate: netral' : 'Angka gate: berwarna');
    }
    else if (act === 'sim-end') {
      App.ask('Akhiri simulasi? Semua perubahan selama simulasi dibuang dan data kembali seperti sebelum simulasi.', 'Akhiri simulasi').then(async (ok) => {
        if (!ok) return;
        await App.endSim();
        App.rerender();
        App.toast('Simulasi selesai, data asli dipulihkan');
      });
    }
    else if (act === 'logout') {
      (async () => {
        if (App.cloud.admin && !(await App.cloud.logout())) return;
        sessionStorage.removeItem('wb-admin');
        App.toast('Keluar dari mode admin');
        App.go('dashboard');
        App.rerender();
      })();
    }
  });

  window.addEventListener('hashchange', () => { App.render(); window.scrollTo(0, 0); });

  // ---------- Komponen kecil ----------
  App.ui = {
    options: (list, value) => list.map(([v, l]) => `<option value="${App.esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${App.esc(l)}</option>`).join(''),
    kontingenOptions: (value, blank = true) => (blank ? '<option value="">- pilih kontingen -</option>' : '')
      + App.ui.options(App.S.kontingen.map((k) => [k.id, k.name]), value),
    eventTabs: (discipline, currentId, base) => {
      const evs = App.S.events.filter((e) => !discipline || e.discipline === discipline);
      return `<div class="tabs">${evs.map((e) => `<a href="#/${base}/${e.id}" class="${e.id === currentId ? 'active' : ''}">${App.esc(e.name)}</a>`).join('')}</div>`;
    },
    statusPill: (s) => ({ done: '<span class="pill ok">Selesai</span>', live: '<span class="pill live">Berjalan</span>', sd: '<span class="pill live">Sudden death</span>', bye: '<span class="pill">BYE</span>' }[s] || '<span class="pill">Belum</span>'),
    empty: (msg) => `<div class="empty">${msg}</div>`,
  };

  // Lampiran scan lembar skor.
  App.ui.scanBlock = (fileIds, key, label = '📎 Upload scan') => `
    <div class="scans">
      ${(fileIds || []).map((id) => {
        const f = App.files.get(id);
        if (!f) return '';
        const thumb = f.type.startsWith('image/') ? `<img src="${f.dataUrl}" alt="">` : '<div class="pdf">PDF</div>';
        return `<div class="scan">${`<a href="#" data-scan-open="${id}">${thumb}</a>`}${App.isAdmin() ? `<button class="x" data-scan-del="${id}" data-scan-key="${key}" title="Hapus">×</button>` : ''}</div>`;
      }).join('')}
      ${App.isAdmin() ? `<label class="btn sm ghost upload">${label}<input type="file" accept="image/*,application/pdf" multiple data-scan-add="${key}" hidden></label>` : ''}
    </div>`;

  App.openFile = (id) => {
    const f = App.files.get(id);
    if (!f) return;
    const w = window.open('', '_blank');
    if (!w) return App.toast('Pop-up diblokir browser', 'err');
    if (f.type === 'application/pdf') w.document.write(`<title>${App.esc(f.name)}</title><iframe src="${f.dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
    else w.document.write(`<title>${App.esc(f.name)}</title><body style="margin:0;background:#222"><img src="${f.dataUrl}" style="max-width:100%;display:block;margin:auto"></body>`);
  };

  // getList(key) mengembalikan array fileId yang bisa dimodifikasi untuk key tersebut.
  App.bindScans = (root, getList) => {
    root.querySelectorAll('[data-scan-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); App.openFile(a.dataset.scanOpen); }));
    root.querySelectorAll('[data-scan-add]').forEach((inp) => inp.addEventListener('change', async () => {
      const list = getList(inp.dataset.scanAdd);
      for (const file of inp.files) {
        let url = await App.readFile(file);
        if (file.type.startsWith('image/')) url = await App.compressImage(url);
        const id = await App.files.add(file.name, url.startsWith('data:image/jpeg') ? 'image/jpeg' : file.type, url);
        list.push(id);
      }
      App.commit('Scan tersimpan');
    }));
    root.querySelectorAll('[data-scan-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await App.ask('Hapus scan ini?'))) return;
      const list = getList(b.dataset.scanKey);
      const i = list.indexOf(b.dataset.scanDel);
      if (i >= 0) list.splice(i, 1);
      await App.files.remove(b.dataset.scanDel);
      App.commit('Scan dihapus');
    }));
  };

  // Undian model roda putar: semua nama ada di roda, roda berhenti di nama berikutnya,
  // nama itu masuk ke slotnya lalu keluar dari roda. boxes: [{label, items:[nama]}].
  // Hasil sudah ditentukan sistem sebelumnya; roda hanya menampilkan urutannya.
  const WHEEL_COLORS = ['#1f7a3e', '#c8202f', '#d9a21b', '#1d5fa8', '#2e9e6a', '#8e3fa0', '#e0702a', '#22808a'];
  App.drawAnimation = ({ title, sub, boxes }) => new Promise((resolve) => {
    const esc = App.esc;
    const finals = boxes.flatMap((b) => b.items);
    const clean = (s) => String(s || '').replace(/^\d+\.\s*/, '');
    if (!finals.some((x) => x && x !== 'BYE')) return resolve();
    let sound = true;
    try { sound = localStorage.getItem('wb-wheel-sound') !== '0'; } catch (e) { /* abaikan */ }
    const el = document.createElement('div');
    el.className = 'draw-overlay';
    el.innerHTML = `<div class="draw-panel glass wheel-mode">
      <div class="draw-head"><div><div class="draw-title">🎡 ${esc(title)}</div>${sub ? `<div class="muted">${esc(sub)}</div>` : ''}</div>
        <div class="row gap"><span class="draw-status pill live">Siap diputar</span>
          <button class="btn sm ghost" data-sound title="Suara">${sound ? '🔊' : '🔇'}</button>
          <button class="btn sm ghost" data-full title="Layar penuh">⛶</button>
          <button class="btn sm ghost" data-exit title="Keluar (hasil undian tetap tersimpan)">✕ Keluar</button></div></div>
      <div class="wheel-body">
        <div class="wheel-side">
          <div class="wheel-wrap"><canvas class="wheel"></canvas><div class="wheel-pin"></div><div class="wheel-hub"></div></div>
          <div class="wheel-pick"><small>Terpilih</small><b data-pick>-</b><span class="muted small" data-dest></span></div>
          <div class="row gap wheel-btns"><button class="btn" data-spin>🎡 Putar</button><button class="btn ghost" data-auto>▶ Putar otomatis</button></div>
          <div class="muted small c" data-left></div>
        </div>
        <div class="draw-grid">${boxes.map((b, bi) => `<div class="draw-box" style="--i:${bi}"><div class="draw-label">${esc(b.label)}</div>
          ${b.items.map(() => '<div class="draw-slot"><span>?</span></div>').join('')}</div>`).join('')}</div>
      </div>
      <div class="row gap draw-foot"><button class="btn ghost" data-skip>Tampilkan semua hasil</button><button class="btn hidden" data-close>Selesai</button></div></div>`;
    document.body.appendChild(el);

    const slots = Array.from(el.querySelectorAll('.draw-slot'));
    const slotDest = [];
    boxes.forEach((b) => b.items.forEach(() => slotDest.push(b.label)));
    const canvas = el.querySelector('canvas.wheel');
    const ctx = canvas.getContext('2d');
    const $ = (s) => el.querySelector(s);
    // Isi roda = nama yang belum keluar (BYE tidak ikut roda).
    let wheel = finals.map((x, i) => ({ i, name: clean(x) })).filter((x) => finals[x.i] && finals[x.i] !== 'BYE');
    let next = 0, angle = 0, spinning = false, auto = false, done = false, raf = 0;
    const timers = [];

    let audio = null;
    const tick = () => {
      if (!sound) return;
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'triangle'; o.frequency.value = 1400;
        g.gain.setValueAtTime(0.08, audio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.04);
        o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.05);
      } catch (e) { /* tanpa suara */ }
    };

    const size = () => {
      const css = canvas.clientWidth || 420;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.height = Math.round(css * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return css;
    };
    let W = 0;
    const draw = (hi = -1) => {
      if (!W) W = size();
      const r = W / 2, n = wheel.length;
      ctx.clearRect(0, 0, W, W);
      if (!n) {
        ctx.beginPath(); ctx.arc(r, r, r - 4, 0, Math.PI * 2); ctx.fillStyle = WHEEL_COLORS[0]; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(r * 0.13)}px Montserrat, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Undian selesai', r, r + r * 0.32);
        return;
      }
      const seg = (Math.PI * 2) / n;
      const font = Math.max(9, Math.min(17, (r * seg) * 0.55, 300 / Math.max(8, n)));
      for (let k = 0; k < n; k++) {
        const a0 = angle + k * seg - Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(r, r); ctx.arc(r, r, r - 4, a0, a0 + seg); ctx.closePath();
        ctx.fillStyle = WHEEL_COLORS[(n % WHEEL_COLORS.length === 1 && k === n - 1) ? 2 : k % WHEEL_COLORS.length];
        ctx.fill();
        if (k === hi) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = n > 40 ? 0.6 : 1.4; ctx.stroke();
        ctx.save();
        ctx.translate(r, r); ctx.rotate(a0 + seg / 2);
        ctx.fillStyle = '#fff'; ctx.font = `600 ${font}px Montserrat, system-ui, sans-serif`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        let t = wheel[k].name; const max = r * 0.72;
        while (t.length > 3 && ctx.measureText(t).width > max) t = t.slice(0, -2);
        if (t !== wheel[k].name) t = t.replace(/\s+$/, '') + '…';
        ctx.fillText(t, r - 14, 0);
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(r, r, r - 2, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    };

    const fillByes = () => { while (next < finals.length && (!finals[next] || finals[next] === 'BYE')) lock(next++); };
    const lock = (i) => {
      const s = slots[i];
      if (!s || s.classList.contains('locked')) return;
      s.firstChild.textContent = finals[i] || '-';
      s.classList.add('locked');
      if (finals[i] === 'BYE') s.classList.add('bye');
      s.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const status = () => {
      $('[data-left]').textContent = wheel.length ? `${wheel.length} nama tersisa di roda` : '';
    };
    const finish = () => {
      done = true; auto = false; spinning = false;
      cancelAnimationFrame(raf); timers.forEach(clearTimeout);
      slots.forEach((_, i) => lock(i));
      wheel = []; draw(); status();
      $('.draw-status').textContent = 'Selesai';
      $('.draw-status').className = 'draw-status pill ok';
      ['[data-skip]', '[data-spin]', '[data-auto]'].forEach((s) => $(s).classList.add('hidden'));
      $('[data-close]').classList.remove('hidden');
    };

    const spin = () => {
      if (spinning || done) return;
      fillByes();
      if (next >= finals.length || !wheel.length) return finish();
      const k = wheel.findIndex((w) => w.i === next);
      const n = wheel.length, seg = (Math.PI * 2) / n;
      // Pusat segmen k berada di atas (jarum) saat angle + (k + .5) * seg = 0 (mod 2π); beri sedikit acak di dalam segmen.
      const jitter = (Math.random() - 0.5) * seg * 0.6;
      const base = -((k + 0.5) * seg) + jitter;
      const turns = (auto ? 3 : 5) + Math.floor(Math.random() * 2);
      let target = base;
      while (target < angle + turns * Math.PI * 2) target += Math.PI * 2;
      const start = angle, dist = target - start, dur = n === 1 ? 900 : (auto ? 2600 : 4600);
      const t0 = performance.now();
      let lastSeg = Math.floor(((-start) / seg) % n);
      spinning = true;
      $('.draw-status').textContent = 'Berputar…';
      $('[data-pick]').textContent = '…'; $('[data-dest]').textContent = '';
      $('[data-spin]').disabled = true;
      const frame = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        angle = start + dist * (1 - Math.pow(1 - p, 4));
        const cur = Math.floor((((-angle) / seg) % n + n) % n);
        if (cur !== lastSeg) { lastSeg = cur; tick(); }
        draw();
        if (p < 1) { raf = requestAnimationFrame(frame); return; }
        angle = ((target % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        draw(k);
        const picked = wheel[k];
        $('[data-pick]').textContent = picked.name;
        $('[data-dest]').textContent = '→ ' + slotDest[picked.i];
        $('.wheel-pick').classList.remove('pop'); void $('.wheel-pick').offsetWidth; $('.wheel-pick').classList.add('pop');
        timers.push(setTimeout(() => {
          lock(picked.i);
          wheel.splice(k, 1);
          next = picked.i + 1;
          fillByes();
          spinning = false;
          $('[data-spin]').disabled = false;
          $('.draw-status').textContent = auto ? 'Putar otomatis' : 'Siap diputar';
          draw(); status();
          if (!wheel.length) return finish();
          if (auto) timers.push(setTimeout(spin, 700));
        }, auto ? 900 : 1400));
      };
      raf = requestAnimationFrame(frame);
    };

    $('[data-spin]').addEventListener('click', () => { auto = false; spin(); });
    $('[data-auto]').addEventListener('click', (e) => {
      auto = !auto;
      e.currentTarget.textContent = auto ? '⏸ Jeda otomatis' : '▶ Putar otomatis';
      if (auto) spin();
    });
    $('[data-sound]').addEventListener('click', (e) => {
      sound = !sound; e.currentTarget.textContent = sound ? '🔊' : '🔇';
      try { localStorage.setItem('wb-wheel-sound', sound ? '1' : '0'); } catch (err) { /* abaikan */ }
    });
    $('[data-full]').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => {});
    });
    $('[data-skip]').addEventListener('click', finish);
    // Keluar kapan saja: hasil undian sudah ditentukan sejak awal, jadi tetap disimpan.
    const close = () => {
      if (el.classList.contains('out')) return;
      if (!done) finish();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      el.classList.add('out');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { el.remove(); resolve(); }, 200);
    };
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) close(); };
    document.addEventListener('keydown', onKey);
    $('[data-close]').addEventListener('click', close);
    $('[data-exit]').addEventListener('click', close);
    const onResize = () => { W = size(); draw(); };
    window.addEventListener('resize', onResize);
    requestAnimationFrame(() => { W = size(); fillByes(); draw(); status(); });
    const obs = new MutationObserver(() => { if (!el.isConnected) { window.removeEventListener('resize', onResize); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
  });

  App.start = async () => {
    try {
      await App.load();
    } catch (e) {
      document.getElementById('app').innerHTML = `<div class="card"><h2>Gagal memuat data</h2><pre>${App.esc(e.stack || e)}</pre></div>`;
      return;
    }
    // Ambil data online dulu (maks. ±6 detik); kalau lambat/offline, tampilkan data perangkat lalu perbarui saat siap.
    const cloud = App.cloud.init().catch((e) => console.warn('Sinkron online gagal:', e));
    const ready = await Promise.race([cloud.then(() => true), new Promise((r) => setTimeout(() => r(false), 6000))]);
    App.render();
    if (!ready) cloud.then(() => App.rerender());
  };
})(window.App);
