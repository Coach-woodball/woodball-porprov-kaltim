// Menu Pendaftaran (admin): pengaturan formulir official, link formulir, impor berkas kiriman, dan penerimaan atlet.
(function (App) {
  const esc = App.esc, R = App.reg;

  const formUrl = () => location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '') + 'daftar.html';

  // Atlet yang sudah ada di kontingen yang sama: nama sama.
  function findExisting(sub, r) {
    if (r.athleteId && App.athlete(r.athleteId)) return App.athlete(r.athleteId);
    return App.S.athletes.find((a) => a.kontingenId === sub.kontingenId && a.name.toLowerCase() === r.name.toLowerCase());
  }

  async function importFile(file) {
    const obj = JSON.parse(await App.readFile(file, 'text'));
    if (obj.app !== R.FILE_APP) throw new Error(`${file.name} bukan berkas pendaftaran`);
    if (App.S.registrations.some((s) => s.fileName === file.name && s.created === obj.created)) return { skipped: true };
    return importObj(obj, file.name);
  }

  // forceKontingenId: kiriman online sudah membawa kontingen yang diverifikasi saat official mengirim.
  function importObj(obj, fileName, forceKontingenId, source) {
    const ok = obj.kontingen || {};
    const k = forceKontingenId ? App.kontingen(forceKontingenId) : App.S.kontingen.find((x) => x.name === ok.name) || App.kontingen(ok.id);
    const evId = (e) => (App.event(e.id) || App.S.events.find((x) => x.code === e.code) || {}).id;
    const athletes = (obj.athletes || []).map((a) => {
      const events = (a.events || []).map(evId).filter(Boolean);
      return {
        name: (a.name || '').trim(), gender: R.genderOf(App.S, events) || (a.gender === 'L' || a.gender === 'P' ? a.gender : null),
        events, status: 'pending', athleteId: null,
      };
    });
    App.S.registrations.unshift({
      id: App.uid('r_'), fileName, created: obj.created || '', received: new Date().toISOString(), source: source || 'berkas',
      kontingenId: k ? k.id : '', kontingenName: (k && k.name) || ok.name || '', athletes,
    });
    return { n: athletes.length };
  }

  // ---------- kiriman online (Supabase) ----------
  let pulling = false, lastPull = 0;
  // Ambil kiriman yang belum diimpor: tandai dulu di server (supaya tidak diambil dua kali oleh perangkat admin lain),
  // lalu masukkan ke daftar kiriman seperti berkas biasa.
  // throttle: saat halaman dirender ulang, cek paling sering tiap 15 detik (notifikasi realtime tetap langsung).
  R.pullOnline = async (throttle) => {
    const sb = App.cloud.sb;
    if (!App.cloud.admin || !sb || App.sim || pulling) return 0;
    if (throttle && Date.now() - lastPull < 15000) return 0;
    lastPull = Date.now();
    pulling = true;
    let n = 0;
    try {
      const { data, error } = await sb.from('registrations').select('id, kontingen_id, payload, created_at').is('imported_at', null).order('created_at');
      if (error) throw error;
      for (const row of data || []) {
        const { data: claimed } = await sb.from('registrations').update({ imported_at: new Date().toISOString() }).eq('id', row.id).is('imported_at', null).select('id');
        if (!claimed || !claimed.length) continue;
        try {
          const when = new Date(row.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
          importObj(row.payload, `Kiriman online ${when}`, row.kontingen_id, 'online');
          n++;
        } catch (e) {
          await sb.from('registrations').update({ imported_at: null }).eq('id', row.id); // coba lagi nanti
          console.warn('Gagal mengambil kiriman', row.id, e);
        }
      }
    } catch (e) {
      console.warn('Gagal memeriksa kiriman online', e);
    } finally {
      pulling = false;
    }
    if (n) App.commit(`📨 ${n} kiriman pendaftaran online masuk`);
    return n;
  };

  function accept(sub, r) {
    const ex = findExisting(sub, r);
    const data = { name: r.name, gender: r.gender, kontingenId: sub.kontingenId, events: r.events.slice() };
    if (ex) { Object.assign(ex, data); r.athleteId = ex.id; }
    else { r.athleteId = App.uid('a_'); App.S.athletes.push({ id: r.athleteId, ...data }); }
    r.status = 'accepted';
  }

  async function removeSub(sub) {
    const used = new Set(App.S.athletes.flatMap((a) => [a.photo, ...(a.docs || [])]).filter(Boolean));
    App.S.registrations = App.S.registrations.filter((s) => s.id !== sub.id);
    const others = new Set(App.S.registrations.flatMap((s) => s.athletes.flatMap((r) => [r.photo, ...(r.docs || [])])).filter(Boolean));
    for (const r of sub.athletes) {
      for (const id of [r.photo, ...(r.docs || [])]) if (id && !used.has(id) && !others.has(id)) await App.files.remove(id);
    }
  }

  function inviteText() {
    const E = App.S.event, reg = App.S.registration;
    return `Yth. Official Kontingen Woodball ${E.shortName}

Pendaftaran atlet dilakukan lewat formulir berikut:
${formUrl()}

1. Pilih Kabupaten/Kota, lalu ketik ulang namanya dengan HURUF KAPITAL.
2. Tambahkan atlet: nama dan nomor tanding.
3. Klik "Kirim ke panitia".
${reg.deadline ? `\nBatas pendaftaran: ${App.fmtDate(reg.deadline)}` : ''}${reg.contactName || reg.contactPhone ? `\nKontak panitia: ${[reg.contactName, reg.contactPhone].filter(Boolean).join(' - ')}` : ''}`;
  }

  function settingsCard() {
    const reg = App.S.registration;
    const f = (key, label, type = 'text', extra = '') => `<label>${label}<input type="${type}" data-reg="${key}" value="${esc(reg[key] ?? '')}" ${extra}></label>`;
    const b = (key, label) => `<label class="chk"><input type="checkbox" data-regb="${key}" ${reg[key] ? 'checked' : ''}> ${label}</label>`;
    return `<div class="card"><h3>Formulir untuk official</h3>
      <p class="muted">Official kontingen membuka menu <b>Pendaftaran</b> di halaman umum, memilih kabupaten/kota, lalu mengisi nama atlet dan nomor tanding.</p>
      ${b('open', 'Formulir dibuka')}
      <div class="grid3">
        ${f('deadline', 'Batas pendaftaran', 'date')}
        ${f('contactName', 'Nama kontak panitia')}
        ${f('contactPhone', 'No. WhatsApp panitia', 'tel')}
      </div>
      <label>Catatan untuk official (tampil di atas formulir)<textarea data-reg="note" rows="2" style="font-family:inherit">${esc(reg.note)}</textarea></label>
      <h4>Link formulir</h4>
      <div class="row gap wrap"><code class="reg-url">${esc(formUrl())}</code>
        <button class="btn sm ghost" data-copy="url">Salin link</button>
        <a class="btn sm" href="daftar.html?lokal" target="_blank" rel="noopener">Buka formulir</a></div>
      <p class="muted small">${App.cloud.enabled ? 'Formulir mengambil logo, kontingen, nomor, dan pengaturan di atas langsung dari server, jadi selalu terbaru setelah data tersinkron. Nama kabupaten bisa diketik siapa saja, jadi tetap periksa setiap kiriman sebelum diterima.'
        : 'Agar formulir online memakai logo dan pengaturan terbaru, klik <b>Unduh pengaturan formulir</b>, simpan sebagai <code>pendaftaran.json</code> di folder aplikasi (sejajar <code>index.html</code>), lalu publish ulang.'}</p>
      <div class="row gap wrap">${App.cloud.enabled ? '' : '<button class="btn sm ghost" id="reg-config">⬇️ Unduh pengaturan formulir (pendaftaran.json)</button>'}
        <button class="btn sm ghost" data-copy="invite">Salin pesan undangan WhatsApp</button></div>
    </div>`;
  }

  function trackerCard() {
    const latest = {};
    App.S.registrations.forEach((s) => { if (s.kontingenId && !latest[s.kontingenId]) latest[s.kontingenId] = s; });
    return `<div class="card"><h3>Kiriman per kontingen</h3><div class="reg-track">${App.S.kontingen.map((k) => {
      const s = latest[k.id];
      const nA = App.S.athletes.filter((a) => a.kontingenId === k.id).length;
      return `<div class="${s ? 'ok' : ''}"><b>${esc(k.short || k.name)}</b><small>${s ? `Kirim ${esc(App.fmtDate(s.received.slice(0, 10)))} · ${nA} atlet` : 'Belum kirim'}</small></div>`;
    }).join('')}</div></div>`;
  }

  function subCard(sub) {
    const k = App.kontingen(sub.kontingenId);
    const pending = sub.athletes.filter((r) => r.status === 'pending').length;
    const ready = sub.athletes.filter((r) => r.status === 'pending' && r.gender).length;
    const accepted = sub.athletes.filter((r) => r.status === 'accepted').length;
    const rows = sub.athletes.map((r, i) => {
      const chk = R.check(App.S, r);
      const ex = r.status === 'pending' && sub.kontingenId ? findExisting(sub, r) : null;
      const st = r.status === 'accepted' ? '<span class="pill ok">Diterima</span>'
        : r.status === 'rejected' ? '<span class="pill">Ditolak</span>'
          : ex ? '<span class="pill warn">Sudah ada · diperbarui</span>' : '<span class="pill live">Baru</span>';
      const notes = [...(chk.missing.length ? ['Belum ada: ' + chk.missing.join(', ')] : []), ...chk.warns];
      return `<tr class="${r.status === 'rejected' ? 'dim' : ''}"><td class="c">${i + 1}</td>
        <td><b>${esc(r.name)}</b></td>
        <td class="c">${r.gender || `<select data-gender="${sub.id}:${i}">${App.ui.options([['', '-'], ['L', 'L'], ['P', 'P']], '')}</select>`}</td>
        <td>${r.events.map(App.event).filter(Boolean).map((ev) => `<span class="code" title="${esc(ev.name)}">${esc(ev.code)}</span>`).join(' ')}</td>
        <td class="small">${notes.length ? `<span class="reg-warn">⚠️ ${esc(notes.join(' · '))}</span>` : '<span class="muted">-</span>'}</td>
        <td>${st}</td>
        <td class="nowrap">${r.status !== 'accepted' ? `<button class="btn sm" data-acc="${sub.id}:${i}" ${sub.kontingenId && r.gender ? '' : 'disabled'}>Terima</button>` : ''}
          ${r.status === 'pending' ? `<button class="btn sm ghost" data-rej="${sub.id}:${i}">Tolak</button>` : ''}</td></tr>`;
    }).join('');
    return `<details class="card reg-sub" ${pending ? 'open' : ''}>
      <summary><b>${esc(k ? k.name : sub.kontingenName || 'Kontingen tidak dikenal')}</b>
        <span class="muted small">· ${sub.athletes.length} atlet · diterima ${accepted}${pending ? ` · <b>${pending} menunggu</b>` : ''} · masuk ${esc(new Date(sub.received).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}</span></summary>
      <p class="muted small">${sub.source === 'online' ? '<span class="pill ok">📨 online</span> ' : ''}Berkas: ${esc(sub.fileName)}${sub.created ? ` · dibuat ${esc(new Date(sub.created).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}` : ''}</p>
      ${k ? '' : `<label class="reg-kpick">Kontingen tidak cocok dengan daftar. Pilih kontingen:<select data-sub-k="${sub.id}">${App.ui.kontingenOptions('')}</select></label>`}
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Nama</th><th>L/P</th><th>Nomor</th><th>Catatan</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row gap wrap">${ready && k ? `<button class="btn" data-acc-all="${sub.id}">✔ Terima semua (${ready})</button>` : ''}
        <button class="btn sm danger" data-sub-del="${sub.id}">Hapus kiriman</button></div>
    </details>`;
  }

  App.views.registration = {
    admin: true,
    render() {
      const subs = App.S.registrations;
      return `<h2>${esc(App.S.menu.registration || 'Pendaftaran')}</h2>
        ${settingsCard()}
        <div class="card"><h3>Impor berkas pendaftaran</h3>
          <p class="muted">Pilih satu atau beberapa berkas <code>Pendaftaran-Woodball-….json</code> dari official. Atlet baru masuk ke menu ${esc(App.S.menu.athletes)} setelah diklik <b>Terima</b>.
            Kiriman ulang dari kontingen yang sama memperbarui atlet dengan nama yang sama.</p>
          <div class="row gap wrap"><label class="btn upload">📥 Pilih berkas pendaftaran<input type="file" accept=".json,application/json" multiple id="reg-import" hidden></label>
            ${App.cloud.admin ? '<button class="btn ghost" id="reg-pull">🔄 Cek kiriman online</button>' : ''}</div>
        </div>
        ${trackerCard()}
        ${subs.map(subCard).join('') || `<div class="card">${App.ui.empty('Belum ada berkas pendaftaran yang diimpor.')}</div>`}`;
    },
    mount(root) {
      const reg = App.S.registration;
      root.querySelectorAll('[data-reg]').forEach((inp) => inp.addEventListener('change', () => { reg[inp.dataset.reg] = inp.value.trim(); App.commit('Tersimpan'); }));
      root.querySelectorAll('[data-regb]').forEach((inp) => inp.addEventListener('change', () => { reg[inp.dataset.regb] = inp.checked; App.commit('Tersimpan'); }));
      root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
        const text = b.dataset.copy === 'url' ? formUrl() : inviteText();
        try { await navigator.clipboard.writeText(text); App.toast('Disalin'); } catch (e) { App.notice(text, 'Salin teks berikut'); }
      }));
      root.querySelector('#reg-config')?.addEventListener('click', () => {
        App.download('pendaftaran.json', JSON.stringify(R.buildConfig(App.S, App.files.url), null, 1));
        App.toast('Simpan sebagai pendaftaran.json di folder aplikasi');
      });
      root.querySelector('#reg-pull')?.addEventListener('click', async () => {
        const n = await R.pullOnline();
        if (!n) App.toast('Tidak ada kiriman online baru');
      });
      R.pullOnline(true);
      root.querySelector('#reg-import').addEventListener('change', async (e) => {
        let n = 0, files = 0, skipped = 0;
        for (const file of e.target.files) {
          try {
            const res = await importFile(file);
            if (res.skipped) skipped++; else { files++; n += res.n; }
          } catch (err) { App.notice(`Gagal mengimpor ${file.name}: ${err.message}`); }
        }
        App.commit(`${files} berkas diimpor (${n} atlet)` + (skipped ? `, ${skipped} berkas sudah pernah diimpor` : ''));
      });
      const find = (key) => { const [sid, i] = key.split(':'); const sub = App.S.registrations.find((s) => s.id === sid); return [sub, sub.athletes[+i]]; };
      root.querySelectorAll('[data-acc]').forEach((b) => b.addEventListener('click', () => {
        const [sub, r] = find(b.dataset.acc);
        accept(sub, r);
        App.commit(`${r.name} diterima`);
      }));
      root.querySelectorAll('[data-rej]').forEach((b) => b.addEventListener('click', () => {
        const [, r] = find(b.dataset.rej);
        r.status = 'rejected';
        App.commit(`${r.name} ditolak`);
      }));
      root.querySelectorAll('[data-acc-all]').forEach((b) => b.addEventListener('click', () => {
        const sub = App.S.registrations.find((s) => s.id === b.dataset.accAll);
        const list = sub.athletes.filter((r) => r.status === 'pending' && r.gender);
        list.forEach((r) => accept(sub, r));
        App.commit(`${list.length} atlet diterima`);
      }));
      root.querySelectorAll('[data-gender]').forEach((sel) => sel.addEventListener('change', () => {
        find(sel.dataset.gender)[1].gender = sel.value || null;
        App.commit();
      }));
      root.querySelectorAll('[data-sub-k]').forEach((sel) => sel.addEventListener('change', () => {
        App.S.registrations.find((s) => s.id === sel.dataset.subK).kontingenId = sel.value;
        App.commit('Kontingen dipilih');
      }));
      root.querySelectorAll('[data-sub-del]').forEach((b) => b.addEventListener('click', async () => {
        const sub = App.S.registrations.find((s) => s.id === b.dataset.subDel);
        if (!(await App.ask('Hapus kiriman ini dari daftar? Atlet yang sudah diterima tetap ada.'))) return;
        await removeSub(sub);
        App.commit('Kiriman dihapus');
      }));
    },
  };
})(window.App);
