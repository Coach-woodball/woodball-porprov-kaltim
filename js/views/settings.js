// Halaman Pengaturan (identitas event, logo, penandatangan, sertifikat, menu, validasi, PIN) dan Backup.
(function (App) {
  const esc = App.esc;

  const field = (path, label, val, type = 'text') => `<label>${label}<input type="${type}" data-set="${path}" value="${esc(val ?? '')}"></label>`;

  App.views.settings = {
    admin: true,
    render() {
      const E = App.S.event, V = App.S.validation;
      return `<h2>${esc(App.S.menu.settings)}</h2>
      <div class="card"><h3>Identitas Event</h3><div class="grid3">
        ${field('event.title', 'Judul event (kop dokumen)', E.title)}
        ${field('event.shortName', 'Nama singkat', E.shortName)}
        ${field('event.sport', 'Cabang olahraga', E.sport)}
        ${field('event.region', 'Wilayah', E.region)}
        ${field('event.organizer', 'Penyelenggara', E.organizer)}
        ${field('event.dateStart', 'Tanggal mulai', E.dateStart, 'date')}
        ${field('event.dateEnd', 'Tanggal selesai', E.dateEnd, 'date')}
        ${field('event.venue', 'Tempat / venue', E.venue)}
        ${field('event.city', 'Kota (untuk tanda tangan)', E.city)}
        ${field('event.lanes', 'Daftar lapangan (pisah koma)', E.lanes)}
        ${field('event.themeColor', 'Warna utama (hijau)', E.themeColor, 'color')}
        ${field('event.accentColor', 'Warna aksen (merah)', E.accentColor, 'color')}
      </div></div>

      <div class="card"><h3>Logo</h3><p class="muted">Logo tampil di kop aplikasi, score card, hasil resmi, dan sertifikat (urutan kiri → kanan).</p>
        <div class="logos">${(E.logos || []).map((id, i) => `<div class="logo-item"><img src="${App.files.url(id)}" alt="">
          <div class="row gap"><button class="btn sm ghost" data-logo-left="${i}">◀</button><button class="btn sm ghost" data-logo-right="${i}">▶</button><button class="btn sm danger" data-logo-del="${i}">Hapus</button></div></div>`).join('') || App.ui.empty('Belum ada logo.')}</div>
        <label class="btn upload">+ Upload logo (PNG/JPG)<input type="file" accept="image/*" multiple id="logo-add" hidden></label>
      </div>

      <div class="card"><h3>Penandatangan</h3>
        <h4>Hasil resmi & score card</h4><div class="grid3">${field('event.resultSigner.title', 'Jabatan', E.resultSigner.title)}${field('event.resultSigner.name', 'Nama', E.resultSigner.name)}</div>
        <h4>Sertifikat</h4>${E.signers.map((s, i) => `<div class="grid3">${field(`event.signers.${i}.title`, 'Jabatan', s.title)}${field(`event.signers.${i}.name`, 'Nama', s.name)}<div><button class="btn sm danger" data-signer-del="${i}">Hapus</button></div></div>`).join('')}
        <button class="btn sm ghost" id="signer-add">+ Tambah penandatangan</button>
      </div>

      <div class="card"><h3>Teks Sertifikat</h3>
        <p class="muted small">Kode yang bisa dipakai: <code>{nama}</code> <code>{kontingen}</code> <code>{nomor}</code> <code>{juara}</code> (I/II/III) <code>{medali}</code> <code>{event}</code> <code>{tanggal}</code> <code>{kota}</code></p>
        <div class="grid3">${field('event.certTitle', 'Judul', E.certTitle)}${field('event.certIntro', 'Kalimat pembuka', E.certIntro)}</div>
        <label>Isi (juara)<textarea data-set="event.certBody" rows="3">${esc(E.certBody)}</textarea></label>
        <label>Isi (peserta)<textarea data-set="event.certPartBody" rows="3">${esc(E.certPartBody)}</textarea></label>
      </div>

      <div class="card"><h3>Label Menu</h3><div class="grid4">${Object.entries(App.S.menu).map(([k, v]) => field('menu.' + k, k, v)).join('')}</div></div>

      <div class="card"><h3>Validasi Peserta (peringatan)</h3><p class="muted">Default sesuai THB; bisa disesuaikan setelah Technical Meeting.</p>
        <label class="chk"><input type="checkbox" data-setb="validation.enabled" ${V.enabled ? 'checked' : ''}> Aktifkan validasi</label>
        <label class="chk"><input type="checkbox" data-setb="validation.separateDisciplines" ${V.separateDisciplines ? 'checked' : ''}> Atlet Stroke tidak boleh bermain di Fairway</label>
        <label class="chk"><input type="checkbox" data-setb="validation.teamStrokeIncluded" ${V.teamStrokeIncluded ? 'checked' : ''}> Single Stroke + Team Stroke dihitung 1 nomor</label>
        <label class="chk"><input type="checkbox" data-setb="validation.perKontingen" ${V.perKontingen ? 'checked' : ''}> Cek batas entri per kontingen (diatur per nomor)</label>
        <div class="grid3">${field('validation.maxEventsPerAthlete', 'Maks. nomor per atlet', V.maxEventsPerAthlete, 'number')}${field('validation.minBirthDate', 'Lahir paling awal (batas usia)', V.minBirthDate, 'date')}</div>
      </div>

      <div class="card"><h3>PIN Admin</h3><button class="btn ghost" id="pin-change">Ganti PIN</button></div>`;
    },
    mount(root) {
      const setPath = (path, val) => {
        const keys = path.split('.');
        let o = App.S;
        keys.slice(0, -1).forEach((k) => (o = o[k]));
        o[keys[keys.length - 1]] = val;
      };
      root.querySelectorAll('[data-set]').forEach((inp) => inp.addEventListener('change', () => {
        setPath(inp.dataset.set, inp.type === 'number' ? App.num(inp.value) : inp.value);
        App.commit('Tersimpan');
      }));
      root.querySelectorAll('[data-setb]').forEach((inp) => inp.addEventListener('change', () => { setPath(inp.dataset.setb, inp.checked); App.commit('Tersimpan'); }));
      const logos = App.S.event.logos;
      root.querySelector('#logo-add').addEventListener('change', async (e) => {
        for (const file of e.target.files) {
          const url = await App.compressImage(await App.readFile(file), 800, 0.92, true);
          logos.push(await App.files.add(file.name, url.slice(5, url.indexOf(';')), url));
        }
        App.commit('Logo ditambahkan');
      });
      const swap = (i, j) => { if (j >= 0 && j < logos.length) { [logos[i], logos[j]] = [logos[j], logos[i]]; App.commit(); } };
      root.querySelectorAll('[data-logo-left]').forEach((b) => b.addEventListener('click', () => swap(+b.dataset.logoLeft, +b.dataset.logoLeft - 1)));
      root.querySelectorAll('[data-logo-right]').forEach((b) => b.addEventListener('click', () => swap(+b.dataset.logoRight, +b.dataset.logoRight + 1)));
      root.querySelectorAll('[data-logo-del]').forEach((b) => b.addEventListener('click', async () => {
        const [id] = logos.splice(+b.dataset.logoDel, 1);
        await App.files.remove(id);
        App.commit('Logo dihapus');
      }));
      root.querySelector('#signer-add').addEventListener('click', () => { App.S.event.signers.push({ title: '', name: '' }); App.commit(); });
      root.querySelectorAll('[data-signer-del]').forEach((b) => b.addEventListener('click', () => { App.S.event.signers.splice(+b.dataset.signerDel, 1); App.commit(); }));
      root.querySelector('#pin-change').addEventListener('click', async () => {
        const h = await App.newPin('Ganti PIN admin');
        if (!h) return;
        App.S.admin.pinHash = h;
        App.commit('PIN diganti');
      });
    },
  };

  // ---------- Backup ----------
  App.views.backup = {
    admin: true,
    render() {
      const nFiles = App.files.cache.size;
      const size = Array.from(App.files.cache.values()).reduce((s, f) => s + (f.dataUrl || '').length, 0) + JSON.stringify(App.S).length;
      return `<h2>${esc(App.S.menu.backup)}</h2>
        <div class="card"><h3>Simpan cadangan</h3>
          <p>Semua data tersimpan di browser laptop ini. <b>Lakukan backup rutin</b> (mis. tiap akhir sesi pertandingan) ke flashdisk / Google Drive.</p>
          <p class="muted">Ukuran data ± ${(size / 1048576).toFixed(1)} MB · ${nFiles} file (logo & scan).</p>
          <div class="row gap wrap"><button class="btn" id="bk-full">💾 Backup lengkap (dengan scan & logo)</button><button class="btn ghost" id="bk-data">Backup data saja (tanpa scan)</button></div>
        </div>
        <div class="card"><h3>Pulihkan dari backup</h3>
          <p class="muted">Data saat ini akan <b>diganti</b> dengan isi file backup. Dipakai juga untuk memindahkan data ke laptop / perangkat lain.</p>
          <label class="btn ghost upload">📂 Pilih file backup (.json)<input type="file" accept=".json,application/json" id="bk-restore" hidden></label>
        </div>
        <div class="card"><h3>Data contoh</h3><p class="muted">Isi atlet & entri contoh untuk mencoba aplikasi. Hanya bisa jika belum ada atlet.</p>
          <button class="btn ghost" id="bk-demo" ${App.S.athletes.length ? 'disabled' : ''}>Isi data contoh</button></div>
        <div class="card warn"><h3>Reset</h3><p>Menghapus seluruh data (atlet, skor, logo, scan) dan kembali ke pengaturan awal PORPROV.</p>
          <button class="btn danger" id="bk-reset">Hapus semua data</button></div>`;
    },
    mount(root) {
      const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      root.querySelector('#bk-full').addEventListener('click', () => {
        const files = Object.fromEntries(App.files.cache);
        App.download(`backup-woodball-${stamp()}.json`, JSON.stringify({ app: 'woodball', version: 1, state: App.S, files }));
      });
      root.querySelector('#bk-data').addEventListener('click', () => {
        const files = Object.fromEntries((App.S.event.logos || []).map((id) => [id, App.files.get(id)]).filter(([, f]) => f));
        App.download(`backup-woodball-data-${stamp()}.json`, JSON.stringify({ app: 'woodball', version: 1, state: App.S, files }));
      });
      root.querySelector('#bk-restore').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const obj = JSON.parse(await App.readFile(file, 'text'));
          if (obj.app !== 'woodball' || !obj.state) throw new Error('Bukan file backup aplikasi ini');
          if (!confirm('Ganti semua data saat ini dengan isi backup?')) return;
          await App.db.clear('files');
          App.files.cache.clear();
          for (const [id, f] of Object.entries(obj.files || {})) { App.files.cache.set(id, f); await App.db.put('files', id, f); }
          App.S = App.migrate(obj.state);
          await App.save(true);
          App.toast('Backup dipulihkan');
          App.go('dashboard');
          App.rerender();
        } catch (err) {
          App.toast('Gagal: ' + err.message, 'err');
        }
      });
      root.querySelector('#bk-demo').addEventListener('click', () => { App.demoData(); App.commit('Data contoh dibuat'); });
      root.querySelector('#bk-reset').addEventListener('click', async () => {
        const v = await App.dialog({ title: 'Hapus semua data', text: 'Ketik HAPUS untuk menghapus semua data.', fields: [{ label: 'Konfirmasi' }], ok: 'Hapus' });
        if (!v || v[0].trim().toUpperCase() !== 'HAPUS') return;
        const pin = App.S.admin.pinHash;
        await App.db.clear('files');
        App.files.cache.clear();
        App.S = App.defaultState();
        App.S.admin.pinHash = pin;
        await App.save(true);
        App.toast('Data direset');
        App.go('dashboard');
      });
    },
  };

  // Data contoh: 8 kontingen, tiap kontingen putra & putri.
  App.demoData = () => {
    const S = App.S;
    const NAMA_L = ['Rahmat', 'Hikmal', 'Alfian', 'Rosid', 'Aidil', 'Fajar', 'Yadi', 'Imran', 'Indaka', 'Zidane', 'Bobby', 'Zaki', 'Reagan', 'Fahri', 'Riski', 'Akmal', 'Agus', 'Rio', 'Henri', 'Nelzhen'];
    const NAMA_P = ['Jumarni', 'Jihan', 'Alia', 'Hasniar', 'Rita', 'Husnul', 'Desi', 'Hikma', 'Andina', 'Hafifa', 'Vassya', 'Ivana', 'Denis', 'Raehana', 'Pinkan', 'Juniarti', 'Ajeng', 'Safa', 'Liya', 'Aulia'];
    const ks = S.kontingen.slice(0, 8);
    let n = 0;
    const add = (name, gender, k, events) => { const a = { id: App.uid('a_'), name, gender, kontingenId: k.id, birth: '2004-0' + (1 + (n++ % 9)) + '-15', events }; S.athletes.push(a); return a; };
    ks.forEach((k, ki) => {
      [['L', 'PA', NAMA_L], ['P', 'PI', NAMA_P]].forEach(([g, sfx, names]) => {
        const nm = (i) => `${names[(ki * 3 + i) % names.length]} ${k.short}${i + 1}`;
        for (let i = 0; i < 4; i++) add(nm(i), g, k, [`SS-${sfx}`, `TS-${sfx}`]);
        add(nm(4), g, k, [`DS-${sfx}`]); add(nm(5), g, k, [`DS-${sfx}`]);
        add(nm(6), g, k, [`SF-${sfx}`, `TF-${sfx}`]); add(nm(7), g, k, [`TF-${sfx}`]);
        add(nm(8), g, k, [`DF-${sfx}`, `TF-${sfx}`]); add(nm(9), g, k, [`DF-${sfx}`, `TF-${sfx}`]);
        add(nm(10), g, k, [g === 'L' ? 'MS-X' : 'MS-X']);
        add(nm(11), g, k, ['MF-X']);
      });
    });
    S.events.forEach((ev) => App.autoEntries(ev));
  };
})(window.App);
