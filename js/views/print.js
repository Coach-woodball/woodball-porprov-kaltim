// Dokumen cetak A4 landscape: score card, hasil resmi, bagan, sertifikat, rekap medali, daftar peserta.
// Cetak lewat dialog browser -> pilih "Simpan sebagai PDF" atau printer.
(function (App) {
  const esc = App.esc, St = App.stroke, Fw = App.fairway;
  const opts = { filled: true, date: '', certType: 'juara', layout: 'sheet', bw: null };
  // Hitam putih mengikuti mode angka gate di layar sampai dipilih sendiri di halaman cetak.
  const printBw = () => (opts.bw ?? App.scoreMode() === 'neutral');

  const DOCS = {
    'scorecard-stroke': 'Score Card Stroke',
    'scorecard-fairway': 'Score Card Fairway',
    'schedule-fairway': 'Jadwal Pertandingan Fairway',
    result: 'Hasil Resmi',
    bracket: 'Bagan & Klasemen Grup',
    certificates: 'Sertifikat / Piagam',
    medalreport: 'Laporan Resmi Perolehan Medali',
    medals: 'Rekap Medali per Kab/Kota',
    athletes: 'Daftar Peserta per Kontingen',
  };

  function kop(title, sub) {
    const E = App.S.event;
    const logos = (E.logos || []).map((id) => App.files.url(id)).filter(Boolean);
    const half = Math.ceil(logos.length / 2);
    const img = (u) => `<img src="${u}" alt="">`;
    return `<div class="kop"><div class="kl">${logos.slice(0, half).map(img).join('')}</div>
      <div class="kc"><div class="k1">${esc(E.title)}</div><div class="k2">${esc(E.sport)} ${esc(E.region)}</div>
      <div class="k3">${esc(App.fmtDateRange(E.dateStart, E.dateEnd))} · ${esc(E.venue)}, ${esc(E.city)}</div></div>
      <div class="kr">${logos.slice(half).map(img).join('')}</div></div>
      ${title ? `<div class="doc-title">${esc(title)}</div>` : ''}${sub ? `<div class="doc-sub">${sub}</div>` : ''}`;
  }

  const signDate = () => `${esc(App.S.event.city)}, ${esc(App.fmtDate(opts.date || App.today()))}`;
  const signBox = (title, name, withDate) => `<div class="sign">${withDate ? `<div>${signDate()}</div>` : ''}<div>${esc(title)}</div><div class="sign-space"></div><div class="sign-name">${esc(name || '(....................................)')}</div></div>`;

  // ---------- Score card format panitia (meniru SC STROKE.xlsx / SC FAIRWAY.xlsx) ----------
  // Tiap gate: 1 kotak skor + kotak angka 1-9 untuk mencoret jumlah pukulan.
  const bx = (on, label) => `<span class="xb${on ? ' on' : ''}">${on ? '✓' : ''}</span>${esc(label)}`;
  const boxes = (list, cur) => list.map(([k, l]) => bx(k === cur, l)).join('');
  const dots = (v) => (v ? `<b>${esc(v)}</b>` : '<span class="xdots"></span>');
  const laneList = () => String(App.S.event.lanes || 'A, B').split(',').map((s) => s.trim()).filter(Boolean);
  const laneBoxes = (lane) => {
    const ls = laneList();
    const on = ls.find((l) => l.toLowerCase() === String(lane || '').trim().toLowerCase());
    return boxes(ls.map((l) => [l, l]), on) + (lane && !on ? ` <b>${esc(lane)}</b>` : '');
  };
  function scKop(title) {
    const E = App.S.event;
    const logos = (E.logos || []).map((id) => App.files.url(id)).filter(Boolean);
    const left = logos.length > 1 ? logos.slice(0, -1) : logos, right = logos.length > 1 ? logos.slice(-1) : [];
    const img = (u) => `<img src="${u}" alt="">`;
    return `<div class="xk"><div class="xl">${left.map(img).join('')}</div>
      <div class="xc"><div class="x1">${esc(E.title)}</div><div class="x2">${esc(E.sport)} ${esc(E.region)}</div>
      <div class="x3">${esc(App.fmtDateRange(E.dateStart, E.dateEnd))}  ·  ${esc([E.venue, E.city].filter(Boolean).join(', '))}</div></div>
      <div class="xr">${right.map(img).join('')}</div></div>
      <div class="xt">${esc(title)}</div>`;
  }
  const scFoot = () => `<div class="xf">${esc(App.S.event.organizer || '')}</div>`;
  const scSign = (label, sub, name) => `<div class="xs"><div class="xs-name">${esc(name || '')}</div><div class="xs-l">${esc(label)}</div><div class="xs-s">${esc(sub)}</div></div>`;
  // Baris angka 1-9 (3 baris x 3 kolom per gate).
  const tallyRows = (nGates, tail = []) => [0, 1, 2].map((r) => `<tr class="xn">${Array.from({ length: nGates }, () => [1, 2, 3].map((c) => `<td class="${c === 1 ? 'gl' : ''}">${r * 3 + c}</td>`).join('')).join('')}${tail[r] || ''}</tr>`).join('');
  const gateCols = (n) => Array.from({ length: n * 3 }, () => '<col class="sub">').join('');

  // ---------- Score card stroke (1 halaman per pairing) ----------
  function strokeCard(ev, ri, g) {
    const rc = ev.config.rounds[ri];
    const N = rc.gates;
    const dbl = ev.kind === 'double';
    const size = Math.max(ev.config.groupSize || (dbl ? 2 : 4), g.entryIds.length);
    const rows = Array.from({ length: size }, (_, i) => g.entryIds[i] || null);
    const filled = opts.filled;
    const short = (n) => n.replace(/^Penyisihan\s*/i, '').replace(/^Ronde\s*/i, 'R');
    const cat = dbl ? boxes([['d', 'Double Stroke'], ['x', 'Mix Double Stroke']], ev.gender === 'X' ? 'x' : 'd')
      : boxes([['s', 'Single Stroke'], ['t', 'Team Stroke']], ev.kind === 'team' ? 't' : 's');
    const gender = boxes([['L', 'Putra'], ['P', 'Putri'], ...(dbl ? [['X', 'Mix']] : [])], ev.gender);
    const body = rows.map((id, i) => {
      const e = id && App.entry(id);
      const sc = id ? St.score(ev, ri, id) : { g: [], ob: 0 };
      const s = St.sumScore(sc, N);
      const names = e ? (dbl ? e.members.filter(Boolean).map(App.athName) : [App.entryName(e)]) : [];
      const nm = e ? `${names.map((n) => `<div class="xnm">${esc(n)}</div>`).join('')}<div class="xkt">${esc(App.kName(e.kontingenId))}</div>` : '';
      const cells = Array.from({ length: N }, (_, gi) => {
        const v = filled ? sc.g[gi] : null;
        return `<td class="xv gl" colspan="3">${v != null && v !== '' ? esc(v) : ''}</td>`;
      }).join('');
      const pen = filled && sc.ob ? sc.ob : '';
      return `<tr class="xp"><td class="xno" rowspan="4">${i + 1}</td><td class="xname" rowspan="4">${nm}</td>${cells}<td class="xtot" rowspan="3">${filled && s.played ? s.sum : ''}</td></tr>
        ${tallyRows(N, ['', '', `<td class="xpen">Penalty : ${pen}</td>`])}`;
    }).join('');
    const signs = rows.map((id, i) => scSign(`${dbl ? 'PAIR' : 'PLAYER'} No. ${i + 1}`, dbl ? 'Player Signature' : 'Signature', id ? App.entryName(App.entry(id)) : '')).join('') + scSign('REFEREE', 'Signature', '');
    return `<section class="page xsc${dbl ? ' dbl' : ''}">${scKop(`STROKE COMPETITION SCORE CARD  ·  ${dbl ? 'DOUBLE / MIX DOUBLE STROKE' : 'SINGLE STROKE'}`)}
      <div class="xi">
        <div><span class="xlab">Category :</span>${cat}</div>
        <div><span class="xlab">Round :</span>${boxes(ev.config.rounds.map((r, k) => [k, short(r.name)]), ri)}</div>
        <div><span class="xlab">Pairing :</span><b>${g.no}</b></div>
        <div><span class="xlab">Gender :</span>${gender}</div>
        <div><span class="xlab">Lane :</span>${laneBoxes(g.lane)}</div>
        <div><span class="xlab">Date :</span>${dots(g.date ? App.fmtDate(g.date) : '')}<span class="xlab">Time :</span>${dots(g.time)}</div>
      </div>
      <table class="xg"><colgroup><col class="cno"><col class="cname">${gateCols(N)}<col class="ctot"></colgroup>
        <thead><tr><th>NO</th><th>NAME</th>${Array.from({ length: N }, (_, i) => `<th class="gl" colspan="3">GATE ${i + 1}</th>`).join('')}<th class="gl">TOTAL SCORE</th></tr></thead>
        <tbody><tr class="xpar"><td class="xparl" colspan="2">PAR</td>${Array.from({ length: N }, () => '<td class="gl" colspan="3"></td>').join('')}<td class="gl"></td></tr>${body}</tbody></table>
      <div class="xsg">${signs}</div>${scFoot()}
    </section>`;
  }

  // ---------- Rekap score card stroke: semua pairing dalam 1 halaman ----------
  // Tinggi baris & font menyesuaikan jumlah peserta. Kalau terlalu banyak (>40 baris),
  // dipecah per halaman tanpa memotong pairing.
  function strokeSheet(ev, ri, groups) {
    const rc = ev.config.rounds[ri];
    const E = App.S.event;
    const filled = opts.filled;
    const MAX_ROWS = 40;
    const pages = [[]];
    groups.forEach((g) => {
      const cur = pages[pages.length - 1];
      const n = cur.reduce((s, x) => s + x.entryIds.length, 0);
      if (n && n + g.entryIds.length > MAX_ROWS) pages.push([g]); else cur.push(g);
    });
    const ketua = E.signers.find((s) => /ketua/i.test(s.title)) || E.signers[0] || { title: 'Ketua Panitia', name: '' };
    // lebar total ±277mm; sisakan ±55mm untuk kolom nama
    const gateW = Math.min(13, Math.max(6, 146 / rc.gates)).toFixed(1);
    return pages.map((gs, pi) => {
      const nRows = gs.reduce((s, g) => s + g.entryIds.length, 0) || 1;
      // ruang baris ±118mm (A4 lanskap dikurangi kop, judul, tanda tangan)
      const rowH = Math.max(2.9, Math.min(9, 118 / nRows));
      const font = Math.max(6.5, Math.min(11, rowH * 1.85));
      let no = 0;
      const body = gs.map((g) => g.entryIds.map((id, i) => {
        const e = App.entry(id);
        const sc = St.score(ev, ri, id);
        const s = St.sumScore(sc, rc.gates);
        no++;
        const cells = Array.from({ length: rc.gates }, (_, gi) => {
          const v = filled ? sc.g[gi] : null;
          return `<td class="c ${gi % 2 ? 'ga' : ''} ${v != null ? App.scoreCls(v) : ''}">${v != null ? v : ''}</td>`;
        }).join('');
        return `<tr class="${i === 0 ? 'pstart' : ''}">
          ${i === 0 ? `<td class="c pno" rowspan="${g.entryIds.length}">${g.no}${g.lane ? `<small>${esc(g.lane)}${g.time ? ' · ' + esc(g.time) : ''}</small>` : ''}</td>` : ''}
          <td class="c">${no}</td><td class="nm">${esc(App.entryName(e))}</td><td>${esc(App.kName(e?.kontingenId))}</td>${cells}
          <td class="c tot">${filled && s.played ? s.sum : ''}</td></tr>`;
      }).join('')).join('');
      return `<section class="page sheet" style="--rowh:${rowH.toFixed(2)}mm;--fs:${font.toFixed(1)}pt;--gw:${gateW}mm">${kop('STROKE COMPETITION SCORE CARD')}
        <div class="info"><span>Kategori: <b>${esc(ev.name)}</b></span><span>Ronde: <b>${esc(rc.name)}</b></span><span>Jumlah: <b>${gs.length} pairing · ${nRows} peserta</b></span>
          <span>Tempat: <b>${esc(E.venue)}</b></span>${pages.length > 1 ? `<span>Halaman <b>${pi + 1}/${pages.length}</b></span>` : ''}${filled ? `<span class="sv-legend">${[1, 2, 3, 4, 5].map((n) => `<i class="sv${n}">${n === 5 ? '5+' : n}</i>`).join('')}</span>` : ''}</div>
        <table class="pt sheet-table"><colgroup><col style="width:13mm"><col style="width:7mm"><col><col style="width:36mm">${Array.from({ length: rc.gates }, () => '<col style="width:var(--gw)">').join('')}<col style="width:12mm"></colgroup>
          <thead><tr><th>Pairing</th><th>No</th><th>Nama</th><th>Kab/Kota</th>${Array.from({ length: rc.gates }, (_, i) => `<th class="${i % 2 ? 'ga' : ''}">G${i + 1}</th>`).join('')}<th>Total</th></tr></thead>
          <tbody>${body}</tbody></table>
        <div class="signs end">${signBox(ketua.title, ketua.name, true)}</div>
      </section>`;
    }).join('');
  }

  // ---------- Rekap gabungan beberapa ronde (R1 + R2, atau R1 + R2 + Final) ----------
  // Satu baris per peserta: skor per gate tiap ronde, total tiap ronde, jumlah, dan angka kumulatif penyisihan.
  // Diurutkan menurut peringkat setelah penyisihan selesai; garis tebal menandai batas lolos ke ronde ber-cut.
  function strokeCombined(ev, ris) {
    const E = App.S.event;
    const rcs = ris.map((i) => ev.config.rounds[i]);
    const done = St.prelimDone(ev);
    const cutRc = ev.config.rounds.find((rc) => rc.cut);
    let rows = St.ranking(ev).filter((r) => r.played > 0 || St.inGroups(ev, 0).has(r.entry.id));
    if (!done) {
      const order = St.data(ev).rounds[0].groups.flatMap((g) => g.entryIds);
      const pos = (r) => { const i = order.indexOf(r.entry.id); return i < 0 ? 1e6 : i; };
      rows = rows.slice().sort((a, b) => pos(a) - pos(b));
    }
    const nGates = rcs.reduce((s, rc) => s + rc.gates, 0);
    // lebar isi ±273mm: Pos 8, Nama 34, Kab 16, total (ronde + jumlah) 8mm/kolom, angka kumulatif 5.5mm/kolom
    const fixed = 8 + 34 + 16 + (rcs.length + 1) * 8 + 5 * 5.5;
    const gateW = Math.max(3.6, Math.min(8, (273 - fixed) / nGates));
    const MAX_ROWS = 36;
    const chunks = [];
    for (let i = 0; i < rows.length; i += MAX_ROWS) chunks.push(rows.slice(i, i + MAX_ROWS));
    if (!chunks.length) chunks.push([]);
    const label = rcs.map((rc) => rc.name).join(' + ');
    const short = (n) => n.replace(/^Penyisihan\s*/i, '');
    return chunks.map((list, pi) => {
      const rowH = Math.max(3, Math.min(7.5, 112 / Math.max(list.length, 1)));
      const font = Math.max(6, Math.min(9.5, rowH * 1.7, gateW * 1.9));
      const body = list.map((r, idx) => {
        const n = pi * MAX_ROWS + idx;
        const cut = done && cutRc && n === cutRc.cut ? ' cutline' : '';
        const gates = ris.map((ri, k) => {
          const g = St.score(ev, ri, r.entry.id).g;
          return Array.from({ length: rcs[k].gates }, (_, gi) => {
            const v = g[gi];
            const has = v !== null && v !== undefined && v !== '';
            return `<td class="c${gi === 0 ? ' rs' : ''} ${has ? App.scoreCls(v) : ''}">${has ? v : ''}</td>`;
          }).join('');
        }).join('');
        const sums = ris.map((ri, k) => { const s = r.rounds[ri]; return `<td class="c${k ? '' : ' rs'}">${s && s.played ? s.sum : '-'}</td>`; }).join('');
        const tot = ris.reduce((s, ri) => s + (r.rounds[ri] ? r.rounds[ri].sum : 0), 0);
        return `<tr class="${cut.trim()}"><td class="c">${done && r.played ? r.rank : '-'}</td><td class="nm">${esc(App.entryName(r.entry))}</td><td>${esc(App.kShort(r.entry.kontingenId))}</td>
          ${gates}${sums}<td class="c tot">${r.played ? tot : '-'}</td>${App.countCells(St.counts(ris.flatMap((ri) => (r.rounds[ri] ? r.rounds[ri].gates : []))))}</tr>`;
      }).join('');
      return `<section class="page sheet combo" style="--rowh:${rowH.toFixed(2)}mm;--fs:${font.toFixed(1)}pt">${kop('STROKE COMPETITION · REKAP SKOR')}
        <div class="info"><span>Kategori: <b>${esc(ev.name)}</b></span><span>Ronde: <b>${esc(label)}</b></span><span>Peserta: <b>${rows.length}</b></span>
          <span>Tempat: <b>${esc(E.venue)}</b></span>${chunks.length > 1 ? `<span>Halaman <b>${pi + 1}/${chunks.length}</b></span>` : ''}
          <span>${done ? 'Urut menurut peringkat' : 'Penyisihan belum selesai: urut menurut pairing'}</span></div>
        <table class="pt sheet-table combo-table"><colgroup><col style="width:8mm"><col style="width:34mm"><col style="width:16mm">${Array.from({ length: nGates }, () => `<col style="width:${gateW.toFixed(2)}mm">`).join('')}${rcs.map(() => '<col style="width:8mm">').join('')}<col style="width:8mm">${Array.from({ length: 5 }, () => '<col style="width:5.5mm">').join('')}</colgroup>
          <thead>
            <tr><th rowspan="2">Pos</th><th rowspan="2">Nama</th><th rowspan="2">Kab</th>${rcs.map((rc) => `<th class="rs" colspan="${rc.gates}">${esc(rc.name)}</th>`).join('')}<th class="rs" colspan="${rcs.length + 1}">Total</th><th class="rs" colspan="5">Kumulatif ${esc(ris.map((i) => short(ev.config.rounds[i].name)).join('+'))}</th></tr>
            <tr>${rcs.map((rc) => Array.from({ length: rc.gates }, (_, gi) => `<th class="${gi === 0 ? 'rs' : ''}">${gi + 1}</th>`).join('')).join('')}${rcs.map((rc, k) => `<th class="${k ? '' : 'rs'}">${esc(short(rc.name))}</th>`).join('')}<th>Jml</th>${['1', '2', '3', '4', '5+'].map((l, i) => `<th class="${i ? '' : 'rs'}">${l}</th>`).join('')}</tr>
          </thead><tbody>${body}</tbody></table>
        <p class="note">${cutRc && done ? `Garis tebal: batas ${cutRc.cut} besar yang lolos ke ${esc(cutRc.name)}. ` : ''}Kumulatif: berapa kali skor 1, 2, 3, 4, dan 5+ muncul di ronde yang ditampilkan.</p>
        <div class="signs end">${signBox(E.resultSigner.title, E.resultSigner.name, true)}</div>
      </section>`;
    }).join('');
  }

  // ---------- Skor per gate Team Stroke (halaman sendiri, juga di Hasil Resmi) ----------
  function teamGatesPage(ev) {
    const E = App.S.event;
    const { ev: src, rounds: srcRounds } = St.teamSource(ev);
    const sr = srcRounds.map((i) => src && src.config.rounds[i]).filter(Boolean);
    return `<section class="page flow">${kop('SKOR PER GATE', esc(ev.name))}
      <div class="info">${ev.config.own ? '' : `<span>Sumber: <b>${esc(src ? src.name : '-')}</b></span>`}<span>Ronde: <b>${esc(sr.map((r) => r.name).join(' + '))}</b></span>
        <span>Dihitung: <b>${ev.config.own && ev.config.countBest >= 4 ? 'semua pemain' : ev.config.countBest + ' pemain terbaik per tim'}</b></span><span>Tempat: <b>${esc(E.venue)}</b></span></div>
      ${App.teamGateTable(ev, { print: true })}
      <p class="note">Jumlah tim per gate hanya dari pemain yang dihitung. Total tim = jumlah ${esc(sr.map((r) => r.name.replace(/^Penyisihan\s*/i, '')).join(' + '))} pemain yang dihitung.</p>
      <div class="signs end">${signBox(E.resultSigner.title, E.resultSigner.name, true)}</div>
    </section>`;
  }

  // ---------- Score card fairway (1 halaman per partai) ----------
  function fairwayCard(ev, m, gi) {
    const r = Fw.matchResult(ev, m);
    const g = m.games[gi];
    const gr = Fw.gameResult(ev, g);
    const N = ev.config.gates;
    const X = 3; // kotak extra / sudden death
    const filled = opts.filled;
    const team = ev.kind === 'team';
    const ids = [r.a, r.b];
    const val = (pair, side) => (filled && pair && pair[side] != null && pair[side] !== '' ? esc(pair[side]) : '');
    const won = (p) => (!filled || !p || p[0] == null || p[1] == null || p[0] === '' || p[1] === '' ? '' : +p[0] < +p[1] ? 'A' : +p[1] < +p[0] ? 'B' : '=');
    const all = [...Array.from({ length: N }, (_, i) => g.gates[i]), ...Array.from({ length: X }, (_, i) => (g.extra || [])[i])];
    const side = (s) => {
      const id = ids[s];
      const e = id && id !== 'BYE' ? App.entry(id) : null;
      const names = e ? Fw.gamePlayers(ev, id, g, m).split(' / ').map((x) => (x === '-' ? '' : x)) : [];
      const nm = e ? `${names.map((n) => `<div class="xnm">${n ? esc(n) : '<span class="xdots"></span>'}</div>`).join('')}<div class="xkt">${esc(App.kName(e.kontingenId))}</div>` : '';
      const cells = all.map((p, i) => `<td class="xv gl${i === N ? ' gx' : ''}" colspan="3">${val(p, s)}</td>`).join('');
      return `<tr class="xp"><td class="xno" rowspan="4">${s ? 'B' : 'A'}</td><td class="xname" rowspan="4">${nm}</td>${cells}<td class="xtot" rowspan="4">${filled && gr.played ? (s ? gr.pb : gr.pa) : ''}</td></tr>${tallyRows(N + X)}`;
    };
    const stage = m.stage === 'group' ? 'g' : m.stage === 'third' ? '3' : Fw.stageLabel(ev, m);
    const grpName = m.stage === 'group' ? (Fw.data(ev).groups.find((x) => x.id === m.group) || {}).name || '' : '';
    const stageBoxes = `${bx(stage === 'g', 'Group')} ${grpName ? `<b>${esc(grpName)}</b>${m.round ? ` <small>(Putaran ${m.round})</small>` : ''}` : '<span class="xdots s"></span>'}`
      + boxes([['Semifinal', 'Semifinal'], ['3', '3rd Place'], ['Final', 'Final']], stage)
      + (!['g', '3', 'Semifinal', 'Final'].includes(stage) ? ` <b>${esc(stage)}</b>` : '');
    const cat = boxes([['single', 'Single Fairway'], ['double', 'Double Fairway'], ['mix', 'Mix Double Fairway'], ['team', 'Team Fairway']], ev.kind === 'double' && ev.gender === 'X' ? 'mix' : ev.kind);
    const signName = (s) => (ids[s] && ids[s] !== 'BYE' ? (team ? App.kName(App.entry(ids[s])?.kontingenId) : App.entryName(App.entry(ids[s]))) : '');
    return `<section class="page xsc fw">${scKop('FAIRWAY COMPETITION SCORE CARD  ·  MATCH PLAY')}
      <div class="xi">
        <div><span class="xlab">Category :</span>${cat}</div>
        <div><span class="xlab">Gender :</span>${boxes([['L', 'Putra'], ['P', 'Putri'], ['X', 'Mix']], ev.gender)}</div>
        <div><span class="xlab">Stage :</span>${stageBoxes}</div>
        <div><span class="xlab">Lane :</span>${laneBoxes(g.lane || m.lane)}</div>
        <div><span class="xlab">Team Match :</span>${team ? boxes(m.games.map((x, k) => [k, x.label]), gi) : '-'}</div>
        <div><span class="xlab">Date :</span>${dots(m.date ? App.fmtDate(m.date) : '')}<span class="xlab">Time :</span>${dots(m.time)}</div>
      </div>
      <table class="xg"><colgroup><col class="cno"><col class="cname">${gateCols(N + X)}<col class="ctot"></colgroup>
        <thead><tr><th>SIDE</th><th>NAME</th>${Array.from({ length: N }, (_, i) => `<th class="gl" colspan="3">GATE ${i + 1}</th>`).join('')}${Array.from({ length: X }, (_, i) => `<th class="gl${i ? '' : ' gx'}" colspan="3">EXTRA ${i + 1}</th>`).join('')}<th class="gl">GATES<br>WON</th></tr></thead>
        <tbody><tr class="xpar"><td class="xparl" colspan="2">PAR</td>${all.map((_, i) => `<td class="gl${i === N ? ' gx' : ''}" colspan="3"></td>`).join('')}<td class="gl"></td></tr>
          ${side(0)}
          <tr class="xwin"><td class="xparl" colspan="2">GATE WINNER</td>${all.map((p, i) => `<td class="gl${i === N ? ' gx' : ''}" colspan="3">${won(p)}</td>`).join('')}<td class="gl">${filled && gr.winner ? (gr.winner === 'a' ? 'A' : 'B') : ''}</td></tr>
          ${side(1)}</tbody></table>
      <div class="xsg">${scSign('PLAYER / PAIR A', 'Signature', signName(0))}${scSign('PLAYER / PAIR B', 'Signature', signName(1))}${scSign('REFEREE', 'Signature', '')}</div>${scFoot()}
    </section>`;
  }

  // ---------- Hasil resmi ----------
  function resultPage(ev) {
    const signer = App.S.event.resultSigner;
    let body = '';
    const medalOf = (rank) => (rank <= 3 ? App.MEDAL[rank] : '');
    if (ev.discipline === 'stroke') {
      const rows = St.ranking(ev).filter((r) => r.played > 0);
      if (ev.kind === 'team') {
        // Ringkas per pemain: total tiap ronde sumber, jumlah pemain, lalu total tim.
        const { ev: src, rounds: srcRounds } = St.teamSource(ev);
        const sr = srcRounds.filter((i) => src && src.config.rounds[i]);
        const detail = St.teamDetail(ev);
        const countedOf = Object.fromEntries((detail ? detail.teams : []).map((t) => [t.row.entry.id, new Set(t.members.filter((m) => m.counted).map((m) => m.athleteId))]));
        body = `<table class="pt team-sum"><thead><tr><th>Pos</th><th>Kab/Kota</th><th>Pemain</th>${sr.map((i) => `<th>${esc(src.config.rounds[i].name)}</th>`).join('')}<th>Jumlah</th><th>Total tim</th><th>Ket.</th></tr></thead><tbody>
          ${rows.map((r) => {
            const ms = r.members;
            const counted = countedOf[r.entry.id] || new Set();
            return ms.map((m, mi) => {
              const per = sr.map((i) => (!src ? { played: 0, total: 0 } : ev.config.own ? (() => { const s = St.sumScore(St.score(src, i, m.athleteId), src.config.rounds[i].gates); return { played: s.played, total: s.sum }; })() : St.memberScore(src, m.athleteId, [i])));
              const first = mi === 0;
              return `<tr class="${first ? 'ts-first' : ''}">${first ? `<td class="c" rowspan="${ms.length}"><b>${r.rank}</b></td><td rowspan="${ms.length}">${esc(App.kName(r.entry.kontingenId))}</td>` : ''}
                <td>${esc(App.athName(m.athleteId))}${counted.has(m.athleteId) ? '' : ' <small>(tidak dihitung)</small>'}</td>
                ${per.map((x) => `<td class="c">${x.played ? x.total : '-'}</td>`).join('')}<td class="c">${m.played ? m.total : '-'}</td>
                ${first ? `<td class="c" rowspan="${ms.length}"><b>${r.total}</b></td><td rowspan="${ms.length}">${medalOf(r.rank)}</td>` : ''}</tr>`;
            }).join('');
          }).join('')}</tbody></table>`;
      } else {
        const rcs = ev.config.rounds;
        body = `<table class="pt"><thead><tr><th>Pos</th><th>Nama</th><th>Kab/Kota</th>${rcs.map((r) => `<th>${esc(r.name)}</th>`).join('')}<th>Total</th>${App.countHeads()}<th>Ket.</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td class="c">${r.rank}</td><td>${esc(App.entryName(r.entry))}</td><td>${esc(App.kName(r.entry.kontingenId))}</td>${r.rounds.map((x) => `<td class="c">${x.played ? x.sum : '-'}</td>`).join('')}<td class="c"><b>${r.total}</b></td>${App.countCells(r.counts)}<td>${medalOf(r.rank)}</td></tr>`).join('')}</tbody></table>`;
      }
    } else {
      const pl = Fw.placements(ev).list;
      const d = Fw.data(ev);
      body = `<table class="pt"><thead><tr><th>Peringkat</th><th>Nama</th><th>Kab/Kota</th><th>Medali</th></tr></thead><tbody>
        ${pl.filter((p) => p.rank <= 4).map((p) => { const e = App.entry(p.entryId); return `<tr><td class="c">${p.rank}</td><td>${esc(App.entryName(e))}${ev.kind === 'team' ? `<br><small>${e.members.filter(Boolean).map(App.athName).map(esc).join(', ')}</small>` : ''}</td><td>${esc(App.kName(e?.kontingenId))}</td><td>${medalOf(p.rank)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="c">Belum ada hasil</td></tr>'}</tbody></table>`;
      if (d.groups.length) body += d.groups.map((g) => `<h4>Grup ${esc(g.name)}</h4>${standingsPrint(ev, g)}`).join('');
      const ko = Fw.koMatches(ev);
      if (ko.length) body += `<h4>Hasil pertandingan bagan</h4>${matchesPrint(ev, ko)}`;
    }
    // Team Stroke: halaman tambahan berisi skor tiap pemain per gate dan jumlah tim.
    const teamGates = ev.discipline === 'stroke' && ev.kind === 'team'
      ? teamGatesPage(ev) : '';
    return `<section class="page flow">${kop('HASIL RESMI', `${esc(ev.name)}`)}${body}
      <div class="signs end">${signBox(signer.title, signer.name, true)}</div></section>${teamGates}`;
  }

  function standingsPrint(ev, g) {
    return `<table class="pt"><thead><tr><th>#</th><th>Nama</th><th>Kab/Kota</th><th>Main</th><th>Menang</th><th>Kalah</th><th>PM</th><th>PK</th><th>SK</th><th>Poin</th></tr></thead><tbody>
      ${Fw.standings(ev, g).map((r) => { const e = App.entry(r.entryId); return `<tr><td class="c">${r.rank}</td><td>${esc(App.entryName(e))}</td><td>${esc(App.kShort(e?.kontingenId))}</td><td class="c">${r.main}</td><td class="c">${r.menang}</td><td class="c">${r.kalah}</td><td class="c">${r.pm}</td><td class="c">${r.pk}</td><td class="c">${r.sk}</td><td class="c"><b>${r.poin}</b></td></tr>`; }).join('')}</tbody></table>`;
  }

  function matchesPrint(ev, ms) {
    return `<table class="pt"><thead><tr><th>Babak</th><th>Peserta 1</th><th>Skor</th><th>Peserta 2</th></tr></thead><tbody>
      ${ms.map((m) => {
        const r = Fw.matchResult(ev, m);
        if (r.status === 'bye' || (r.a === 'BYE' && r.b === 'BYE')) return '';
        const [x, y] = Fw.flip(r) ? ['b', 'a'] : ['a', 'b'];
        return `<tr><td>${esc(Fw.stageLabel(ev, m))}</td><td class="${r.winner === x ? 'win' : ''}">${esc(App.entryLabel(App.entry(r[x])))}</td><td class="c">${App.matchScoreText(ev, r, x === 'b')}</td><td class="${r.winner === y ? 'win' : ''}">${esc(App.entryLabel(App.entry(r[y])))}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function bracketPage(ev) {
    const d = Fw.data(ev);
    let html = '';
    if (Fw.koMatches(ev).length) html += `<section class="page">${kop('BAGAN PERTANDINGAN', esc(ev.name))}<div class="print-bracket">${App.bracketHtml(ev, false)}</div></section>`;
    if (d.groups.length) {
      html += `<section class="page flow">${kop('KLASEMEN GRUP', esc(ev.name))}${d.groups.map((g) => `<h4>Grup ${esc(g.name)}</h4>${standingsPrint(ev, g)}${matchesPrint(ev, Fw.groupMatches(ev, g.id))}`).join('')}</section>`;
    }
    return html || `<section class="page">${kop('BAGAN PERTANDINGAN', esc(ev.name))}<p class="c">Bagan belum dibuat.</p></section>`;
  }

  // ---------- Sertifikat ----------
  const TIER = { 1: 'gold', 2: 'silver', 3: 'bronze' };
  const certNo = (n) => (App.S.event.certNumber || '{no}').replace('{no}', String(n).padStart(3, '0'));

  // Daftar lengkap sertifikat dengan urutan tetap (nomor urut stabil): juara per nomor, peserta, lalu official & pelatih.
  App.certList = () => {
    const out = [];
    const medalists = new Set();
    App.S.events.forEach((ev) => {
      App.placements(ev).list.filter((p) => p.rank <= 3).sort((x, y) => x.rank - y.rank).forEach((p) => {
        const en = App.entry(p.entryId);
        if (!en) return;
        en.members.filter(Boolean).forEach((aid) => {
          medalists.add(aid);
          out.push({ type: 'juara', ev, rank: p.rank, name: App.athName(aid), kontingenId: en.kontingenId, athleteId: aid });
        });
      });
    });
    App.S.athletes.slice().sort((x, y) => App.kName(x.kontingenId).localeCompare(App.kName(y.kontingenId)) || x.name.localeCompare(y.name)).forEach((at) => {
      if (medalists.has(at.id)) return;
      const evs = App.S.entries.filter((e) => e.members.includes(at.id)).map((e) => App.event(e.eventId)).filter(Boolean);
      if (evs.length) out.push({ type: 'peserta', evs, name: at.name, kontingenId: at.kontingenId, athleteId: at.id });
    });
    App.S.kontingen.forEach((k) => (k.officials || []).forEach((o) => out.push({ type: 'official', role: o.role, name: o.name, kontingenId: k.id })));
    out.forEach((c, i) => (c.no = certNo(i + 1)));
    return out;
  };
  App.certLabel = (c) => (c.type === 'juara' ? `Juara ${c.rank} (${App.MEDAL[c.rank]}) · ${c.ev.name}`
    : c.type === 'peserta' ? `Peserta · ${c.evs.map((e) => e.name).join(', ')}` : `${c.role} kontingen`);

  const verifyUrl = (no) => location.href.split('#')[0].split('?')[0] + '#/verifikasi/' + encodeURIComponent(no);
  const qrSvg = (text) => {
    if (!window.qrcode) return '';
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
  };

  function certPage(c) {
    const E = App.S.event;
    const nomor = c.type === 'juara' ? c.ev.name : c.type === 'peserta' ? c.evs.map((e) => e.name).join(', ') : '';
    const fill = (t) => (t || '').replace(/\{(\w+)\}/g, (_, k) => ({
      nama: c.name, kontingen: App.kName(c.kontingenId), nomor, peran: (c.role || '').toUpperCase(),
      juara: c.rank ? String(c.rank) : '', medali: c.rank ? App.MEDAL[c.rank] : '', event: E.title,
      tanggal: App.fmtDateRange(E.dateStart, E.dateEnd), kota: E.city,
    }[k] ?? `{${k}}`));
    const body = fill(c.type === 'juara' ? E.certBody : c.type === 'peserta' ? E.certPartBody : E.certOfficialBody);
    const tier = c.type === 'juara' ? TIER[c.rank] : c.type === 'peserta' ? 'part' : 'off';
    const badge = c.type === 'juara' ? `Juara ${c.rank} · Medali ${App.MEDAL[c.rank]}` : c.type === 'peserta' ? 'Peserta' : c.role;
    const logos = (E.logos || []).map((id) => App.files.url(id)).filter(Boolean);
    // Desain kaca F4: satu panel kaca di atas latar bercahaya hijau-merah; lencana bulat hanya untuk peringkat juara.
    return `<section class="page cert2 ${tier}"><div class="c2-card">
      <div class="c2-head">
        ${logos.length ? `<div class="c2-logos">${logos.map((u) => `<img src="${u}" alt="">`).join('')}</div>` : '<div></div>'}
        <div class="c2-org">Cabang Olahraga ${esc(E.sport)}<br>${esc(E.shortName)}</div>
      </div>
      <div class="c2-mid">
        <div class="c2-top"><div class="c2-who">
          <div class="c2-title">${esc(E.certTitle)}</div>
          <div class="c2-intro">${esc(E.certIntro)}</div>
          <div class="c2-name">${esc(c.name)}</div>
          <div class="c2-k">Kontingen ${esc(App.kName(c.kontingenId))}</div>
        </div>${c.type === 'juara' ? `<div class="c2-medal-ring"><b>${c.rank}</b><span>${esc(App.MEDAL[c.rank])}</span></div>` : ''}</div>
        <div class="c2-tags"><span class="c2-chip c2-role">${esc(badge)}</span>${c.type === 'juara' ? `<span class="c2-chip">${esc(c.ev.name)}</span>` : ''}</div>
        <p class="c2-body">${esc(body).replace(/\n/g, '<br>')}</p>
      </div>
      <div class="c2-foot">
        <div class="c2-signs"><div class="c2-date">${signDate()}</div><div class="c2-signrow">${E.signers.map((s) => signBox(s.title, s.name)).join('')}</div></div>
        <div class="c2-qr">${qrSvg(verifyUrl(c.no))}<div><b>Pindai untuk verifikasi</b>No. ${esc(c.no)}</div></div>
      </div>
    </div></section>`;
  }

  function certPages(ev) {
    const t = opts.certType;
    const list = App.certList().filter((c) => (t === 'semua' || c.type === t)
      && (!ev || (c.type === 'juara' && c.ev.id === ev.id) || (c.type === 'peserta' && c.evs.some((e) => e.id === ev.id))));
    return list.map(certPage).join('') || `<section class="page">${kop('SERTIFIKAT')}<p class="c">${t === 'official' ? 'Belum ada official/pelatih. Tambahkan di menu Kontingen.' : 'Belum ada penerima sertifikat untuk pilihan ini.'}</p></section>`;
  }

  // ---------- Laporan resmi perolehan medali (untuk KONI) ----------
  // Klasemen hanya menghitung medali DEFINITIF (nomor yang seluruh pertandingannya selesai).
  // Status per nomor: definitif / sedang dipertandingkan / sudah diundi / belum dipertandingkan.
  function evStatus(ev, pl) {
    if (pl.final && pl.list.some((p) => p.rank <= 3)) return 'fix';
    if (ev.discipline === 'fairway') {
      const d = Fw.data(ev);
      if (!d.matches.length) return 'none';
      return d.matches.some((m) => m.games.some((g) => Fw.gameResult(ev, g).played)) ? 'run' : 'draw';
    }
    const rounds = St.data(ev).rounds || [];
    if (!rounds.some((r) => r.groups && r.groups.length)) return 'none';
    return pl.list.length ? 'run' : 'draw';
  }

  function medalReport() {
    const K = ['gold', 'silver', 'bronze'];
    const KEY = { 1: 'gold', 2: 'silver', 3: 'bronze' };
    const t = Object.fromEntries(App.S.kontingen.map((k) => [k.id, { k, gold: 0, silver: 0, bronze: 0 }]));
    const evs = App.S.events.map((ev) => {
      const pl = App.placements(ev);
      const status = evStatus(ev, pl);
      const medalists = status === 'fix' ? pl.list.filter((p) => p.rank <= 3) : [];
      medalists.forEach((p) => { const e = App.entry(p.entryId); if (e && t[e.kontingenId]) t[e.kontingenId][KEY[p.rank]]++; });
      return { ev, medalists, status };
    });
    const rows = Object.values(t);
    rows.forEach((r) => (r.total = r.gold + r.silver + r.bronze));
    const cmp = (a, b) => K.reduce((d, k) => d || b[k] - a[k], 0);
    rows.sort((a, b) => cmp(a, b) || a.k.name.localeCompare(b.k.name));
    rows.forEach((r, i) => { const p = rows[i - 1]; r.rank = p && !cmp(p, r) ? p.rank : i + 1; });
    const n = (v, cls = '') => `<td class="c${cls}">${v || '-'}</td>`;
    const tot = Object.fromEntries([...K, 'total'].map((k) => [k, rows.reduce((s, r) => s + r[k], 0)]));
    const cnt = (s) => evs.filter((x) => x.status === s).length;
    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    const day = new Date((opts.date || App.today()) + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' });
    const asOf = `Status Data per ${esc(day)}, ${esc(App.fmtDate(opts.date || App.today()))}${!opts.date || opts.date === App.today() ? ` Pukul ${jam} WITA` : ''}`;
    const signs = `<div class="signs end">${signBox(App.S.event.resultSigner.title, App.S.event.resultSigner.name, true)}</div>`;
    const sumBox = (lbl, v, cls) => `<div class="mr-box ${cls}"><b>${v}</b><span>${lbl}</span></div>`;
    const page1 = `<section class="page flow mr">${kop('LAPORAN PEROLEHAN MEDALI CABANG OLAHRAGA WOODBALL', asOf)}
      <p class="mr-open">Dengan hormat, bersama ini kami sampaikan laporan perolehan medali Cabang Olahraga Woodball ${esc(App.S.event.title)} sebagai berikut:</p>
      <div class="mr-sum two">${sumBox('Jumlah Nomor Pertandingan', evs.length, '')}${sumBox('Nomor Telah Selesai (Medali Definitif)', cnt('fix'), 'fix')}</div>
      <table class="pt mr-t"><colgroup><col style="width:24mm"><col style="width:80mm"><col><col><col><col></colgroup><thead>
        <tr><th rowspan="2">Peringkat</th><th rowspan="2">Kabupaten / Kota</th><th colspan="4" class="mr-hfix">MEDALI DEFINITIF</th></tr>
        <tr><th>Emas</th><th>Perak</th><th>Perunggu</th><th>Jumlah</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="c"><b>${r.rank}</b></td><td>${esc(r.k.name)}</td>${K.map((k) => n(r[k])).join('')}${n(r.total, ' mr-j')}</tr>`).join('')}
        <tr class="sum"><td colspan="2" class="c"><b>TOTAL</b></td>${K.map((k) => n(tot[k])).join('')}${n(tot.total, ' mr-j')}</tr></tbody></table>
      <div class="mr-note"><b>Keterangan:</b><ol>
        <li>Medali Definitif adalah perolehan medali dari nomor pertandingan yang seluruh rangkaian pertandingannya telah selesai dan hasilnya telah disahkan.</li>
        <li>Peringkat disusun berdasarkan jumlah medali Emas, kemudian Perak, kemudian Perunggu.</li></ol></div>
      <p class="mr-close">Demikian laporan ini kami sampaikan untuk dapat dipergunakan sebagaimana mestinya.</p>
      ${signs}</section>`;
    const ST = { fix: ['DEFINITIF', 'fix'], run: ['SEDANG DIPERTANDINGKAN', 'tmp'], draw: ['SUDAH DIUNDI, BELUM DIPERTANDINGKAN', 'draw'], none: ['BELUM DIPERTANDINGKAN', 'none'] };
    const who = (p, ev) => { const e = App.entry(p.entryId); return e ? (ev.kind === 'team' ? `<b>${esc(App.kName(e.kontingenId))}</b>` : `${esc(App.entryName(e))} <small>(${esc(App.kShort(e.kontingenId))})</small>`) : '-'; };
    const order = ['fix', 'run', 'draw', 'none'];
    const list = evs.slice().sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    const page2 = `<section class="page flow mr">${kop('DAFTAR PERAIH MEDALI PER NOMOR PERTANDINGAN', asOf)}
      <table class="pt mr-d"><colgroup><col style="width:9mm"><col style="width:42mm"><col style="width:39mm"><col><col><col></colgroup><thead><tr><th>No</th><th>Nomor Pertandingan</th><th>Status</th><th>Emas</th><th>Perak</th><th>Perunggu</th></tr></thead><tbody>
      ${list.map(({ ev, medalists, status }, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(ev.name)}</b></td><td class="c"><span class="mr-st ${ST[status][1]}">${ST[status][0]}</span></td>
        ${[1, 2, 3].map((rk) => `<td>${medalists.filter((p) => p.rank === rk).map((p) => who(p, ev)).join('<hr>') || '<span class="muted">-</span>'}</td>`).join('')}</tr>`).join('')}
      </tbody></table>${signs}</section>`;
    return page1 + page2;
  }

  function medalsPage() {
    const { rows, perEvent } = App.medalTally();
    return `<section class="page flow">${kop('REKAPITULASI PEROLEHAN MEDALI', 'Per Kabupaten / Kota')}
      <table class="pt"><thead><tr><th>Peringkat</th><th>Kabupaten / Kota</th><th>Emas</th><th>Perak</th><th>Perunggu</th><th>Total</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="c">${r.rank}</td><td>${esc(r.k.name)}</td><td class="c">${r.gold}</td><td class="c">${r.silver}</td><td class="c">${r.bronze}</td><td class="c"><b>${r.total}</b></td></tr>`).join('')}
      <tr class="sum"><td colspan="2" class="c"><b>JUMLAH</b></td>${['gold', 'silver', 'bronze', 'total'].map((k) => `<td class="c"><b>${rows.reduce((s, r) => s + r[k], 0)}</b></td>`).join('')}</tr></tbody></table>
      <div class="signs end">${signBox(App.S.event.resultSigner.title, App.S.event.resultSigner.name, true)}</div></section>
      <section class="page flow">${kop('DAFTAR PERAIH MEDALI')}
      <table class="pt"><thead><tr><th>No</th><th>Nomor</th><th>Emas</th><th>Perak</th><th>Perunggu</th></tr></thead><tbody>
      ${perEvent.map(({ ev, medalists }, i) => `<tr><td class="c">${i + 1}</td><td>${esc(ev.name)}</td>${[1, 2, 3].map((rk) => `<td>${medalists.filter((p) => p.rank === rk).map((p) => esc(App.entryLabel(App.entry(p.entryId)))).join('<br>') || '-'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></section>`;
  }

  function athletesPage() {
    return App.S.kontingen.map((k) => {
      const list = App.S.athletes.filter((a) => a.kontingenId === k.id);
      if (!list.length) return '';
      const nomor = (a) => App.S.entries.filter((e) => e.members.includes(a.id)).map((e) => App.event(e.eventId)?.code).filter(Boolean).join(', ');
      return `<section class="page flow">${kop('DAFTAR PESERTA', 'Kontingen ' + esc(k.name))}
        <table class="pt"><thead><tr><th>No</th><th>Nama</th><th>L/P</th><th>Nomor</th></tr></thead><tbody>
        ${list.sort((a, b) => a.gender.localeCompare(b.gender) || a.name.localeCompare(b.name)).map((a, i) => `<tr><td class="c">${i + 1}</td><td>${esc(a.name)}</td><td class="c">${a.gender}</td><td>${esc(nomor(a))}</td></tr>`).join('')}
        </tbody></table></section>`;
    }).join('') || `<section class="page">${kop('DAFTAR PESERTA')}<p class="c">Belum ada atlet.</p></section>`;
  }

  // Jadwal pertandingan fairway per babak/putaran. Team: satu pertandingan = 3 partai di lapangan masing-masing.
  function scheduleFairway(ev) {
    const d = Fw.data(ev);
    const ms = d.matches.filter((m) => { const r = Fw.matchResult(ev, m); return !(r.a === 'BYE' || r.b === 'BYE'); });
    if (!ms.length) return `<section class="page">${kop('JADWAL PERTANDINGAN', esc(ev.name))}<p class="c">Pertandingan belum diundi.</p></section>`;
    const gName = (m) => (d.groups.find((g) => g.id === m.group) || {}).name || '';
    // Kelompok: Putaran 1, 2, ... (semua grup), lalu babak bagan.
    const sections = [];
    const add = (key, title, m) => { let x = sections.find((y) => y.key === key); if (!x) sections.push((x = { key, title, list: [] })); x.list.push(m); };
    ms.slice().sort((p, q) => (p.stage === 'group' ? 0 : 1) - (q.stage === 'group' ? 0 : 1) || p.round - q.round || (p.stage === 'third' ? 1 : 0) - (q.stage === 'third' ? 1 : 0) || gName(p).localeCompare(gName(q)) || p.pos - q.pos)
      .forEach((m) => (m.stage === 'group' ? add('g' + m.round, 'Babak Grup · Putaran ' + m.round, m) : add(m.stage + m.round, Fw.stageLabel(ev, m), m)));
    const team = ev.kind === 'team';
    const blank = '<span class="sch-blank"></span>';
    const nm = (id) => (id ? esc(App.entryName(App.entry(id))) + ` <small>(${esc(App.kShort(App.entry(id)?.kontingenId))})</small>` : '<i>menunggu</i>');
    const info = (m) => [m.date ? App.fmtDateRange ? m.date.split('-').reverse().join('/') : m.date : '', m.time].filter(Boolean).map(esc).join('<br>');
    const rows = (m, i) => {
      const r = Fw.matchResult(ev, m);
      const babak = m.stage === 'group' ? 'Grup ' + esc(gName(m)) : '';
      if (!team) return `<tr><td class="c">${i}</td><td class="c">${babak}</td><td class="c">${info(m) || blank}</td><td class="c">${esc(m.lane || '')}</td><td>${nm(r.a)}</td><td class="c">vs</td><td>${nm(r.b)}</td></tr>`;
      return m.games.map((g, gi) => {
        const pl = (id) => (id ? Fw.gamePlayers(ev, id, g, m).split(' / ').map((x) => (x === '-' ? blank : esc(x))).join(' / ') : '');
        const lead = gi === 0 ? `<td class="c" rowspan="${m.games.length}">${i}</td><td class="c" rowspan="${m.games.length}">${babak}</td><td class="c" rowspan="${m.games.length}">${info(m) || blank}</td><td rowspan="${m.games.length}"><b>${r.a ? esc(App.kShort(App.entry(r.a)?.kontingenId)) : '<i>menunggu</i>'}</b><br>vs<br><b>${r.b ? esc(App.kShort(App.entry(r.b)?.kontingenId)) : '<i>menunggu</i>'}</b></td>` : '';
        return `<tr class="${gi === 0 ? 'sch-first' : ''}">${lead}<td><b>${esc(g.label)}</b></td><td class="c">${esc(g.lane || m.lane || '') || blank}</td><td>${pl(r.a)}</td><td>${pl(r.b)}</td></tr>`;
      }).join('');
    };
    const head = team
      ? '<tr><th>No</th><th>Grup</th><th>Hari / Jam</th><th>Tim</th><th>Partai</th><th>Lap.</th><th>Pemain tim 1</th><th>Pemain tim 2</th></tr>'
      : '<tr><th>No</th><th>Grup</th><th>Hari / Jam</th><th>Lap.</th><th>Peserta 1</th><th></th><th>Peserta 2</th></tr>';
    let no = 0;
    return sections.map((sct) => `<section class="page flow">${kop('JADWAL PERTANDINGAN', esc(ev.name) + ' · ' + esc(sct.title))}
      <table class="pt sch${team ? ' sch-team' : ''}"><thead>${head}</thead><tbody>${sct.list.map((m) => rows(m, ++no)).join('')}</tbody></table>
      ${team ? '<p class="small">Ketiga partai dimainkan bersamaan. Susunan pemain diisi oleh official tim sebelum pertandingan.</p>' : ''}</section>`).join('');
  }

  function buildPages(doc, params) {
    const ev = App.event(params[0]);
    if (doc === 'medals') return medalsPage();
    if (doc === 'medalreport') return medalReport();
    if (doc === 'athletes') return athletesPage();
    if (doc === 'certificates') return certPages(ev);
    if (!ev) return '<p class="c">Pilih nomor.</p>';
    if (doc === 'scorecard-stroke') {
      if (ev.discipline !== 'stroke') return '<p class="c">Pilih nomor stroke.</p>';
      if (ev.kind === 'team' && (!ev.config.own || params[1] === 'tg')) return teamGatesPage(ev);
      // 'p' = semua ronde penyisihan (R1 + R2), 'a' = semua ronde (R1 + R2 + Final)
      if (params[1] === 'p') return strokeCombined(ev, St.prelimRounds(ev));
      if (params[1] === 'a') return strokeCombined(ev, ev.config.rounds.map((_, i) => i));
      const ri = +(params[1] || 0);
      const r = St.data(ev).rounds[ri];
      if (!r) return '';
      if (!r.groups.length) return '<p class="c">Pairing ronde ini belum dibuat.</p>';
      if (params[2]) return r.groups.filter((g) => g.id === params[2]).map((g) => strokeCard(ev, ri, g)).join('');
      return opts.layout === 'cards' ? r.groups.map((g) => strokeCard(ev, ri, g)).join('') : strokeSheet(ev, ri, r.groups);
    }
    if (doc === 'scorecard-fairway') {
      if (ev.discipline !== 'fairway') return '<p class="c">Pilih nomor fairway.</p>';
      const ms = params[1] ? [Fw.match(ev, params[1])].filter(Boolean) : Fw.data(ev).matches.slice().sort((a, b) => (a.stage === 'group' ? 0 : 1) - (b.stage === 'group' ? 0 : 1) || a.round - b.round || a.pos - b.pos);
      return ms.filter((m) => { const r = Fw.matchResult(ev, m); return r.a && r.b && r.a !== 'BYE' && r.b !== 'BYE'; })
        .map((m) => m.games.map((_, gi) => fairwayCard(ev, m, gi)).join('')).join('') || '<p class="c">Belum ada pertandingan yang pesertanya lengkap.</p>';
    }
    if (doc === 'schedule-fairway') return ev.discipline === 'fairway' ? scheduleFairway(ev) : '<p class="c">Jadwal ini untuk nomor fairway.</p>';
    if (doc === 'result') return resultPage(ev);
    if (doc === 'bracket') return ev.discipline === 'fairway' ? bracketPage(ev) : '<p class="c">Bagan hanya untuk nomor fairway.</p>';
    return '';
  }

  App.views.print = {
    render(params, solo) {
      let doc = DOCS[params[0]] ? params[0] : 'result';
      if (doc === 'certificates' && !App.isAdmin()) doc = 'result'; // sertifikat hanya dicetak admin
      const docs = Object.entries(DOCS).filter(([k]) => k !== 'certificates' || App.isAdmin());
      const p = params.slice(1);
      const ev = App.event(p[0]);
      const needEv = !['medals', 'medalreport', 'athletes'].includes(doc);
      const evList = App.S.events.filter((e) => (doc === 'scorecard-stroke' ? e.discipline === 'stroke' : doc === 'scorecard-fairway' || doc === 'bracket' || doc === 'schedule-fairway' ? e.discipline === 'fairway' : true));
      let extra = '';
      if (doc === 'scorecard-stroke' && ev && ev.kind === 'team' && !ev.config.own) {
        const src = App.event(ev.config.sourceEvent);
        extra = `<select id="pr-round" disabled>${App.ui.options([['', (ev.config.sourceRounds || []).map((i) => src?.config.rounds[i]?.name).filter(Boolean).join(' + ')]], '')}</select>`;
      } else if (doc === 'scorecard-stroke' && ev) {
        const rcs = ev.config.rounds;
        const pre = St.prelimRounds(ev);
        const combos = [];
        if (ev.kind === 'team') combos.push(['tg', 'Skor per gate tim (R1 + R2)']);
        else if (pre.length > 1) combos.push(['p', pre.map((i) => rcs[i].name).join(' + ')]);
        if (ev.kind !== 'team' && rcs.length > pre.length) combos.push(['a', rcs.map((r) => r.name).join(' + ')]);
        extra = `<select id="pr-round">${App.ui.options([...rcs.map((r, i) => [i, r.name]), ...combos], p[1] || 0)}</select>`;
        if (!p[2] && !['p', 'a', 'tg'].includes(p[1])) extra += `<select id="pr-layout">${App.ui.options([['sheet', 'Rekap 1 halaman'], ['cards', 'Score card per pairing']], opts.layout)}</select>`;
      }
      return `<div class="print-toolbar no-print card">
          <div class="row gap wrap">
            ${solo ? '' : `<select id="pr-doc">${App.ui.options(docs, doc)}</select>`}
            ${needEv ? `<select id="pr-ev">${doc === 'certificates' ? '<option value="">Semua nomor</option>' : ''}${App.ui.options(evList.map((e) => [e.id, e.name]), ev ? ev.id : '')}</select>` : ''}
            ${extra}
            <select id="pr-color" title="Warna cetakan">${App.ui.options([['color', 'Warna'], ['bw', 'Hitam putih']], printBw() ? 'bw' : 'color')}</select>
            ${doc.startsWith('scorecard') ? `<label class="chk"><input type="checkbox" id="pr-filled" ${opts.filled ? 'checked' : ''}> Isi skor</label>` : ''}
            ${doc === 'certificates' ? `<select id="pr-ctype">${App.ui.options([['juara', 'Juara (1-3)'], ['peserta', 'Peserta'], ['official', 'Official & pelatih'], ['semua', 'Semua']], opts.certType)}</select>` : ''}
            ${['result', 'medals', 'medalreport', 'certificates'].includes(doc) ? `<label class="mini">Tanggal tanda tangan<input type="date" id="pr-date" value="${opts.date || App.today()}"></label>` : ''}
            <div class="spacer"></div>
            <button class="btn" id="pr-go">🖨️ Cetak / Simpan PDF</button>
          </div>
          <p class="muted small">Di dialog cetak pilih <b>Simpan sebagai PDF</b> atau printer, ukuran ${doc === 'certificates' ? '<b>F4 / Folio (330 × 215 mm)</b>' : '<b>A4</b>'}, orientasi <b>Lanskap</b>, margin <b>Default/Tidak ada</b>, dan centang <b>Grafis latar belakang</b>.</p>
        </div>
        ${doc === 'certificates' ? `<p class="muted small no-print">Kode QR di sertifikat membuka halaman verifikasi. Cetak dari alamat online (Vercel) agar kode QR bisa dipindai dari HP mana saja.</p>` : ''}
        <div class="print-area${printBw() ? ' bw' : ''}">${needEv && !ev && doc !== 'certificates' ? '<p class="c no-print">Pilih nomor terlebih dahulu.</p>' : buildPages(doc, p)}</div>`;
    },
    mount(root, params) {
      const doc = DOCS[params[0]] ? params[0] : 'result';
      const go = (d, evId, ...rest) => App.go(['print', d, evId || '', ...rest].filter((x, i) => i < 3 || x).join('/').replace(/\/+$/, ''));
      root.querySelector('#pr-doc')?.addEventListener('change', (e) => go(e.target.value, root.querySelector('#pr-ev')?.value));
      root.querySelector('#pr-ev')?.addEventListener('change', (e) => go(doc, e.target.value));
      root.querySelector('#pr-round')?.addEventListener('change', (e) => go(doc, params[1], e.target.value));
      root.querySelector('#pr-layout')?.addEventListener('change', (e) => { opts.layout = e.target.value; App.rerender(); });
      root.querySelector('#pr-filled')?.addEventListener('change', (e) => { opts.filled = e.target.checked; App.rerender(); });
      root.querySelector('#pr-color').addEventListener('change', (e) => { opts.bw = e.target.value === 'bw'; App.rerender(); });
      root.querySelector('#pr-ctype')?.addEventListener('change', (e) => { opts.certType = e.target.value; App.rerender(); });
      root.querySelector('#pr-date')?.addEventListener('change', (e) => { opts.date = e.target.value; App.rerender(); });
      root.querySelector('#pr-go').addEventListener('click', () => window.print());
      // Perkecil pratinjau agar halaman A4 muat di layar (tidak memengaruhi hasil cetak).
      const area = root.querySelector('.print-area');
      const fit = () => {
        if (!area.isConnected) return window.removeEventListener('resize', fit);
        const pageW = Math.max(297 * 96 / 25.4, ...Array.from(area.querySelectorAll('.page'), (p) => p.offsetWidth)) + 4; // sertifikat F4 lebih lebar dari A4
        area.style.zoom = Math.min(1, area.parentElement.clientWidth / pageW);
      };
      fit();
      window.addEventListener('resize', fit);
    },
  };

  // Menu khusus Laporan Medali: halaman cetak laporan resmi tanpa pilihan dokumen lain.
  App.views.laporan = {
    render: () => `<h2>${esc(App.S.menu.laporan)}</h2>` + App.views.print.render(['medalreport'], true),
    mount: (root) => App.views.print.mount(root, ['medalreport']),
  };

  // Halaman verifikasi dari kode QR sertifikat.
  App.views.verifikasi = {
    render(params) {
      const no = params.join('/');
      const c = App.certList().find((x) => x.no === no);
      return `<div class="card verify ${c ? 'ok' : 'bad'}">
        <div class="verify-ic">${c ? '✓' : '!'}</div>
        <h2>${c ? 'Sertifikat terdaftar' : 'Sertifikat tidak ditemukan'}</h2>
        ${c ? `<dl><dt>Nama</dt><dd>${esc(c.name)}</dd><dt>Kontingen</dt><dd>${esc(App.kName(c.kontingenId))}</dd>
          <dt>Keterangan</dt><dd>${esc(App.certLabel(c))}</dd><dt>Nomor</dt><dd>${esc(c.no)}</dd><dt>Kegiatan</dt><dd>${esc(App.S.event.title)}</dd></dl>`
          : `<p>Nomor <b>${esc(no || '-')}</b> tidak ada di data panitia. Hubungi panitia untuk memastikan keaslian sertifikat.</p>`}
      </div>`;
    },
  };
})(window.App);
