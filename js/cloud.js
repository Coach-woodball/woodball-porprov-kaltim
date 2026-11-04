// Sinkron online lewat Supabase: data lengkap untuk admin (privat), salinan hasil untuk publik, dan file
// (logo publik; scan, pas foto, dokumen privat). Data di perangkat (IndexedDB) tetap jadi pegangan utama:
// aplikasi tetap jalan offline, perubahan ditandai "belum terkirim" lalu dikirim saat online lagi.
(function (App) {
  const CFG = App.CLOUD || {};
  const ROW = 'main';
  const BUCKETS = ['public-assets', 'private-files'];
  const C = (App.cloud = { enabled: false, admin: false, publicMode: false, status: 'off', detail: '' });
  let sb = null;
  let meta = { version: 0, dirty: false }; // versi server terakhir yang dimiliki perangkat ini
  let localRev = 0, pushedRev = 0, pushing = false, pushAgain = false, pushTimer = null;
  let pubChannel = null, adminChannel = null;

  const withTimeout = (p, ms = 10000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Koneksi lambat / terputus')), ms))]);
  const saveMeta = () => App.db.put('kv', 'cloudMeta', meta);
  const publicUrl = (id) => `${CFG.url}/storage/v1/object/public/public-assets/${encodeURIComponent(id)}`;
  const blobToDataUrl = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });

  // ---------- status (badge di topbar admin) ----------
  const LABEL = {
    ok: ['ok', '☁ Tersinkron'], saving: ['live', '☁ Menyimpan…'], offline: ['warn', '☁ Offline · tersimpan di perangkat'],
    error: ['warn', '☁ Gagal sinkron'], conflict: ['live', '☁ Data bentrok'], paused: ['warn', '☁ Sinkron dijeda (simulasi)'], off: ['', ''],
  };
  C.badge = () => {
    if (!C.admin) return '<span id="cloud-status" hidden></span>';
    const [cls, text] = LABEL[C.status] || LABEL.off;
    return `<span id="cloud-status" class="pill ${cls} cloud-pill" title="${App.esc(C.detail || text)}">${text}</span>`;
  };
  function setStatus(s, detail) {
    C.status = s;
    C.detail = detail || '';
    const el = document.getElementById('cloud-status');
    if (el) el.outerHTML = C.badge();
  }

  // ---------- salinan publik (tanpa NIK, tanggal lahir, foto, dokumen, kontak, scan, PIN) ----------
  const stripScans = (o) => JSON.parse(JSON.stringify(o || {}), (k, v) => (k === 'scans' ? (Array.isArray(v) ? [] : {}) : v));
  C.publicCopy = (S) => ({
    version: S.version,
    event: { ...S.event },
    menu: S.menu,
    kontingen: S.kontingen.map(({ id, name, short }) => ({ id, name, short })),
    athletes: S.athletes.map(({ id, name, gender, kontingenId, events }) => ({ id, name, gender, kontingenId, events })),
    events: S.events,
    entries: S.entries,
    stroke: stripScans(S.stroke),
    fairway: stripScans(S.fairway),
    logoUrls: Object.fromEntries((S.event.logos || []).map((id) => [id, publicUrl(id)])),
    // dipakai formulir pendaftaran online (tanpa kode akses)
    validation: S.validation,
    announcements: S.announcements,
    registration: App.reg.publicSettings(S.registration),
    publishedAt: new Date().toISOString(),
  });

  function applyPublic(ps) {
    const pin = App.S && App.S.admin ? App.S.admin.pinHash : null;
    App.S = App.migrate({ ...App.defaultState(), ...ps, admin: { pinHash: pin } });
    Object.entries(ps.logoUrls || {}).forEach(([id, url]) => App.files.cache.set(id, { id, name: 'logo', type: 'image/png', dataUrl: url }));
    C.publicMode = true;
  }

  C.loadPublic = async () => {
    try {
      const { data, error } = await withTimeout(sb.from('public_state').select('state').eq('id', ROW).maybeSingle(), 8000);
      if (error || !data) return;
      applyPublic(data.state);
      if (!pubChannel) {
        pubChannel = sb.channel('hasil-publik')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'public_state' }, (p) => {
            if (!C.publicMode || !p.new || !p.new.state) return;
            applyPublic(p.new.state);
            if (App.route().name !== 'display') App.rerender(); // layar proyektor mengambil data baru di slide berikutnya
          })
          .subscribe();
      }
    } catch (e) { /* offline: tetap pakai data di perangkat */ }
  };

  // ---------- data admin ----------
  async function reloadLocal() {
    const saved = await App.db.get('kv', 'state');
    App.S = saved ? App.migrate(saved) : App.defaultState();
    App.files.cache.clear();
    await App.files.loadAll();
  }

  async function fetchRemote() {
    const { data, error } = await withTimeout(sb.from('app_state').select('state, version').eq('id', ROW).maybeSingle());
    if (error) throw error;
    return data;
  }

  async function applyRemote(remote) {
    App.S = App.migrate(remote.state);
    await App.db.put('kv', 'state', App.S);
    meta = { version: remote.version, dirty: false };
    localRev = pushedRev = 0;
    await saveMeta();
  }

  const localHasData = () => App.S.athletes.length > 0 || Object.keys(App.S.stroke).length > 0 || Object.keys(App.S.fairway).length > 0;

  async function resolveConflict(remote) {
    setStatus('conflict', 'Data di server berbeda dengan data di perangkat ini');
    const useServer = await App.dialog({
      title: 'Data di server berbeda',
      text: 'Data di server sudah diubah dari perangkat lain, sedangkan perangkat ini juga punya perubahan yang belum terkirim.\n\n'
        + 'Pilih data mana yang dipakai. Data yang tidak dipilih akan hilang (buat Backup dulu kalau ragu).',
      ok: 'Pakai data server', cancel: 'Pakai data perangkat ini',
    });
    if (useServer) { await applyRemote(remote); App.rerender(); App.toast('Data server dipakai'); return; }
    if (!(await App.ask('Timpa data di server dengan data perangkat ini? Perubahan dari perangkat lain akan hilang.', 'Ya, timpa server'))) {
      setStatus('conflict', 'Belum dipilih. Muat ulang halaman untuk memilih lagi.');
      return;
    }
    meta.version = remote.version; // timpa versi server
    await push();
  }

  C.syncOnStart = async () => {
    if (App.sim) return setStatus('paused');
    try {
      const remote = await fetchRemote();
      if (!remote) {
        meta = { version: 0, dirty: true };
        await push(true); // server masih kosong: unggah data perangkat ini
      } else if ((meta.dirty || (meta.version === 0 && localHasData())) && remote.version !== meta.version) {
        await resolveConflict(remote);
      } else if (meta.dirty) {
        await push();
      } else if (remote.version !== meta.version) {
        await applyRemote(remote);
        setStatus('ok');
      } else setStatus('ok');
      subscribeAdmin();
      syncFiles();
      if (App.reg.pullOnline) App.reg.pullOnline(); // kiriman pendaftaran yang masuk selama admin tidak membuka aplikasi
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline', e.message);
    }
  };

  function subscribeAdmin() {
    if (adminChannel) return;
    adminChannel = sb.channel('data-admin')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state' }, async (p) => {
        const v = p.new && p.new.version;
        if (!v || v === meta.version || App.sim || meta.dirty || pushing) return; // perubahan sendiri / sedang ada perubahan lokal
        try {
          const remote = await fetchRemote();
          if (remote && remote.version !== meta.version && !meta.dirty) {
            await applyRemote(remote);
            App.rerender();
            App.toast('Data diperbarui dari perangkat lain');
            syncFiles();
          }
        } catch (e) { /* abaikan, dicoba lagi saat simpan berikutnya */ }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' }, () => {
        App.toast('📨 Ada kiriman pendaftaran baru');
        if (App.reg.pullOnline) App.reg.pullOnline();
      })
      .subscribe();
  }

  // Dipanggil App.save: tandai ada perubahan, kirim setelah jeda singkat.
  C.markDirty = () => {
    if (!C.admin) return;
    localRev++;
    if (!meta.dirty) { meta.dirty = true; saveMeta(); }
    if (App.sim) return setStatus('paused');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(), 1500);
  };

  async function push(initial) {
    if (!C.admin || App.sim) return;
    if (pushing) { pushAgain = true; return; }
    pushing = true;
    setStatus('saving');
    const rev = localRev;
    try {
      const state = JSON.parse(JSON.stringify(App.S));
      const next = meta.version + 1;
      const row = { state, version: next, updated_at: new Date().toISOString(), updated_by: C.user.id };
      let res;
      if (initial) res = await withTimeout(sb.from('app_state').insert({ id: ROW, ...row }).select('version'));
      else res = await withTimeout(sb.from('app_state').update(row).eq('id', ROW).eq('version', meta.version).select('version'));
      if (res.error && res.error.code !== '23505') throw res.error;
      if (res.error || !res.data || !res.data.length) {
        // versi server sudah berubah (diubah perangkat lain)
        pushing = false;
        const remote = await fetchRemote();
        if (remote) await resolveConflict(remote);
        else await push(true); // server masih kosong: kirim sebagai data awal
        return;
      }
      meta.version = next;
      pushedRev = rev;
      meta.dirty = localRev !== pushedRev;
      await saveMeta();
      const pub = await withTimeout(sb.from('public_state').upsert({ id: ROW, state: C.publicCopy(state), updated_at: row.updated_at }));
      if (pub.error) throw pub.error;
      setStatus(meta.dirty ? 'saving' : 'ok');
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline', e.message);
    } finally {
      pushing = false;
      if (pushAgain || (meta.dirty && C.status === 'saving')) { pushAgain = false; clearTimeout(pushTimer); pushTimer = setTimeout(() => push(), 800); }
    }
  }
  C.pushNow = () => push();

  // ---------- file ----------
  const bucketOf = (id) => ((App.S.event.logos || []).includes(id) ? 'public-assets' : 'private-files');
  let uploaded = null;
  async function uploadedSet() {
    if (!uploaded) uploaded = new Set((await App.db.get('kv', 'cloudFiles')) || []);
    return uploaded;
  }
  const saveUploaded = () => App.db.put('kv', 'cloudFiles', [...uploaded]);

  C.uploadFile = async (id) => {
    const f = App.files.get(id);
    if (!C.admin || App.sim || !f || !String(f.dataUrl).startsWith('data:')) return;
    const set = await uploadedSet();
    try {
      const blob = await (await fetch(f.dataUrl)).blob();
      const { error } = await withTimeout(sb.storage.from(bucketOf(id)).upload(id, blob, { upsert: true, contentType: f.type || blob.type }), 60000);
      if (!error) { set.add(id); saveUploaded(); }
    } catch (e) { /* dicoba lagi saat sinkron berikutnya */ }
  };

  async function syncFiles() {
    if (!C.admin || App.sim) return;
    const set = await uploadedSet();
    let changed = false;
    try {
      for (const id of [...App.files.cache.keys()]) if (!set.has(id)) await C.uploadFile(id);
      for (const bucket of BUCKETS) {
        const { data, error } = await withTimeout(sb.storage.from(bucket).list('', { limit: 1000 }));
        if (error) continue;
        for (const o of data || []) {
          if (!o.id) continue; // folder
          if (App.files.cache.has(o.name)) { set.add(o.name); continue; }
          const { data: blob } = await withTimeout(sb.storage.from(bucket).download(o.name), 60000);
          if (!blob) continue;
          const rec = { id: o.name, name: o.name, type: blob.type, dataUrl: await blobToDataUrl(blob), created: Date.now() };
          App.files.cache.set(o.name, rec);
          await App.db.put('files', o.name, rec);
          set.add(o.name);
          changed = true;
        }
      }
      saveUploaded();
      if (changed) App.rerender();
    } catch (e) { /* offline */ }
  }

  // Unggah / hapus file otomatis saat admin menambah atau menghapus logo, scan, foto, dokumen.
  const origAdd = App.files.add, origRemove = App.files.remove;
  App.files.add = async (...args) => {
    const id = await origAdd(...args);
    C.uploadFile(id);
    return id;
  };
  App.files.remove = async (id) => {
    const bucket = bucketOf(id);
    await origRemove(id);
    if (!C.admin || App.sim) return;
    try {
      await withTimeout(sb.storage.from(bucket).remove([id]));
      const set = await uploadedSet();
      set.delete(id);
      saveUploaded();
    } catch (e) { /* abaikan */ }
  };

  // ---------- login ----------
  C.login = async () => {
    const v = await App.dialog({
      title: 'Masuk Admin', text: 'Masuk dengan akun admin yang terdaftar.', ok: 'Masuk',
      fields: [{ label: 'Email', type: 'email' }, { label: 'Password', type: 'password' }],
    });
    if (!v) return;
    App.toast('Memeriksa akun…');
    let res;
    try { res = await withTimeout(sb.auth.signInWithPassword({ email: v[0].trim(), password: v[1] }), 15000); } catch (e) { res = { error: e }; }
    const { data, error } = res;
    if (error) {
      const net = !navigator.onLine || /fetch|network|koneksi|timeout/i.test(error.message || '') || error.status === 0;
      return App.notice(net ? 'Tidak bisa terhubung ke server. Periksa koneksi internet, lalu coba lagi.'
        : error.message === 'Invalid login credentials' ? 'Email atau password salah.' : error.message, 'Gagal masuk');
    }
    const { data: row } = await sb.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (!row) {
      await sb.auth.signOut();
      return App.toast('Akun ini belum terdaftar sebagai admin', 'err');
    }
    localStorage.setItem('wb-cloud-admin', data.user.id);
    sessionStorage.setItem('wb-admin', '1');
    C.admin = true;
    C.user = data.user;
    C.publicMode = false;
    if (pubChannel) { sb.removeChannel(pubChannel); pubChannel = null; }
    await reloadLocal();
    await C.syncOnStart();
    App.rerender();
    App.toast('Mode admin aktif · ' + data.user.email);
  };

  C.logout = async () => {
    if (meta.dirty && !(await App.ask('Masih ada perubahan yang belum terkirim ke server. Tetap keluar? (perubahan tetap tersimpan di perangkat ini)', 'Tetap keluar'))) return false;
    clearTimeout(pushTimer);
    if (adminChannel) { sb.removeChannel(adminChannel); adminChannel = null; }
    try { await sb.auth.signOut(); } catch (e) { /* offline */ }
    localStorage.removeItem('wb-cloud-admin');
    C.admin = false;
    C.user = null;
    await C.loadPublic();
    return true;
  };

  C.init = async () => {
    if (!CFG.url || !window.supabase) return; // tanpa konfigurasi atau library gagal dimuat: hanya di perangkat
    sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wb-auth' } });
    C.sb = sb;
    C.enabled = true;
    meta = (await App.db.get('kv', 'cloudMeta')) || { version: 0, dirty: false };
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    if (s && localStorage.getItem('wb-cloud-admin') === s.user.id) {
      C.admin = true;
      C.user = s.user;
      sessionStorage.setItem('wb-admin', '1');
      await C.syncOnStart();
    } else {
      if (navigator.onLine) sessionStorage.removeItem('wb-admin'); // admin wajib masuk dengan akun saat online
      await C.loadPublic();
    }
    window.addEventListener('online', () => { if (C.admin) { if (meta.dirty) push(); else C.syncOnStart(); } });
    window.addEventListener('offline', () => { if (C.admin) setStatus('offline'); });
  };
})(window.App);
