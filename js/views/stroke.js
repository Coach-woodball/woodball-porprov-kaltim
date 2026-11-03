// Halaman Stroke: undian pairing per ronde, input skor per gate, ranking live.
(function (App) {
  const esc = App.esc, St = App.stroke;

  App.strokeRankingTable = (ev, opts = {}) => {
    const rows = St.ranking(ev);
    if (!rows.length) return App.ui.empty('Belum ada entri.');
    const editable = opts.editable && App.isAdmin();
    const manual = St.data(ev).manual;
    if (ev.kind === 'team') {
      return `<div class="table-wrap"><table class="rank"><thead><tr><th>Pos</th><th>Kontingen</th><th>Anggota (skor)</th><th>Total</th>${editable ? '<th>Manual</th>' : ''}</tr></thead><tbody>
        ${rows.map((r) => `<tr class="${r.rank <= 3 && r.played ? 'm' + r.rank : ''}"><td class="c"><b>${r.played ? r.rank : '-'}</b>${r.tied ? ' <span class="pill warn" title="Masih sama, isi urutan manual">=</span>' : ''}</td>
          <td>${esc(App.kName(r.entry.kontingenId))}</td>
          <td class="small">${r.members.map((m) => `${esc(App.athName(m.athleteId))} <b>${m.played ? m.total : '-'}</b>`).join(' · ')}</td>
          <td class="c big">${r.played ? r.total : '-'}</td>
          ${editable ? `<td><input class="tiny" type="number" data-manual="${r.entry.id}" value="${manual[r.entry.id] ?? ''}" title="Urutan hasil adu penalti (1 = terbaik)"></td>` : ''}</tr>`).join('')}
        </tbody></table></div>`;
    }
    const rcs = ev.config.rounds;
    return `<div class="table-wrap"><table class="rank"><thead><tr><th>Pos</th><th>Nama</th><th>Kontingen</th>${rcs.map((r) => `<th>${esc(r.name)}</th>`).join('')}<th>Total</th>${editable ? '<th>Manual</th>' : ''}</tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.rank <= 3 && r.played ? 'm' + r.rank : ''}">
        <td class="c"><b>${r.played ? r.rank : '-'}</b>${r.tied ? ' <span class="pill warn" title="Masih sama setelah semua kriteria. Isi urutan manual (adu penalti).">=</span>' : ''}</td>
        <td>${esc(App.entryName(r.entry))}</td><td>${esc(App.kShort(r.entry.kontingenId))}</td>
        ${r.rounds.map((x, i) => `<td class="c">${x.played ? x.sum + (x.played < rcs[i].gates ? `<small class="muted">/${x.played}g</small>` : '') : '-'}</td>`).join('')}
        <td class="c big">${r.played ? r.total : '-'}</td>
        ${editable ? `<td><input class="tiny" type="number" data-manual="${r.entry.id}" value="${manual[r.entry.id] ?? ''}" title="Urutan hasil adu penalti (1 = terbaik)"></td>` : ''}</tr>`).join('')}
      </tbody></table></div>`;
  };

  // Kelas warna skor per gate: 1 paling hijau, 5+ merah, supaya pukulan terkecil cepat terlihat.
  App.scoreCls = (v) => {
    const n = App.num(v);
    if (n == null || n <= 0) return '';
    return 'sv' + Math.min(n, 5);
  };
  App.scoreLegend = () => `<div class="sv-legend"><span>Warna skor:</span>${[1, 2, 3, 4, 5].map((n) => `<i class="sv${n}">${n === 5 ? '5+' : n}</i>`).join('')}</div>`;

  function groupCard(ev, ri, g) {
    const rc = ev.config.rounds[ri];
    const gates = Array.from({ length: rc.gates }, (_, i) => i);
    const scans = St.data(ev).rounds[ri].scans[g.id] || [];
    return `<div class="card group" data-group="${g.id}">
      <div class="row between wrap"><h3>Pairing ${g.no}</h3>
        <div class="row gap wrap"><label class="mini">Lapangan<input class="tiny" data-glane="${g.id}" value="${esc(g.lane || '')}"></label>
        <label class="mini">Jam<input class="tiny" data-gtime="${g.id}" value="${esc(g.time || '')}" placeholder="08.00"></label>
        <a class="btn sm ghost" href="#/print/scorecard-stroke/${ev.id}/${ri}/${g.id}">🖨️ Score card</a></div></div>
      <div class="table-wrap"><table class="score"><thead><tr><th class="name">Nama</th>${gates.map((i) => `<th>${i + 1}</th>`).join('')}<th class="gate-add"><button class="btn xs ghost" data-gate="-1" title="Kurangi 1 gate untuk ronde ini">− Gate</button><button class="btn xs ghost" data-gate="1" title="Tambah 1 gate untuk ronde ini">+ Gate</button></th><th>Total</th></tr></thead><tbody>
      ${g.entryIds.map((id) => {
        const e = App.entry(id);
        const sc = St.score(ev, ri, id);
        const s = St.sumScore(sc, rc.gates);
        return `<tr><td class="name"><b>${esc(App.entryName(e))}</b><small>${esc(App.kShort(e?.kontingenId))}</small></td>
          ${gates.map((i) => `<td><input class="sc ${App.scoreCls(sc.g[i])}" inputmode="numeric" maxlength="2" data-sc="${id}:${i}" value="${sc.g[i] ?? ''}"></td>`).join('')}
          <td class="gate-add"></td>
          <td class="c big" data-total="${id}">${s.played ? s.sum : ''}</td></tr>`;
      }).join('')}
      </tbody></table></div>
      ${App.ui.scanBlock(scans, ri + ':' + g.id)}
    </div>`;
  }

  App.views.stroke = {
    admin: true,
    render(params) {
      const evs = App.S.events.filter((e) => e.discipline === 'stroke');
      const ev = App.event(params[0]) || evs[0];
      if (!ev) return App.ui.empty('Belum ada nomor stroke.');
      let html = `<h2>${esc(App.S.menu.stroke)}</h2>${App.ui.eventTabs('stroke', ev.id, 'stroke')}`;
      if (ev.kind === 'team') {
        const src = App.event(ev.config.sourceEvent);
        return html + `<div class="card"><h3>${esc(ev.name)}</h3><p class="muted">Dihitung otomatis dari skor ${esc(src ? src.name : '?')} (${ev.config.sourceRounds.map((i) => src?.config.rounds[i]?.name).join(' + ')}), ${ev.config.countBest} pemain terbaik. Anggota tim diatur di <a href="#/events/${ev.id}">Nomor & Entri</a>.</p>
          <div id="rank-box">${App.strokeRankingTable(ev, { editable: true })}</div></div>`;
      }
      const ri = Math.min(+(params[1] || 0), ev.config.rounds.length - 1);
      const rc = ev.config.rounds[ri];
      const d = St.data(ev);
      const r = d.rounds[ri];
      const parts = St.participants(ev, ri);
      html += `<div class="tabs sub">${ev.config.rounds.map((x, i) => `<a href="#/stroke/${ev.id}/${i}" class="${i === ri ? 'active' : ''}">${esc(x.name)}</a>`).join('')}</div>`;
      html += `<div class="card"><div class="row between wrap"><div><h3>${esc(ev.name)} · ${esc(rc.name)}</h3>
          <p class="muted">${parts.length} peserta · ${rc.gates} gate${rc.cut ? ` · hanya ${rc.cut} besar` : ''} · ${ev.config.groupSize} per pairing</p>
          <div class="row gap wrap gate-ctl"><span class="small muted">Jumlah gate</span><button class="btn xs ghost" data-gate="-1" title="Kurangi 1 gate">−</button><b>${rc.gates}</b><button class="btn xs ghost" data-gate="1" title="Tambah 1 gate">+</button>${App.scoreLegend()}</div></div>
          <div class="row gap wrap">
            <button class="btn sm" data-gen="random">🎲 Undi acak</button>
            ${ri > 0 ? '<button class="btn sm ghost" data-gen="rank">📊 Urut ranking</button>' : ''}
            <button class="btn sm ghost" data-gen="order">↕ Urut daftar</button>
            <button class="btn sm ghost" id="manual-toggle">✋ Atur manual</button>
            ${r.groups.length ? `<a class="btn sm ghost" href="#/print/scorecard-stroke/${ev.id}/${ri}">🖨️ Semua score card</a>` : ''}
          </div></div>
          <div id="manual-box" class="hidden">${manualBox(ev, ri, parts)}</div>
        </div>`;
      html += r.groups.length ? r.groups.map((g) => groupCard(ev, ri, g)).join('')
        : App.ui.empty(parts.length ? 'Pairing belum dibuat. Klik "Undi acak", "Urut ranking", atau atur manual.' : 'Belum ada peserta untuk ronde ini.');
      html += `<div class="card"><div class="row between"><h3>Ranking ${esc(ev.name)}</h3><a class="btn sm ghost" href="#/print/result/${ev.id}">🖨️ Hasil resmi</a></div>
        <p class="muted small">Penentuan jika sama: ${(ev.config.tiebreak || []).map((k) => esc(St.TIEBREAKS[k])).join(' → ')}</p>
        <div id="rank-box">${App.strokeRankingTable(ev, { editable: true })}</div></div>`;
      return html;
    },
    mount(root, params) {
      const evs = App.S.events.filter((e) => e.discipline === 'stroke');
      const ev = App.event(params[0]) || evs[0];
      if (!ev) return;
      const bindManual = () => root.querySelectorAll('[data-manual]').forEach((inp) => inp.addEventListener('change', () => {
        const d = St.data(ev);
        const v = App.num(inp.value);
        if (v == null) delete d.manual[inp.dataset.manual]; else d.manual[inp.dataset.manual] = v;
        App.commit('Urutan manual disimpan');
      }));
      bindManual();
      if (ev.kind === 'team') return;
      const ri = Math.min(+(params[1] || 0), ev.config.rounds.length - 1);
      const rc = ev.config.rounds[ri];
      const r = St.data(ev).rounds[ri];

      root.querySelectorAll('[data-gen]').forEach((b) => b.addEventListener('click', async () => {
        const hasScores = r.groups.some((g) => g.entryIds.some((id) => St.sumScore(St.score(ev, ri, id), rc.gates).played));
        if (r.groups.length && !(await App.ask(hasScores ? 'Pairing sudah ada dan sudah ada skor. Susun ulang pairing? (skor tetap tersimpan per pemain)' : 'Susun ulang pairing?'))) return;
        St.generateGroups(ev, ri, b.dataset.gen);
        if (b.dataset.gen !== 'random') return App.commit('Pairing dibuat');
        App.save(true);
        App.drawAnimation({
          title: `Undian Pairing · ${ev.name}`,
          sub: rc.name,
          boxes: r.groups.map((g) => ({ label: `Pairing ${g.no}`, items: g.entryIds.map((id) => App.entryLabel(App.entry(id))) })),
        }).then(() => App.commit('Pairing dibuat'));
      }));
      root.querySelectorAll('[data-gate]').forEach((b) => b.addEventListener('click', async () => {
        const n = rc.gates + +b.dataset.gate;
        if (n < 1 || n > 36) return;
        if (n < rc.gates) {
          const used = r.groups.some((g) => g.entryIds.some((id) => St.score(ev, ri, id).g[rc.gates - 1] != null));
          if (!(await App.ask(`Kurangi gate ${rc.name} menjadi ${n}?${used ? ' Skor gate ' + rc.gates + ' yang sudah diisi tidak ikut dihitung (tetap tersimpan).' : ''}`))) return;
        }
        rc.gates = n;
        App.commit(`${rc.name}: ${n} gate`);
      }));
      root.querySelector('#manual-toggle').addEventListener('click', () => root.querySelector('#manual-box').classList.toggle('hidden'));
      root.querySelectorAll('[data-mgroup]').forEach((inp) => inp.addEventListener('change', () => {
        St.moveToGroup(ev, ri, inp.dataset.mgroup, App.num(inp.value));
        St.cleanGroups(ev, ri);
        App.save();
      }));
      root.querySelector('#manual-apply')?.addEventListener('click', () => App.commit('Pairing diperbarui'));
      root.querySelectorAll('[data-glane]').forEach((inp) => inp.addEventListener('change', () => { r.groups.find((g) => g.id === inp.dataset.glane).lane = inp.value; App.save(); }));
      root.querySelectorAll('[data-gtime]').forEach((inp) => inp.addEventListener('change', () => { r.groups.find((g) => g.id === inp.dataset.gtime).time = inp.value; App.save(); }));

      const refreshRank = () => {
        const box = root.querySelector('#rank-box');
        box.innerHTML = App.strokeRankingTable(ev, { editable: true });
        bindManual();
      };
      const inputs = Array.from(root.querySelectorAll('input.sc'));
      inputs.forEach((inp, idx) => {
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('input', () => {
          inp.value = inp.value.replace(/\D/g, '');
          const v = App.num(inp.value);
          inp.className = ('sc ' + App.scoreCls(v)).trim();
          const [id, gi] = inp.dataset.sc.split(':');
          const sc = St.score(ev, ri, id, true);
          sc.g[+gi] = v;
          const s = St.sumScore(sc, rc.gates);
          root.querySelector(`[data-total="${id}"]`).textContent = s.played ? s.sum : '';
          // Pindah otomatis ke gate berikutnya setelah angka 1 digit (skor >9 jarang).
          if (inp.value.length === 1 && v > 1 && inputs[idx + 1]) inputs[idx + 1].focus();
          App.save();
        });
        inp.addEventListener('change', refreshRank);
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && inputs[idx + 1]) { e.preventDefault(); inputs[idx + 1].focus(); }
        });
      });
      App.bindScans(root, (key) => {
        const gid = key.split(':')[1];
        r.scans[gid] = r.scans[gid] || [];
        return r.scans[gid];
      });
    },
  };

  function manualBox(ev, ri, parts) {
    const r = St.data(ev).rounds[ri];
    const groupOf = {};
    r.groups.forEach((g) => g.entryIds.forEach((id) => (groupOf[id] = g.no)));
    let ids = parts;
    if (ri > 0 || !r.groups.length) {
      // tampilkan juga peserta yang belum punya pairing
      const all = new Set([...St.participants(ev, ri), ...(ri === 0 ? App.entriesOf(ev.id).map((e) => e.id) : [])]);
      ids = Array.from(all);
    }
    return `<p class="muted">Isi nomor pairing untuk tiap peserta (kosongkan untuk mengeluarkan dari ronde ini), lalu klik Terapkan.</p>
      <div class="manual-grid">${ids.map((id) => `<label class="mini"><span>${esc(App.entryLabel(App.entry(id)))}</span>
        <input class="tiny" type="number" min="1" data-mgroup="${id}" value="${groupOf[id] || ''}"></label>`).join('')}</div>
      <button class="btn sm" id="manual-apply">Terapkan</button>`;
  }
})(window.App);
