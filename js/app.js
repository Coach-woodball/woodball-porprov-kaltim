// Kerangka UI: router berbasis hash, layout, mode admin.
(function (App) {
  App.views = {};
  App.isAdmin = () => sessionStorage.getItem('wb-admin') === '1';

  const ICON = {
    dashboard: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    kontingen: '<path d="M5 21V4m0 0h12l-2.5 4.5L17 13H5"/>',
    athletes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
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
    ['dashboard', false], ['kontingen', true], ['athletes', true], ['registration', true], ['events', true], ['stroke', true], ['fairway', true],
    ['results', false], ['print', false], ['display', false], ['settings', true], ['backup', true],
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
    const nav = NAV.filter(([, adm]) => admin || !adm).map(([key]) =>
      `<a href="#/${key}" class="${routeName === key ? 'active' : ''}">${App.icon(key)}<span>${App.esc(App.S.menu[key] || key)}</span></a>`).join('');
    const th = App.theme();
    return `
      <header class="topbar glass no-print">
        <button class="hamb" data-act="toggle-nav" aria-label="Menu"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
        <div class="brand">${App.logoImgs('logo-sm')}<div><b>${App.esc(E.sport)} <span class="dot">•</span> ${App.esc(E.shortName)}</b><small>${App.esc(App.fmtDateRange(E.dateStart, E.dateEnd))} · ${App.esc(E.city)}</small></div></div>
        <div class="spacer"></div>
        <button class="icon-btn" data-act="theme" title="${THEME_LABEL[th]}" aria-label="${THEME_LABEL[th]}">${App.icon(th)}</button>
        ${admin ? '<span class="badge admin">ADMIN</span><button class="btn sm ghost" data-act="logout">Keluar</button>'
          : '<button class="btn sm" data-act="login">Masuk Admin</button>'}
      </header>
      <nav class="sidebar glass no-print" id="sidebar">${nav}</nav>
      <div class="scrim no-print" data-act="toggle-nav"></div>
      <main class="main" id="main">${inner}</main>`;
  }

  App.render = () => {
    const { name, params } = App.route();
    const view = App.views[name] || App.views.dashboard;
    const root = document.getElementById('app');
    document.documentElement.style.setProperty('--brand', App.S.event.themeColor || '#16a34a');
    document.documentElement.style.setProperty('--accent', App.S.event.accentColor || '#dc2626');
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

  // Dialog isian di dalam halaman (pengganti prompt(), yang diblokir di sebagian browser/webview).
  // fields: [{label, type}] -> Promise<string[] | null> (null = dibatalkan).
  App.dialog = ({ title, text, fields, ok = 'OK' }) => new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'dlg-overlay';
    el.innerHTML = `<form class="dlg glass" autocomplete="off"><h3>${App.esc(title)}</h3>${text ? `<p class="muted">${App.esc(text)}</p>` : ''}
      ${fields.map((f, i) => `<label>${App.esc(f.label)}<input name="f${i}" type="${f.type || 'text'}" ${f.type === 'password' ? 'inputmode="numeric"' : ''}></label>`).join('')}
      <div class="row gap dlg-foot"><button type="button" class="btn ghost" data-cancel>Batal</button><button class="btn">${App.esc(ok)}</button></div></form>`;
    document.body.appendChild(el);
    const form = el.querySelector('form');
    const close = (val) => { el.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    form.addEventListener('submit', (e) => { e.preventDefault(); close(fields.map((_, i) => form[`f${i}`].value)); });
    el.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    el.addEventListener('mousedown', (e) => { if (e.target === el) close(null); });
    setTimeout(() => form.f0.focus(), 30);
  });

  // Buat PIN baru (dua kali ketik). Mengembalikan hash PIN atau null.
  App.newPin = async (title) => {
    const v = await App.dialog({ title, text: 'Minimal 4 karakter. Simpan PIN ini baik-baik.', ok: 'Simpan PIN',
      fields: [{ label: 'PIN baru', type: 'password' }, { label: 'Ulangi PIN', type: 'password' }] });
    if (!v) return null;
    if (v[0].length < 4) { App.toast('PIN minimal 4 karakter', 'err'); return null; }
    if (v[0] !== v[1]) { App.toast('PIN tidak sama', 'err'); return null; }
    return App.hash(v[0]);
  };

  App.login = async () => {
    const A = App.S.admin;
    if (!A.pinHash) {
      const h = await App.newPin('Belum ada PIN admin, buat PIN baru');
      if (!h) return;
      A.pinHash = h;
      App.save(true);
    } else {
      const v = await App.dialog({ title: 'Masuk Admin', fields: [{ label: 'PIN admin', type: 'password' }], ok: 'Masuk' });
      if (!v) return;
      if (App.hash(v[0]) !== A.pinHash) return App.toast('PIN salah', 'err');
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
    else if (act === 'logout') { sessionStorage.removeItem('wb-admin'); App.toast('Keluar dari mode admin'); App.go('dashboard'); App.rerender(); }
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
      if (!confirm('Hapus scan ini?')) return;
      const list = getList(b.dataset.scanKey);
      const i = list.indexOf(b.dataset.scanDel);
      if (i >= 0) list.splice(i, 1);
      await App.files.remove(b.dataset.scanDel);
      App.commit('Scan dihapus');
    }));
  };

  // Animasi undian: nama berputar acak di setiap slot, lalu terkunci satu per satu ke hasil akhir.
  // boxes: [{label, items:[nama]}]. Hasil sudah ditentukan sebelumnya; animasi hanya tampilan.
  App.drawAnimation = ({ title, sub, boxes }) => new Promise((resolve) => {
    const esc = App.esc;
    const pool = boxes.flatMap((b) => b.items).filter((x) => x && x !== 'BYE');
    if (!pool.length) return resolve();
    const el = document.createElement('div');
    el.className = 'draw-overlay';
    el.innerHTML = `<div class="draw-panel glass">
      <div class="draw-head"><div><div class="draw-title">🎲 ${esc(title)}</div>${sub ? `<div class="muted">${esc(sub)}</div>` : ''}</div>
        <div class="draw-status pill live">Mengacak…</div></div>
      <div class="draw-grid">${boxes.map((b, bi) => `<div class="draw-box" style="--i:${bi}"><div class="draw-label">${esc(b.label)}</div>
        ${b.items.map(() => '<div class="draw-slot"><span>?</span></div>').join('')}</div>`).join('')}</div>
      <div class="row gap draw-foot"><button class="btn ghost" data-skip>Lewati animasi</button><button class="btn hidden" data-close>Selesai</button></div></div>`;
    document.body.appendChild(el);
    const slots = Array.from(el.querySelectorAll('.draw-slot'));
    const finals = boxes.flatMap((b) => b.items);
    const locked = new Set();
    const rnd = () => pool[Math.floor(Math.random() * pool.length)];
    const spin = setInterval(() => slots.forEach((s, i) => { if (!locked.has(i)) s.firstChild.textContent = rnd(); }), 70);
    const timers = [];
    const lock = (i) => {
      if (locked.has(i)) return;
      locked.add(i);
      const s = slots[i];
      s.firstChild.textContent = finals[i] || '-';
      s.classList.add('locked');
      if (finals[i] === 'BYE') s.classList.add('bye');
      s.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const finish = () => {
      timers.forEach(clearTimeout);
      clearInterval(spin);
      slots.forEach((_, i) => lock(i));
      el.querySelector('.draw-status').textContent = 'Selesai';
      el.querySelector('.draw-status').className = 'draw-status pill ok';
      el.querySelector('[data-skip]').classList.add('hidden');
      el.querySelector('[data-close]').classList.remove('hidden');
    };
    // ±1,2 detik berputar, lalu kunci berurutan (total ±4 detik, berapa pun jumlah slot)
    const step = Math.max(45, Math.min(320, 3200 / slots.length));
    slots.forEach((_, i) => timers.push(setTimeout(() => lock(i), 1200 + i * step)));
    timers.push(setTimeout(finish, 1300 + slots.length * step));
    el.querySelector('[data-skip]').addEventListener('click', finish);
    el.querySelector('[data-close]').addEventListener('click', () => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 200);
    });
  });

  App.start = async () => {
    try {
      await App.load();
    } catch (e) {
      document.getElementById('app').innerHTML = `<div class="card"><h2>Gagal memuat data</h2><pre>${App.esc(e.stack || e)}</pre></div>`;
      return;
    }
    App.render();
  };
})(window.App);
