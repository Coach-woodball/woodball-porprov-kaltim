// Halaman Fairway: grup, klasemen, bagan, daftar pertandingan, input skor per pertandingan.
(function (App) {
  const esc = App.esc, Fw = App.fairway;

  const sideName = (id) => (id === 'BYE' ? 'BYE' : id ? App.entryLabel(App.entry(id)) : '<span class="muted">menunggu</span>');

  App.matchScoreText = (ev, r) => {
    if (r.status === 'bye') return 'BYE';
    if (r.status === 'none') return '';
    let t = `${r.sa} - ${r.sb}`;
    if (r.sd) t += ` (SD)`;
    return t;
  };

  App.standingsTable = (ev, g, opts = {}) => {
    const rows = Fw.standings(ev, g);
    const team = ev.kind === 'team';
    const editable = opts.editable && App.isAdmin();
    const manual = Fw.data(ev).manual[g.id] || {};
    return `<div class="table-wrap"><table class="rank"><thead><tr><th>#</th><th>Nama</th><th>Kab/Kota</th><th>Main</th><th>Menang</th><th>Kalah</th>
      <th title="${team ? 'Partai menang' : 'Point Menang'}">PM</th><th title="${team ? 'Partai kalah' : 'Point Kalah'}">PK</th><th title="Selisih">SK</th>${team ? '<th title="Selisih poin gate">SG</th>' : ''}<th>Poin</th>${editable ? '<th>Manual</th>' : ''}</tr></thead><tbody>
      ${rows.map((r) => { const e = App.entry(r.entryId); return `<tr><td class="c"><b>${r.rank}</b>${r.tied ? ' <span class="pill warn">=</span>' : ''}</td><td>${esc(App.entryName(e))}</td><td>${esc(App.kShort(e?.kontingenId))}</td>
        <td class="c">${r.main}</td><td class="c">${r.menang}</td><td class="c">${r.kalah}</td><td class="c">${r.pm}</td><td class="c">${r.pk}</td><td class="c">${r.sk}</td>${team ? `<td class="c">${r.gp}</td>` : ''}<td class="c big">${r.poin}</td>
        ${editable ? `<td><input class="tiny" type="number" data-gmanual="${g.id}:${r.entryId}" value="${manual[r.entryId] ?? ''}"></td>` : ''}</tr>`; }).join('')}
      </tbody></table></div><p class="muted small">PM: Point Menang · PK: Point Kalah · SK: Selisih Kemenangan. Urutan: Poin → SK${team ? ' → SG' : ''} → PM → manual.</p>`;
  };

  App.matchListHtml = (ev, matches, link) => `<div class="table-wrap"><table class="matches"><thead><tr><th>Babak</th><th>Peserta 1</th><th>Skor</th><th>Peserta 2</th><th>Status</th>${link ? '<th></th>' : ''}</tr></thead><tbody>
    ${matches.map((m) => {
      const r = Fw.matchResult(ev, m);
      if (r.a === 'BYE' && r.b === 'BYE') return '';
      return `<tr><td class="small">${esc(Fw.stageLabel(ev, m))}${m.lane ? ` · Lap. ${esc(m.lane)}` : ''}${m.time ? ` · ${esc(m.time)}` : ''}</td>
        <td class="${r.winner === 'a' ? 'win' : ''}">${sideName(r.a)}</td><td class="c big">${App.matchScoreText(ev, r)}</td>
        <td class="${r.winner === 'b' ? 'win' : ''}">${sideName(r.b)}</td><td>${App.ui.statusPill(r.status)}</td>
        ${link ? `<td>${r.a && r.b && r.status !== 'bye' ? `<a class="btn sm" href="#/match/${ev.id}/${m.id}">Input</a>` : ''}</td>` : ''}</tr>`;
    }).join('')}</tbody></table></div>`;

  App.bracketHtml = (ev, link) => {
    const rounds = Fw.koRounds(ev);
    if (!rounds.length) return App.ui.empty('Bagan belum dibuat.');
    const third = Fw.data(ev).matches.find((m) => m.stage === 'third');
    const box = (m) => {
      const r = Fw.matchResult(ev, m);
      const nm = (id) => (id === 'BYE' ? '<i>BYE</i>' : id ? `${esc(App.entryName(App.entry(id)))} <small>${esc(App.kShort(App.entry(id)?.kontingenId))}</small>` : '<span class="muted">…</span>');
      const sc = (s) => (r.status === 'none' || r.status === 'bye' ? '' : s);
      const inner = `<div class="bm-row ${r.winner === 'a' ? 'win' : ''}"><span>${nm(r.a)}</span><b>${sc(r.sa)}</b></div>
        <div class="bm-row ${r.winner === 'b' ? 'win' : ''}"><span>${nm(r.b)}</span><b>${sc(r.sb)}</b></div>
        ${r.sd ? `<div class="bm-sd">Sudden death PK${r.sd}</div>` : ''}`;
      const can = link && r.a && r.b && r.status !== 'bye';
      // data-src: pertandingan asal pemenang (untuk garis + panah penghubung)
      const src = m.stage === 'ko' && m.srcA ? `data-src="${m.srcA.m},${m.srcB.m}"` : '';
      const attrs = `data-m="${m.id}" ${src}`;
      return can ? `<a class="bm" ${attrs} href="#/match/${ev.id}/${m.id}">${inner}</a>` : `<div class="bm" ${attrs}>${inner}</div>`;
    };
    const fin = rounds[rounds.length - 1][0];
    return `<div class="bracket-wrap"><div class="bracket">${rounds.map((ms, ci) => `<div class="bcol" style="--i:${ci}"><div class="bhead">${esc(Fw.roundName(ms.length))}</div><div class="bbody">${ms.map(box).join('')}</div></div>`).join('')}
      ${(() => { const pl = Fw.placements(ev).list.find((p) => p.rank === 1); return `<div class="bcol champ" style="--i:${rounds.length}"><div class="bhead">Juara</div><div class="bbody"><div class="bm champ-box ${pl ? 'won' : ''}" data-src="${fin.id}">${pl ? '<span class="trophy">🏆</span>' + esc(App.entryLabel(App.entry(pl.entryId))) : '<span class="muted">…</span>'}</div></div></div>`; })()}
      </div></div>${third ? `<div class="third"><div class="bhead">Perebutan Juara 3</div>${box(third)}</div>` : ''}`;
  };

  // Gambar garis siku + panah dari tiap pertandingan ke babak berikutnya.
  App.drawBrackets = (root = document) => {
    const all = root.querySelectorAll('.bracket');
    all.forEach((br) => {
      br.querySelector(':scope > svg.blines')?.remove();
      const base = br.getBoundingClientRect();
      if (!base.width) return;
      const scale = base.width / br.offsetWidth || 1;
      const pos = (el) => {
        const r = el.getBoundingClientRect();
        return { l: (r.left - base.left) / scale, r: (r.right - base.left) / scale, y: (r.top + r.height / 2 - base.top) / scale };
      };
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'blines');
      svg.setAttribute('width', br.scrollWidth);
      svg.setAttribute('height', br.scrollHeight);
      const mid = 'arw' + Math.random().toString(36).slice(2, 7);
      svg.innerHTML = `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrow-head"/></marker></defs>`;
      br.querySelectorAll('[data-src]').forEach((to) => {
        const t = pos(to);
        to.dataset.src.split(',').forEach((id) => {
          const from = br.querySelector(`[data-m="${id}"]`);
          if (!from) return;
          const f = pos(from);
          const x = f.r + (t.l - f.r) / 2;
          const won = from.querySelector('.bm-row.win') ? ' won' : '';
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', `M${f.r} ${f.y} H${x} V${t.y} H${t.l - 2}`);
          p.setAttribute('class', 'bline' + won);
          p.setAttribute('marker-end', `url(#${mid})`);
          p.setAttribute('pathLength', '1');
          p.style.setProperty('--d', (Array.prototype.indexOf.call(br.children, to.closest('.bcol')) * 0.45 + 0.25) + 's');
          svg.appendChild(p);
        });
      });
      br.prepend(svg);
      if (App.flash === 'bracket') {
        br.classList.add('anim');
        setTimeout(() => br.classList.remove('anim'), 4000);
      }
    });
    if (all.length && App.flash === 'bracket') App.flash = null;
  };
  window.addEventListener('resize', () => App.drawBrackets());
  window.addEventListener('beforeprint', () => App.drawBrackets());

  App.views.fairway = {
    admin: true,
    render(params) {
      const evs = App.S.events.filter((e) => e.discipline === 'fairway');
      const ev = App.event(params[0]) || evs[0];
      if (!ev) return App.ui.empty('Belum ada nomor fairway.');
      const d = Fw.data(ev), c = ev.config;
      const entries = App.entriesOf(ev.id);
      let html = `<h2>${esc(App.S.menu.fairway)}</h2>${App.ui.eventTabs('fairway', ev.id, 'fairway')}
        <div class="card"><div class="row between wrap"><div><h3>${esc(ev.name)}</h3>
        <p class="muted">${entries.length} entri · ${esc(Fw.FORMATS[c.format])}${c.format === 'group_ko' ? ` · ${c.groupCount} grup, ${c.qualify} lolos/grup` : ''} · ${c.gates} gate · ${esc(Fw.THIRD[c.thirdPlace])}${ev.kind === 'team' ? ` · ${c.games.map((g) => esc(g.label)).join(', ')}` : ''}
        · <a href="#/events/${ev.id}">ubah aturan</a></p></div>
        <div class="row gap wrap"><a class="btn sm ghost" href="#/print/scorecard-fairway/${ev.id}">🖨️ Score card</a><a class="btn sm ghost" href="#/print/bracket/${ev.id}">🖨️ Bagan</a><a class="btn sm ghost" href="#/print/result/${ev.id}">🖨️ Hasil resmi</a></div></div>`;
      if (c.format === 'ko') {
        const seeds = d.seeds.filter((id) => App.entry(id));
        const missing = entries.filter((e) => !seeds.includes(e.id)).map((e) => e.id);
        const list = seeds.concat(missing);
        html += `<h4>Urutan unggulan (seed) untuk bagan</h4><p class="muted small">Seed 1 & 2 dipisah di sisi bagan berbeda. Gunakan ↑↓ untuk mengatur manual, atau acak.</p>
          <ol class="seeds">${list.map((id, i) => `<li>${esc(App.entryLabel(App.entry(id)))} <button class="btn sm ghost" data-seed-up="${i}">↑</button><button class="btn sm ghost" data-seed-down="${i}">↓</button></li>`).join('')}</ol>
          <div class="row gap"><button class="btn sm ghost" id="seed-random">🎲 Acak seed</button><button class="btn sm" id="ko-build">Buat bagan</button></div>`;
      } else {
        html += `<div class="row gap wrap"><button class="btn sm" data-ggen="random">🎲 Undi grup acak</button><button class="btn sm ghost" data-ggen="order">↕ Urut daftar</button>
          <button class="btn sm ghost" id="gmanual-toggle">✋ Atur manual</button>
          ${c.format === 'group_ko' && d.groups.length ? '<button class="btn sm" id="ko-from-groups">➜ Buat bagan dari hasil grup</button>' : ''}</div>
          <div id="gmanual" class="hidden">${groupManual(ev)}</div>`;
      }
      html += '</div>';

      d.groups.forEach((g) => {
        html += `<div class="card"><div class="row between"><h3>Grup ${esc(g.name)}</h3>${Fw.groupDone(ev, g.id) ? '<span class="pill ok">Grup selesai</span>' : ''}</div>
          ${App.standingsTable(ev, g, { editable: true })}${App.matchListHtml(ev, Fw.groupMatches(ev, g.id), true)}</div>`;
      });
      if (Fw.koMatches(ev).length) {
        html += `<div class="card"><h3>Bagan</h3>${App.bracketHtml(ev, true)}<h4>Daftar pertandingan bagan</h4>${App.matchListHtml(ev, Fw.koMatches(ev), true)}</div>`;
      }
      return html;
    },
    mount(root, params) {
      const evs = App.S.events.filter((e) => e.discipline === 'fairway');
      const ev = App.event(params[0]) || evs[0];
      if (!ev) return;
      const d = Fw.data(ev);
      const lab = (id) => (id === 'BYE' ? 'BYE' : App.entryLabel(App.entry(id)));
      // Tampilkan undian babak pertama, lalu gambar bagan dengan animasi masuk.
      const animKO = (msg) => {
        App.save(true);
        const r1 = Fw.koRounds(ev)[0] || [];
        return App.drawAnimation({
          title: `Bagan Gugur · ${ev.name}`, sub: Fw.roundName(r1.length),
          boxes: r1.map((m, i) => { const r = Fw.matchResult(ev, m); return { label: 'Partai ' + (i + 1), items: [lab(r.a), lab(r.b)] }; }),
        }).then(() => { App.flash = 'bracket'; App.commit(msg); });
      };
      const hasScores = () => d.matches.some((m) => Fw.matchResult(ev, m).status === 'done' || Fw.matchResult(ev, m).status === 'live');
      root.querySelectorAll('[data-ggen]').forEach((b) => b.addEventListener('click', () => {
        if (d.groups.length && !confirm(hasScores() ? 'PERHATIAN: sudah ada skor. Undi ulang akan MENGHAPUS semua pertandingan grup & skornya. Lanjut?' : 'Undi ulang grup?')) return;
        Fw.generateGroups(ev, b.dataset.ggen, ev.config.format === 'rr' ? 1 : ev.config.groupCount);
        if (b.dataset.ggen !== 'random') return App.commit('Grup & jadwal dibuat');
        App.save(true);
        App.drawAnimation({ title: `Undian Grup · ${ev.name}`, boxes: d.groups.map((g) => ({ label: 'Grup ' + g.name, items: g.entryIds.map(lab) })) })
          .then(() => App.commit('Grup & jadwal dibuat'));
      }));
      root.querySelector('#gmanual-toggle')?.addEventListener('click', () => root.querySelector('#gmanual').classList.toggle('hidden'));
      root.querySelector('#gmanual-apply')?.addEventListener('click', () => {
        if (hasScores() && !confirm('Menerapkan grup manual akan membuat ulang jadwal grup dan MENGHAPUS skor grup. Lanjut?')) return;
        const n = ev.config.format === 'rr' ? 1 : Math.max(1, ev.config.groupCount);
        const groups = Array.from({ length: n }, (_, i) => ({ id: App.uid('gr_'), name: String.fromCharCode(65 + i), entryIds: [] }));
        root.querySelectorAll('[data-gsel]').forEach((sel) => { const gi = App.num(sel.value); if (gi != null && groups[gi]) groups[gi].entryIds.push(sel.dataset.gsel); });
        d.groups = groups.filter((g) => g.entryIds.length);
        Fw.createGroupMatches(ev);
        App.commit('Grup manual diterapkan');
      });
      root.querySelectorAll('[data-gmanual]').forEach((inp) => inp.addEventListener('change', () => {
        const [gid, eid] = inp.dataset.gmanual.split(':');
        d.manual[gid] = d.manual[gid] || {};
        const v = App.num(inp.value);
        if (v == null) delete d.manual[gid][eid]; else d.manual[gid][eid] = v;
        App.commit();
      }));
      root.querySelector('#ko-from-groups')?.addEventListener('click', () => {
        const notDone = d.groups.filter((g) => !Fw.groupDone(ev, g.id));
        if (notDone.length && !confirm(`Grup ${notDone.map((g) => g.name).join(', ')} belum selesai. Tetap buat bagan dari klasemen sementara?`)) return;
        if (Fw.koMatches(ev).length && !confirm('Bagan lama beserta skornya akan diganti. Lanjut?')) return;
        Fw.buildKO(ev, Fw.groupSeeds(ev));
        animKO('Bagan dibuat');
      });
      const seedList = () => {
        const entries = App.entriesOf(ev.id).map((e) => e.id);
        const s = d.seeds.filter((id) => entries.includes(id));
        return s.concat(entries.filter((id) => !s.includes(id)));
      };
      root.querySelectorAll('[data-seed-up],[data-seed-down]').forEach((b) => b.addEventListener('click', () => {
        const list = seedList();
        const i = +(b.dataset.seedUp ?? b.dataset.seedDown);
        const j = b.dataset.seedUp !== undefined ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        d.seeds = list;
        App.commit();
      }));
      root.querySelector('#seed-random')?.addEventListener('click', () => {
        d.seeds = App.stroke.spreadOrder(seedList());
        App.save(true);
        App.drawAnimation({ title: `Acak Seed · ${ev.name}`, boxes: [{ label: 'Urutan seed', items: d.seeds.map((id, i) => `${i + 1}. ${lab(id)}`) }] })
          .then(() => App.commit('Seed diacak'));
      });
      root.querySelector('#ko-build')?.addEventListener('click', () => {
        if (Fw.koMatches(ev).length && !confirm('Bagan lama beserta skornya akan diganti. Lanjut?')) return;
        d.seeds = seedList();
        Fw.buildKO(ev, d.seeds);
        animKO('Bagan dibuat');
      });
    },
  };

  function groupManual(ev) {
    const d = Fw.data(ev);
    const n = ev.config.format === 'rr' ? 1 : Math.max(1, ev.config.groupCount);
    const gOf = {};
    d.groups.forEach((g, i) => g.entryIds.forEach((id) => (gOf[id] = i)));
    const opts = Array.from({ length: n }, (_, i) => [i, 'Grup ' + String.fromCharCode(65 + i)]);
    return `<div class="manual-grid">${App.entriesOf(ev.id).map((e) => `<label class="mini"><span>${esc(App.entryLabel(e))}</span>
      <select data-gsel="${e.id}"><option value="">-</option>${App.ui.options(opts, gOf[e.id] ?? '')}</select></label>`).join('')}</div>
      <button class="btn sm" id="gmanual-apply">Terapkan grup</button>`;
  }

  // ---------- Input skor pertandingan ----------
  function gameBlock(ev, m, r, gi) {
    const g = m.games[gi];
    const gr = r.games[gi] || Fw.gameResult(ev, g);
    const N = ev.config.gates;
    const extraN = Math.max(3, (g.extra || []).length + (gr.status === 'sd' ? 1 : 0));
    const cells = (side) => Array.from({ length: N }, (_, i) => {
      const [x, y] = g.gates[i] || [];
      const v = side === 0 ? x : y;
      const win = x != null && y != null && x !== '' && y !== '' && (side === 0 ? +x < +y : +y < +x);
      return `<td class="${win ? 'gw' : ''}"><input class="sc" inputmode="numeric" maxlength="2" data-g="${gi}:${i}:${side}" value="${v ?? ''}"></td>`;
    }).join('') + Array.from({ length: extraN }, (_, i) => {
      const [x, y] = (g.extra || [])[i] || [];
      const v = side === 0 ? x : y;
      return `<td class="sdc"><input class="sc" inputmode="numeric" maxlength="2" data-x="${gi}:${i}:${side}" value="${v ?? ''}"></td>`;
    }).join('');
    const nameA = Fw.gamePlayers(ev, r.a, g), nameB = Fw.gamePlayers(ev, r.b, g);
    return `<div class="card game" data-gi="${gi}">
      <div class="row between wrap"><h3>${g.label ? esc(g.label) + ' · ' : ''}<span data-gres="${gi}">${gr.pa} - ${gr.pb}</span> ${App.ui.statusPill(gr.status)}</h3>
        <label class="mini">Pemenang manual / WO<select data-gov="${gi}">${App.ui.options([['', 'Otomatis dari skor'], ['a', 'Menang: ' + nameA], ['b', 'Menang: ' + nameB]], g.override || '')}</select></label></div>
      <div class="table-wrap"><table class="score"><thead><tr><th class="name">Nama</th>${Array.from({ length: N }, (_, i) => `<th>${i + 1}</th>`).join('')}${Array.from({ length: extraN }, (_, i) => `<th class="sdc">PK${i + 1}</th>`).join('')}</tr></thead>
      <tbody><tr><td class="name"><b>${esc(nameA)}</b><small>${esc(App.kShort(App.entry(r.a)?.kontingenId))}</small></td>${cells(0)}</tr>
      <tr><td class="name"><b>${esc(nameB)}</b><small>${esc(App.kShort(App.entry(r.b)?.kontingenId))}</small></td>${cells(1)}</tr></tbody></table></div>
      <p class="muted small">Isi jumlah pukulan tiap gate. Pukulan lebih sedikit = menang gate (nilai 1). PK = sudden death setelah gate ${N}. Pertandingan otomatis selesai jika sudah tidak terkejar.</p>
      ${App.ui.scanBlock(g.scans, String(gi))}
    </div>`;
  }

  App.views.match = {
    admin: true,
    render(params) {
      const ev = App.event(params[0]);
      const m = ev && Fw.match(ev, params[1]);
      if (!m) return App.ui.empty('Pertandingan tidak ditemukan.');
      const r = Fw.matchResult(ev, m);
      const winnerName = r.winnerId ? App.entryLabel(App.entry(r.winnerId)) : '';
      return `<p><a href="#/fairway/${ev.id}">← ${esc(ev.name)}</a></p>
        <div class="card"><div class="row between wrap"><div><h2>${esc(ev.name)} · ${esc(Fw.stageLabel(ev, m))}</h2>
          <p class="lead">${esc(App.entryLabel(App.entry(r.a)))} <b>vs</b> ${esc(App.entryLabel(App.entry(r.b)))}</p></div>
          <div class="result-box"><div class="big" id="m-score">${App.matchScoreText(ev, r) || '0 - 0'}</div><div id="m-win">${winnerName ? '🏆 ' + esc(winnerName) : App.ui.statusPill(r.status)}</div></div></div>
          <div class="grid4">
            <label>Tanggal<input type="date" data-mf="date" value="${esc(m.date || '')}"></label>
            <label>Jam<input data-mf="time" value="${esc(m.time || '')}" placeholder="08.00"></label>
            <label>Lapangan<input data-mf="lane" value="${esc(m.lane || '')}"></label>
            <label>Catatan<input data-mf="note" value="${esc(m.note || '')}"></label>
          </div>
          ${ev.kind === 'team' ? `<label class="mini">Pemenang pertandingan (manual)<select data-mov="1">${App.ui.options([['', 'Otomatis (best of ' + m.games.length + ')'], ['a', App.entryName(App.entry(r.a))], ['b', App.entryName(App.entry(r.b))]], m.override || '')}</select></label>` : ''}
          <div class="row gap"><a class="btn sm ghost" href="#/print/scorecard-fairway/${ev.id}/${m.id}">🖨️ Score card</a></div>
        </div>
        ${m.games.map((_, gi) => gameBlock(ev, m, r, gi)).join('')}`;
    },
    mount(root, params) {
      const ev = App.event(params[0]);
      const m = ev && Fw.match(ev, params[1]);
      if (!m) return;
      root.querySelectorAll('[data-mf]').forEach((inp) => inp.addEventListener('change', () => { m[inp.dataset.mf] = inp.value; App.save(); }));
      root.querySelector('[data-mov]')?.addEventListener('change', (e) => { m.override = e.target.value || null; App.commit(); });
      root.querySelectorAll('[data-gov]').forEach((sel) => sel.addEventListener('change', () => { m.games[+sel.dataset.gov].override = sel.value || null; App.commit(); }));
      // Urutan isi: gate per gate (pemain 1 lalu pemain 2), sesuai cara wasit mencatat.
      const keyOf = (inp) => {
        const [gi, i, side] = (inp.dataset.g || inp.dataset.x).split(':').map(Number);
        return gi * 100000 + (inp.dataset.x ? 50000 : 0) + i * 10 + side;
      };
      const inputs = Array.from(root.querySelectorAll('input.sc')).sort((a, b) => keyOf(a) - keyOf(b));
      const refresh = () => {
        const r = Fw.matchResult(ev, m);
        root.querySelector('#m-score').textContent = App.matchScoreText(ev, r) || '0 - 0';
        root.querySelector('#m-win').innerHTML = r.winnerId ? '🏆 ' + esc(App.entryLabel(App.entry(r.winnerId))) : App.ui.statusPill(r.status);
        r.games.forEach((gr, gi) => { const el = root.querySelector(`[data-gres="${gi}"]`); if (el) el.textContent = `${gr.pa} - ${gr.pb}`; });
        // tandai gate yang dimenangkan
        m.games.forEach((g, gi) => g.gates.forEach((pair, i) => {
          [0, 1].forEach((side) => {
            const td = root.querySelector(`[data-g="${gi}:${i}:${side}"]`)?.parentElement;
            if (!td || !pair) return;
            const [x, y] = pair;
            const ok = x != null && y != null && x !== '' && y !== '';
            td.classList.toggle('gw', ok && (side === 0 ? +x < +y : +y < +x));
          });
        }));
      };
      inputs.forEach((inp, idx) => {
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('input', () => {
          inp.value = inp.value.replace(/\D/g, '');
          const v = App.num(inp.value);
          const key = inp.dataset.g || inp.dataset.x;
          const [gi, i, side] = key.split(':').map(Number);
          const g = m.games[gi];
          const arr = inp.dataset.g ? g.gates : (g.extra = g.extra || []);
          arr[i] = arr[i] || [null, null];
          arr[i][side] = v;
          refresh();
          App.save();
        });
        inp.addEventListener('change', () => {
          // render ulang bila status berubah (mis. masuk sudden death) agar kolom PK bertambah
          const r = Fw.matchResult(ev, m);
          const full = r.games.some((x, gi) => {
            if (x.status !== 'sd') return false;
            const shown = root.querySelectorAll(`[data-x^="${gi}:"]`).length / 2;
            const filled = (m.games[gi].extra || []).filter((p) => p && p[0] != null && p[1] != null).length;
            return filled >= shown;
          });
          if (full) App.rerender();
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && inputs[idx + 1]) { e.preventDefault(); inputs[idx + 1].focus(); }
        });
      });
      App.bindScans(root, (key) => {
        const g = m.games[+key];
        g.scans = g.scans || [];
        return g.scans;
      });
    },
  };
})(window.App);
