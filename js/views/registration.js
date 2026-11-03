// Menu Pendaftaran (admin): pengaturan formulir official, link formulir, impor berkas kiriman, dan penerimaan atlet.
(function (App) {
  const esc = App.esc, R = App.reg;

  const formUrl = () => location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '') + 'daftar.html';

  // Atlet yang sudah ada di kontingen yang sama: NIK sama, atau nama + tanggal lahir sama.
  function findExisting(sub, r) {
    if (r.athleteId && App.athlete(r.athleteId)) return App.athlete(r.athleteId);
    return App.S.athletes.find((a) => a.kontingenId === sub.kontingenId
      && ((r.nik && a.nik === r.nik) || (a.name.toLowerCase() === r.name.toLowerCase() && (a.birth || '') === (r.birth || ''))));
  }

  async function importFile(file) {
    const obj = JSON.parse(await App.readFile(file, 'text'));
    if (obj.app !== R.FILE_APP) throw new Error(`${file.name} bukan berkas pendaftaran`);
    if (App.S.registrations.some((s) => s.fileName === file.name && s.created === obj.created)) return { skipped: true };
    const ok = obj.kontingen || {};
    const k = App.S.kontingen.find((x) => x.name === ok.name) || App.kontingen(ok.id);
    const evId = (e) => (App.event(e.id) || App.S.events.find((x) => x.code === e.code) || {}).id;
    const saveFile = (f) => (f && f.dataUrl ? App.files.add(f.name || 'berkas', f.type || f.dataUrl.slice(5, f.dataUrl.indexOf(';')), f.dataUrl) : null);
    const athletes = [];
    for (const a of obj.athletes || []) {
      athletes.push({
        name: (a.name || '').trim(), gender: a.gender === 'P' ? 'P' : 'L', birth: a.birth || '', nik: a.nik || '',
        events: (a.events || []).map(evId).filter(Boolean),
        photo: await saveFile(a.photo), docs: (await Promise.all((a.docs || []).map(saveFile))).filter(Boolean),
        status: 'pending', athleteId: null,
      });
    }
    App.S.registrations.unshift({
      id: App.uid('r_'), fileName: file.name, created: obj.created || '', received: new Date().toISOString(),
      kontingenId: k ? k.id : '', kontingenName: ok.name || '', officials: obj.officials || [], athletes,
    });
    return { n: athletes.length };
  }

  function accept(sub, r) {
    const ex = findExisting(sub, r);
    const data = {
      name: r.name, gender: r.gender, kontingenId: sub.kontingenId, birth: r.birth, nik: r.nik, events: r.events.slice(),
      photo: r.photo || (ex && ex.photo) || null, docs: r.docs.length ? r.docs.slice() : (ex && ex.docs) || [],
    };
    if (ex) { Object.assign(ex, data); r.athleteId = ex.id; }
    else { r.athleteId = App.uid('a_'); App.S.athletes.push({ id: r.athleteId, ...data }); }
    r.status = 'accepted';
  }

  const saveOfficials = (sub) => { const k = App.kontingen(sub.kontingenId); if (k) k.officials = sub.officials.map((o) => ({ ...o })); };
  const officialsSaved = (sub) => { const k = App.kontingen(sub.kontingenId); return k && JSON.stringify(k.officials || []) === JSON.stringify(sub.officials); };

  async function removeSub(sub) {
    const used = new Set(App.S.athletes.flatMap((a) => [a.photo, ...(a.docs || [])]).filter(Boolean));
    App.S.registrations = App.S.registrations.filter((s) => s.id !== sub.id);
    const others = new Set(App.S.registrations.flatMap((s) => s.athletes.flatMap((r) => [r.photo, ...r.docs])).filter(Boolean));
    for (const r of sub.athletes) {
      for (const id of [r.photo, ...r.docs]) if (id && !used.has(id) && !others.has(id)) await App.files.remove(id);
    }
  }

  function inviteText() {
    const E = App.S.event, reg = App.S.registration;
    return `Yth. Official Kontingen Woodball ${E.shortName}

Pendaftaran atlet dilakukan lewat formulir berikut:
${formUrl()}

1. Pilih Kabupaten/Kota, isi official, lalu tambahkan atlet (nama, tanggal lahir, NIK, pas foto, dokumen identitas, dan nomor yang diikuti).
2. Klik "Unduh berkas pendaftaran", lalu kirim file tersebut ke panitia lewat WhatsApp/email.
3. Cetak rekap, tanda tangani, dan serahkan sesuai arahan panitia.
${reg.deadline ? `\nBatas pendaftaran: ${App.fmtDate(reg.deadline)}` : ''}${reg.contactName || reg.contactPhone ? `\nKontak panitia: ${[reg.contactName, reg.contactPhone].filter(Boolean).join(' - ')}` : ''}`;
  }

  function settingsCard() {
    const reg = App.S.registration;
    const f = (key, label, type = 'text', extra = '') => `<label>${label}<input type="${type}" data-reg="${key}" value="${esc(reg[key] ?? '')}" ${extra}></label>`;
    const b = (key, label) => `<label class="chk"><input type="checkbox" data-regb="${key}" ${reg[key] ? 'checked' : ''}> ${label}</label>`;
    return `<div class="card"><h3>Formulir untuk official</h3>
      <p class="muted">Official kontingen mengisi formulir di HP/laptop masing-masing, lalu mengirim <b>berkas pendaftaran</b> ke panitia. Berkas itu diimpor di bawah.</p>
      ${b('open', 'Formulir dibuka')}
      <div class="grid3">
        ${f('deadline', 'Batas pendaftaran', 'date')}
        ${f('contactName', 'Nama kontak panitia')}
        ${f('contactPhone', 'No. WhatsApp panitia', 'tel')}
        ${f('roles', 'Pilihan jabatan official (pisah koma)')}
      </div>
      <label>Catatan untuk official (tampil di atas formulir)<textarea data-reg="note" rows="2" style="font-family:inherit">${esc(reg.note)}</textarea></label>
      <div class="field-t">Data wajib</div>
      ${b('requireNik', 'NIK')}${b('requirePhoto', 'Pas foto')}${b('requireDocs', 'Dokumen identitas (KTP/KK/akta)')}
      <p class="muted small">Data yang belum lengkap tetap bisa dikirim, tetapi ditandai di formulir dan di daftar impor.</p>
      <h4>Link formulir</h4>
      <div class="row gap wrap"><code class="reg-url">${esc(formUrl())}</code>
        <button class="btn sm ghost" data-copy="url">Salin link</button>
        <a class="btn sm" href="daftar.html?lokal" target="_blank" rel="noopener">Buka formulir</a></div>
      <p class="muted small">Link di atas adalah alamat halaman ini. Setelah aplikasi online (Vercel), bagikan link versi online-nya.
        Agar formulir online memakai logo dan pengaturan terbaru, klik <b>Unduh pengaturan formulir</b>, simpan sebagai <code>pendaftaran.json</code> di folder aplikasi (sejajar <code>index.html</code>), lalu publish ulang.</p>
      <div class="row gap wrap"><button class="btn sm ghost" id="reg-config">⬇️ Unduh pengaturan formulir (pendaftaran.json)</button>
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
    const accepted = sub.athletes.filter((r) => r.status === 'accepted').length;
    const rows = sub.athletes.map((r, i) => {
      const chk = R.check(App.S, r);
      const ex = r.status === 'pending' && sub.kontingenId ? findExisting(sub, r) : null;
      const st = r.status === 'accepted' ? '<span class="pill ok">Diterima</span>'
        : r.status === 'rejected' ? '<span class="pill">Ditolak</span>'
          : ex ? '<span class="pill warn">Sudah ada · diperbarui</span>' : '<span class="pill live">Baru</span>';
      const notes = [...(chk.missing.length ? ['Belum ada: ' + chk.missing.join(', ')] : []), ...chk.warns];
      return `<tr class="${r.status === 'rejected' ? 'dim' : ''}"><td class="c">${i + 1}</td>
        <td>${r.photo ? `<a href="#" data-scan-open="${r.photo}"><img class="reg-thumb" src="${App.files.url(r.photo)}" alt=""></a>` : '<span class="muted small">-</span>'}</td>
        <td><b>${esc(r.name)}</b><div class="small muted">NIK ${esc(r.nik || '-')}</div></td><td class="c">${r.gender}</td>
        <td class="nowrap small">${esc(r.birth ? App.fmtDate(r.birth) : '-')}<div class="muted">${esc(App.ageText(r.birth))}</div></td>
        <td>${r.events.map(App.event).filter(Boolean).map((ev) => `<span class="code" title="${esc(ev.name)}">${esc(ev.code)}</span>`).join(' ')}</td>
        <td class="nowrap">${r.docs.map((id, j) => `<a href="#" data-scan-open="${id}" class="btn xs ghost">📄 ${j + 1}</a>`).join(' ') || '<span class="muted small">-</span>'}</td>
        <td class="small">${notes.length ? `<span class="reg-warn">⚠️ ${esc(notes.join(' · '))}</span>` : '<span class="muted">-</span>'}</td>
        <td>${st}</td>
        <td class="nowrap">${r.status !== 'accepted' ? `<button class="btn sm" data-acc="${sub.id}:${i}" ${sub.kontingenId ? '' : 'disabled'}>Terima</button>` : ''}
          ${r.status === 'pending' ? `<button class="btn sm ghost" data-rej="${sub.id}:${i}">Tolak</button>` : ''}</td></tr>`;
    }).join('');
    return `<details class="card reg-sub" ${pending ? 'open' : ''}>
      <summary><b>${esc(k ? k.name : sub.kontingenName || 'Kontingen tidak dikenal')}</b>
        <span class="muted small">· ${sub.athletes.length} atlet · diterima ${accepted}${pending ? ` · <b>${pending} menunggu</b>` : ''} · masuk ${esc(new Date(sub.received).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}</span></summary>
      <p class="muted small">Berkas: ${esc(sub.fileName)}${sub.created ? ` · dibuat ${esc(new Date(sub.created).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}` : ''}</p>
      ${k ? '' : `<label class="reg-kpick">Kontingen tidak cocok dengan daftar. Pilih kontingen:<select data-sub-k="${sub.id}">${App.ui.kontingenOptions('')}</select></label>`}
      <div class="reg-offs"><b>Official:</b> ${sub.officials.map((o) => `${esc(o.role)}: ${esc(o.name)}${o.phone ? ` (${esc(o.phone)})` : ''}`).join(' · ') || '-'}
        ${sub.officials.length && k ? (officialsSaved(sub) ? ' <span class="pill ok">tersimpan di kontingen</span>' : ` <button class="btn xs ghost" data-offs="${sub.id}">Simpan ke kontingen</button>`) : ''}</div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Foto</th><th>Nama / NIK</th><th>L/P</th><th>Lahir / umur</th><th>Nomor</th><th>Dokumen</th><th>Catatan</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row gap wrap">${pending && k ? `<button class="btn" data-acc-all="${sub.id}">✔ Terima semua (${pending})</button>` : ''}
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
            Kiriman ulang dari kontingen yang sama memperbarui atlet yang NIK-nya (atau nama + tanggal lahirnya) sama.</p>
          <label class="btn upload">📥 Pilih berkas pendaftaran<input type="file" accept=".json,application/json" multiple id="reg-import" hidden></label>
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
      root.querySelector('#reg-config').addEventListener('click', () => {
        App.download('pendaftaran.json', JSON.stringify(R.buildConfig(App.S, App.files.url), null, 1));
        App.toast('Simpan sebagai pendaftaran.json di folder aplikasi');
      });
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
        const list = sub.athletes.filter((r) => r.status === 'pending');
        list.forEach((r) => accept(sub, r));
        if (sub.officials.length) saveOfficials(sub);
        App.commit(`${list.length} atlet diterima`);
      }));
      root.querySelectorAll('[data-offs]').forEach((b) => b.addEventListener('click', () => {
        saveOfficials(App.S.registrations.find((s) => s.id === b.dataset.offs));
        App.commit('Official tersimpan di kontingen');
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
      App.bindScans(root, () => []);
    },
  };
})(window.App);
