// Halaman Stroke: undian pairing per ronde, input skor per gate, ranking live.
(function (App) {
  const esc = App.esc, St = App.stroke;

  // Kolom angka kumulatif: berapa kali skor 1, 2, 3, 4, 5+ muncul.
  const CNT_LABEL = ['1', '2', '3', '4', '5+'];
  App.countHeads = () => CNT_LABEL.map((l, i) => `<th class="cnt${i ? '' : ' cnt-first'}" title="Jumlah gate dengan skor ${l}">${l}</th>`).join('');
  App.countCells = (c, attr = () => '') => c.map((n, i) => `<td class="c cnt${i ? '' : ' cnt-first'}" ${attr(i)}>${n}</td>`).join('');

  App.strokeRankingTable = (ev, opts = {}) => {
    let rows = St.ranking(ev);
    if (!rows.length) return App.ui.empty('Belum ada entri.');
    const editable = opts.editable && App.isAdmin();
    const manual = St.data(ev).manual;
    const done = ev.kind === 'team' || St.prelimDone(ev);
    const pre = ev.kind === 'team' ? [] : St.prelimRounds(ev);
    const preLabel = ev.kind === 'team' ? 'pemain yang dihitung' : pre.map((i) => ev.config.rounds[i].name).join(' + ');
    // Tamu (non admin) selalu melihat nilai terkecil di atas; admin melihat urutan pairing sampai penyisihan selesai.
    const byPairing = !done && App.isAdmin();
    if (byPairing) {
      // Sebelum ronde penyisihan selesai: urutan pairing, belum ada peringkat.
      const order = St.data(ev).rounds[0].groups.flatMap((g) => g.entryIds);
      const pos = (r) => { const i = order.indexOf(r.entry.id); return i < 0 ? 1e6 : i; };
      rows = rows.slice().sort((a, b) => pos(a) - pos(b));
    }
    const rankCell = (r) => `<td class="c"><b>${r.played && done ? r.rank : '-'}</b>${done && r.tied ? ' <span class="pill warn" title="Masih sama setelah semua kriteria. Isi urutan manual (adu penalti).">=</span>' : ''}</td>`;
    const rowCls = (r) => (done && r.rank <= 3 && r.played ? 'm' + r.rank : '');
    const manualCell = (r) => (editable ? `<td><input class="tiny" type="number" data-manual="${r.entry.id}" value="${manual[r.entry.id] ?? ''}" title="Urutan hasil adu penalti (1 = terbaik)"></td>` : '');
    const note = `<p class="muted small">${done ? '' : `Peringkat ditampilkan setelah ${esc(preLabel)} selesai; sementara diurutkan ${byPairing ? 'sesuai pairing' : 'dari nilai terkecil'}. `}Kolom 1 sampai 5+: berapa kali skor itu muncul (kumulatif ${ev.kind === 'team' ? esc(preLabel) : 'semua ronde'}).</p>`;
    if (ev.kind === 'team') {
      return `${note}<div class="table-wrap"><table class="rank"><thead><tr><th>Pos</th><th>Kontingen</th><th>Anggota (skor)</th><th>Total</th>${App.countHeads()}${editable ? '<th>Manual</th>' : ''}</tr></thead><tbody>
        ${rows.map((r) => `<tr class="${rowCls(r)}">${rankCell(r)}
          <td>${esc(App.kName(r.entry.kontingenId))}</td>
          <td class="small">${r.members.map((m) => `${esc(App.athName(m.athleteId))} <b>${m.played ? m.total : '-'}</b>`).join(' · ')}</td>
          <td class="c big">${r.played ? r.total : '-'}</td>${App.countCells(r.counts)}${manualCell(r)}</tr>`).join('')}
        </tbody></table></div>`;
    }
    const rcs = ev.config.rounds;
    return `${note}<div class="table-wrap"><table class="rank"><thead><tr><th>Pos</th><th>Nama</th><th>Kontingen</th>${rcs.map((r) => `<th>${esc(r.name)}</th>`).join('')}<th>Total</th>${App.countHeads()}${editable ? '<th>Manual</th>' : ''}</tr></thead><tbody>
      ${rows.map((r) => `<tr class="${rowCls(r)}">${rankCell(r)}
        <td>${esc(App.entryName(r.entry))}</td><td>${esc(App.kShort(r.entry.kontingenId))}</td>
        ${r.rounds.map((x, i) => `<td class="c">${x.played ? x.sum + (x.played < rcs[i].gates ? `<small class="muted">/${x.played}g</small>` : '') : '-'}</td>`).join('')}
        <td class="c big">${r.played ? r.total : '-'}</td>${App.countCells(r.counts)}${manualCell(r)}</tr>`).join('')}
      </tbody></table></div>`;
  };

  // Tabel skor per gate Team Stroke: 4 baris pemain lalu baris jumlah tim.
  App.teamGateTable = (ev, opts = {}) => {
    const d = St.teamDetail(ev);
    if (!d || !d.cols.length) return App.ui.empty('Nomor sumber (single stroke) belum diatur.');
    if (!d.teams.length) return App.ui.empty('Belum ada tim.');
    const rounds = [];
    d.cols.forEach((c) => { const last = rounds[rounds.length - 1]; if (last && last.name === c.round) last.n++; else rounds.push({ name: c.round, n: 1 }); });
    const cell = (v, i) => `<td class="c ${App.scoreCls(v)}${d.cols[i].g === 0 && i ? ' rs' : ''}">${v ?? ''}</td>`;
    // Total per ronde dari nilai gate (null = belum diisi).
    const roundIdx = [...new Set(d.cols.map((c) => c.ri))];
    const perRound = (vals) => roundIdx.map((ri) => {
      const xs = vals.filter((v, i) => d.cols[i].ri === ri && v !== null);
      return xs.length ? xs.reduce((s, v) => s + v, 0) : null;
    });
    const totals = (arr, last) => arr.map((v, i) => `<td class="c tsub${i ? '' : ' rs'}">${v ?? '-'}</td>`).join('') + `<td class="c tot">${last}</td>`;
    const body = d.teams.map(({ row, members, sums }) => {
      const span = members.length + 1;
      const medal = opts.print && row.played && row.rank <= 3 ? `<br><small>${App.MEDAL[row.rank]}</small>` : '';
      const head = `<tr class="tg-team"><td class="c" rowspan="${span}"><b>${row.played ? row.rank : '-'}</b>${medal}</td><td class="kab" rowspan="${span}">${esc(App.kName(row.entry.kontingenId))}</td>`;
      return members.map((m, mi) => `${mi ? '<tr>' : head}<td class="nm${m.counted ? '' : ' muted'}">${esc(App.athName(m.athleteId))}${m.counted ? '' : ' <small>(tidak dihitung)</small>'}</td>
        ${m.vals.map(cell).join('')}${totals(perRound(m.vals), m.played ? m.total : '-')}</tr>`).join('')
        + `<tr class="tg-sum"><td class="nm">Jumlah tim</td>${sums.map((v, i) => `<td class="c${d.cols[i].g === 0 && i ? ' rs' : ''}">${v ?? ''}</td>`).join('')}${totals(perRound(sums), row.played ? row.total : '-')}</tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="team-gates${opts.print ? ' pt' : ''}"><thead>
      <tr><th rowspan="2">Pos</th><th rowspan="2">Kab/Kota</th><th rowspan="2">Pemain</th>${rounds.map((r, i) => `<th colspan="${r.n}" class="${i ? 'rs' : ''}">${esc(r.name)}</th>`).join('')}<th colspan="${roundIdx.length + 1}" class="rs">Total</th></tr>
      <tr>${d.cols.map((c, i) => `<th class="${c.g === 0 && i ? 'rs' : ''}">${c.g + 1}</th>`).join('')}${rounds.map((r, i) => `<th class="tsub${i ? '' : ' rs'}">${esc(r.name.replace(/^Penyisihan\s*/i, ''))}</th>`).join('')}<th>${rounds.map((r) => esc(r.name.replace(/^Penyisihan\s*/i, ''))).join(' + ')}</th></tr></thead><tbody>${body}</tbody></table></div>`;
  };

  // Kelas warna skor per gate: 1 paling hijau, 5+ merah, supaya pukulan terkecil cepat terlihat.
  App.scoreCls = (v) => {
    const n = App.num(v);
    if (n == null || n <= 0) return '';
    return 'sv' + Math.min(n, 5);
  };
  // Mode angka gate: berwarna atau netral (disimpan per perangkat).
  App.scoreMode = () => { try { return localStorage.getItem('wb-scoremode') || 'color'; } catch (e) { return 'color'; } };
  App.scoreLegend = () => `<div class="sv-legend"><span>Warna skor:</span>${[1, 2, 3, 4, 5].map((n) => `<i class="sv${n}">${n === 5 ? '5+' : n}</i>`).join('')}
    <button type="button" class="btn xs ghost" data-act="scoremode">${App.scoreMode() === 'neutral' ? 'Tampilkan berwarna' : 'Tampilkan netral'}</button></div>`;

  // Kolom tambahan kartu pairing: total ronde sebelumnya, jumlah berjalan, dan angka kumulatif.
  function rowExtras(ev, ri, id) {
    const cntRounds = Array.from({ length: ri + 1 }, (_, i) => i); // kumulatif sampai ronde ini
    const sum = (i) => St.sumScore(St.score(ev, i, id), ev.config.rounds[i].gates);
    const prev = Array.from({ length: ri }, (_, i) => sum(i));
    const cur = sum(ri);
    const counts = St.counts(cntRounds.flatMap((i) => sum(i).gates));
    const jumlah = prev.reduce((s, x) => s + x.sum, 0) + cur.sum;
    return { prev, jumlah, counts, any: cur.played || prev.some((x) => x.played) };
  }

  function groupCard(ev, ri, g) {
    const rc = ev.config.rounds[ri];
    const gates = Array.from({ length: rc.gates }, (_, i) => i);
    const scans = St.data(ev).rounds[ri].scans[g.id] || [];
    const prevNames = ev.config.rounds.slice(0, ri).map((x) => x.name);
    return `<div class="card group" data-group="${g.id}">
      <div class="row between wrap"><h3>Pairing ${g.no}</h3>
        <div class="row gap wrap"><label class="mini">Lapangan<input class="tiny" data-glane="${g.id}" value="${esc(g.lane || '')}"></label>
        <label class="mini">Jam<input class="tiny" data-gtime="${g.id}" value="${esc(g.time || '')}" placeholder="08.00"></label>
        <a class="btn sm ghost" href="#/print/scorecard-stroke/${ev.id}/${ri}/${g.id}">🖨️ Score card</a></div></div>
      <div class="table-wrap"><table class="score"><thead><tr><th class="name">Nama</th>${gates.map((i) => `<th>${i + 1}</th>`).join('')}<th class="gate-add"><button class="btn xs ghost" data-gate="-1" title="Kurangi 1 gate untuk ronde ini">− Gate</button><button class="btn xs ghost" data-gate="1" title="Tambah 1 gate untuk ronde ini">+ Gate</button></th><th>Total</th>
        ${prevNames.map((n) => `<th class="prev" title="Total ${esc(n)}">${esc(n)}</th>`).join('')}${ri ? '<th class="prev" title="Jumlah semua ronde sampai ronde ini">Jumlah</th>' : ''}${App.countHeads()}</tr></thead><tbody>
      ${g.entryIds.map((id) => {
        const e = App.entry(id);
        const sc = St.score(ev, ri, id);
        const s = St.sumScore(sc, rc.gates);
        const x = rowExtras(ev, ri, id);
        return `<tr><td class="name"><b>${esc(App.entryName(e))}</b><small>${esc(App.kShort(e?.kontingenId))}</small></td>
          ${gates.map((i) => `<td><input class="sc ${App.scoreCls(sc.g[i])}" inputmode="numeric" maxlength="2" data-sc="${id}:${i}" value="${sc.g[i] ?? ''}"></td>`).join('')}
          <td class="gate-add"></td>
          <td class="c big" data-total="${id}">${s.played ? s.sum : ''}</td>
          ${x.prev.map((p) => `<td class="c prev">${p.played ? p.sum : '-'}</td>`).join('')}${ri ? `<td class="c prev big" data-jumlah="${id}">${x.any ? x.jumlah : ''}</td>` : ''}
          ${App.countCells(x.counts, (k) => `data-cnt="${id}:${k}"`)}</tr>`;
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
      if (ev.kind === 'team' && !ev.config.own) {
        const src = App.event(ev.config.sourceEvent);
        return html + `<div class="card"><h3>${esc(ev.name)}</h3><p class="muted">Dihitung otomatis dari skor ${esc(src ? src.name : '?')} (${ev.config.sourceRounds.map((i) => src?.config.rounds[i]?.name).join(' + ')}), ${ev.config.countBest} pemain terbaik. Anggota tim diatur di <a href="#/events/${ev.id}">Nomor & Entri</a>.</p>
          <div id="rank-box">${App.strokeRankingTable(ev, { editable: true })}</div></div>
          <div class="card"><h3>Skor per gate</h3><p class="muted small">Skor tiap pemain di setiap gate, dan jumlah tim per gate dari pemain yang dihitung.</p>${App.scoreLegend()}${App.teamGateTable(ev)}</div>`;
      }
      const ri = Math.min(+(params[1] || 0), ev.config.rounds.length - 1);
      const rc = ev.config.rounds[ri];
      const d = St.data(ev);
      const r = d.rounds[ri];
      const parts = St.participants(ev, ri);
      html += `<div class="tabs sub">${ev.config.rounds.map((x, i) => `<a href="#/stroke/${ev.id}/${i}" class="${i === ri ? 'active' : ''}">${esc(x.name)}</a>`).join('')}</div>`;
      html += `<div class="card"><div class="row between wrap"><div><h3>${esc(ev.name)} · ${esc(rc.name)}</h3>
          <p class="muted">${ev.kind === 'team' ? `${App.entriesOf(ev.id).length} tim · ` : ''}${parts.length} pemain · ${rc.gates} gate${rc.cut ? ` · hanya ${rc.cut} besar` : ''} · ${ev.config.groupSize} per pairing</p>
          <div class="row gap wrap gate-ctl"><span class="small muted">Jumlah gate</span><button class="btn xs ghost" data-gate="-1" title="Kurangi 1 gate">−</button><b>${rc.gates}</b><button class="btn xs ghost" data-gate="1" title="Tambah 1 gate">+</button>${App.scoreLegend()}</div></div>
          <div class="row gap wrap">
            ${ri > 0 && !rc.cut && d.rounds[ri - 1].groups.length ? `<button class="btn sm" data-gen="copy">📋 Sama dengan ${esc(ev.config.rounds[ri - 1].name)}</button>` : ''}
            <button class="btn sm${ri > 0 && !rc.cut ? ' ghost' : ''}" data-gen="random">🎲 Undi acak</button>
            ${ri > 0 && ev.kind !== 'team' ? '<button class="btn sm ghost" data-gen="rank">📊 Urut ranking</button>' : ''}
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
      if (ev.kind === 'team') html += `<div class="card"><h3>Skor per gate tim</h3><p class="muted small">Skor tiap pemain di setiap gate dan jumlah tim per gate.</p><div id="tg-box">${App.teamGateTable(ev)}</div></div>`;
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
      if (ev.kind === 'team' && !ev.config.own) return;
      // Pairing lama yang masih berisi pemain yang sudah diganti di Nomor & Entri ikut diperbarui.
      if (St.syncTeamGroups(ev)) { App.commit('Pairing Team Stroke disesuaikan dengan anggota tim'); return; }
      const ri = Math.min(+(params[1] || 0), ev.config.rounds.length - 1);
      const rc = ev.config.rounds[ri];
      const r = St.data(ev).rounds[ri];

      // Ronde penyisihan berikutnya (tanpa cut) otomatis memakai pairing ronde sebelumnya.
      if (ri > 0 && !rc.cut && !r.groups.length && St.data(ev).rounds[ri - 1].groups.length) {
        St.generateGroups(ev, ri, 'copy');
        App.commit(`Pairing ${rc.name} sama dengan ${ev.config.rounds[ri - 1].name}`);
        return;
      }

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
        const tg = root.querySelector('#tg-box');
        if (tg) tg.innerHTML = App.teamGateTable(ev);
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
          const x = rowExtras(ev, ri, id);
          const j = root.querySelector(`[data-jumlah="${id}"]`);
          if (j) j.textContent = x.any ? x.jumlah : '';
          x.counts.forEach((n, k) => { const el = root.querySelector(`[data-cnt="${id}:${k}"]`); if (el) el.textContent = n; });
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
      const all = new Set([...St.participants(ev, ri), ...(ri === 0 ? St.units(ev) : [])]);
      ids = Array.from(all);
    }
    return `<p class="muted">Isi nomor pairing untuk tiap peserta (kosongkan untuk mengeluarkan dari ronde ini), lalu klik Terapkan.</p>
      <div class="manual-grid">${ids.map((id) => `<label class="mini"><span>${esc(App.entryLabel(App.entry(id)))}</span>
        <input class="tiny" type="number" min="1" data-mgroup="${id}" value="${groupOf[id] || ''}"></label>`).join('')}</div>
      <button class="btn sm" id="manual-apply">Terapkan</button>`;
  }
})(window.App);
