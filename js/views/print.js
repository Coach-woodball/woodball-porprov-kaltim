// Dokumen cetak A4 landscape: score card, hasil resmi, bagan, sertifikat, rekap medali, daftar peserta.
// Cetak lewat dialog browser -> pilih "Simpan sebagai PDF" atau printer.
(function (App) {
  const esc = App.esc, St = App.stroke, Fw = App.fairway;
  const opts = { filled: true, date: '', withParticipants: false, layout: 'sheet' };

  const DOCS = {
    'scorecard-stroke': 'Score Card Stroke',
    'scorecard-fairway': 'Score Card Fairway',
    result: 'Hasil Resmi',
    bracket: 'Bagan & Klasemen Grup',
    certificates: 'Sertifikat / Piagam',
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

  // ---------- Score card stroke ----------
  function tickGrid(max = 12) {
    return `<div class="tick">${Array.from({ length: max }, (_, i) => `<span>${i + 1}</span>`).join('')}</div>`;
  }

  function strokeCard(ev, ri, g) {
    const rc = ev.config.rounds[ri];
    const E = App.S.event;
    const size = Math.max(ev.config.groupSize || 4, g.entryIds.length);
    const rows = Array.from({ length: size }, (_, i) => g.entryIds[i] || null);
    const filled = opts.filled;
    const body = rows.map((id, i) => {
      const e = id && App.entry(id);
      const sc = id ? St.score(ev, ri, id) : { g: [], ob: 0 };
      const s = St.sumScore(sc, rc.gates);
      const cells = Array.from({ length: rc.gates }, (_, gi) => (filled && sc.g[gi] != null
        ? `<td class="gc ${App.scoreCls(sc.g[gi])}"><b class="sv">${sc.g[gi]}</b></td>`
        : `<td class="gc">${tickGrid()}</td>`)).join('');
      return `<tr><td class="c">${i + 1}</td><td class="nm">${e ? `<b>${esc(App.entryName(e))}</b><br><small>${esc(App.kName(e.kontingenId))}</small>` : ''}</td>${cells}
        <td class="c tot">${filled && s.played ? s.sum : ''}</td></tr>`;
    }).join('');
    const players = rows.map((id, i) => `<div class="sign small"><div>Pemain ${i + 1}</div><div class="sign-space"></div><div class="sign-name">${id ? esc(App.entryName(App.entry(id))) : ''}</div></div>`).join('');
    return `<section class="page sc">${kop('STROKE COMPETITION SCORE CARD')}
      <div class="info"><span>Kategori: <b>${esc(ev.name)}</b></span><span>Ronde: <b>${esc(rc.name)}</b></span><span>Pairing: <b>${g.no}</b></span>
        <span>Lapangan: <b>${esc(g.lane || '....')}</b></span><span>Jam: <b>${esc(g.time || '....')}</b></span><span>Tempat: <b>${esc(E.venue)}</b></span></div>
      <table class="pt sc-table"><thead><tr><th>No</th><th>Nama / Kab-Kota</th>${Array.from({ length: rc.gates }, (_, i) => `<th>Gate ${i + 1}</th>`).join('')}<th>Total</th></tr></thead><tbody>${body}</tbody></table>
      <div class="signs">${players}<div class="sign small"><div>Wasit</div><div class="sign-space"></div><div class="sign-name">(............................)</div></div></div>
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

  // ---------- Score card fairway ----------
  function fairwayCard(ev, m, gi) {
    const r = Fw.matchResult(ev, m);
    const g = m.games[gi];
    const gr = Fw.gameResult(ev, g);
    const N = ev.config.gates;
    const filled = opts.filled;
    const nA = Fw.gamePlayers(ev, r.a, g), nB = Fw.gamePlayers(ev, r.b, g);
    const extraN = Math.max(3, (g.extra || []).filter((p) => p && p[0] != null).length);
    const val = (pair, side) => (filled && pair && pair[side] != null && pair[side] !== '' ? `<b class="sv">${pair[side]}</b>` : '');
    const rowFor = (side, id, name) => `<tr><td class="c">${side + 1}</td><td class="nm"><b>${esc(name)}</b><br><small>${esc(App.kName(App.entry(id)?.kontingenId))}</small></td>
      ${Array.from({ length: N }, (_, i) => `<td class="gc">${val(g.gates[i], side) || (filled ? '' : tickGrid())}</td>`).join('')}
      ${Array.from({ length: extraN }, (_, i) => `<td class="gc">${val((g.extra || [])[i], side)}</td>`).join('')}</tr>`;
    const winRow = Array.from({ length: N }, (_, i) => {
      const p = g.gates[i];
      if (!filled || !p || p[0] == null || p[1] == null) return '<td></td>';
      return `<td class="c">${+p[0] < +p[1] ? '1' : +p[1] < +p[0] ? '2' : '='}</td>`;
    }).join('') + Array.from({ length: extraN }, (_, i) => {
      const p = (g.extra || [])[i];
      if (!filled || !p || p[0] == null || p[1] == null) return '<td></td>';
      return `<td class="c">${+p[0] < +p[1] ? '1' : +p[1] < +p[0] ? '2' : '='}</td>`;
    }).join('');
    const winner = filled && gr.winner ? (gr.winner === 'a' ? nA : nB) : '';
    return `<section class="page sc">${kop('FAIRWAY COMPETITION SCORE CARD')}
      <div class="info"><span>Kategori: <b>${esc(ev.name)}</b></span><span>Babak: <b>${esc(Fw.stageLabel(ev, m))}</b></span>${g.label ? `<span>Partai: <b>${esc(g.label)}</b></span>` : ''}
        <span>Lapangan: <b>${esc(m.lane || '....')}</b></span><span>Tanggal: <b>${esc(m.date ? App.fmtDate(m.date) : '....')}</b></span><span>Jam: <b>${esc(m.time || '....')}</b></span></div>
      <table class="pt sc-table"><thead><tr><th>No</th><th>Nama / Kab-Kota</th>${Array.from({ length: N }, (_, i) => `<th>Gate ${i + 1}</th>`).join('')}${Array.from({ length: extraN }, (_, i) => `<th>PK ${i + 1}</th>`).join('')}</tr></thead>
      <tbody>${rowFor(0, r.a, nA)}${rowFor(1, r.b, nB)}<tr><td colspan="2" class="c"><b>WINNER</b></td>${winRow}</tr></tbody></table>
      <table class="pt result-row"><tr><td><b>RESULT</b></td><td>No.1 WIN : <b>${filled && gr.played ? gr.pa : ''}</b></td><td>No.2 WIN : <b>${filled && gr.played ? gr.pb : ''}</b></td><td>EVEN : <b>${filled && gr.played ? gr.even : ''}</b></td><td class="w">WINNER : <b>${esc(winner)}</b></td></tr></table>
      <div class="signs"><div class="sign small"><div>Pemain No. 1</div><div class="sign-space"></div><div class="sign-name">${esc(nA)}</div></div>
        <div class="sign small"><div>Pemain No. 2</div><div class="sign-space"></div><div class="sign-name">${esc(nB)}</div></div>
        <div class="sign small"><div>Wasit</div><div class="sign-space"></div><div class="sign-name">(............................)</div></div></div>
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
        body = `<table class="pt"><thead><tr><th>Pos</th><th>Kab/Kota</th><th>Anggota Tim (skor)</th><th>Total</th><th>Ket.</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td class="c">${r.rank}</td><td>${esc(App.kName(r.entry.kontingenId))}</td><td>${r.members.map((m) => `${esc(App.athName(m.athleteId))} (${m.played ? m.total : '-'})`).join(', ')}</td><td class="c"><b>${r.total}</b></td><td>${medalOf(r.rank)}</td></tr>`).join('')}</tbody></table>`;
      } else {
        const rcs = ev.config.rounds;
        body = `<table class="pt"><thead><tr><th>Pos</th><th>Nama</th><th>Kab/Kota</th>${rcs.map((r) => `<th>${esc(r.name)}</th>`).join('')}<th>Total</th><th>Ket.</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td class="c">${r.rank}</td><td>${esc(App.entryName(r.entry))}</td><td>${esc(App.kName(r.entry.kontingenId))}</td>${r.rounds.map((x) => `<td class="c">${x.played ? x.sum : '-'}</td>`).join('')}<td class="c"><b>${r.total}</b></td><td>${medalOf(r.rank)}</td></tr>`).join('')}</tbody></table>
          <p class="note">Penentuan jika jumlah pukulan sama: ${(ev.config.tiebreak || []).map((k) => esc(St.TIEBREAKS[k])).join(' → ')}.</p>`;
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
    return `<section class="page flow">${kop('HASIL RESMI', `${esc(ev.name)}`)}${body}
      <div class="signs end">${signBox(signer.title, signer.name, true)}</div></section>`;
  }

  function standingsPrint(ev, g) {
    return `<table class="pt"><thead><tr><th>#</th><th>Nama</th><th>Kab/Kota</th><th>Main</th><th>Menang</th><th>Kalah</th><th>PM</th><th>PK</th><th>SK</th><th>Poin</th></tr></thead><tbody>
      ${Fw.standings(ev, g).map((r) => { const e = App.entry(r.entryId); return `<tr><td class="c">${r.rank}</td><td>${esc(App.entryName(e))}</td><td>${esc(App.kShort(e?.kontingenId))}</td><td class="c">${r.main}</td><td class="c">${r.menang}</td><td class="c">${r.kalah}</td><td class="c">${r.pm}</td><td class="c">${r.pk}</td><td class="c">${r.sk}</td><td class="c"><b>${r.poin}</b></td></tr>`; }).join('')}</tbody></table>`;
  }

  function matchesPrint(ev, ms) {
    return `<table class="pt"><thead><tr><th>Babak</th><th>Peserta 1</th><th>Skor</th><th>Peserta 2</th></tr></thead><tbody>
      ${ms.map((m) => { const r = Fw.matchResult(ev, m); if (r.status === 'bye' || (r.a === 'BYE' && r.b === 'BYE')) return ''; return `<tr><td>${esc(Fw.stageLabel(ev, m))}</td><td class="${r.winner === 'a' ? 'win' : ''}">${esc(App.entryLabel(App.entry(r.a)))}</td><td class="c">${App.matchScoreText(ev, r)}</td><td class="${r.winner === 'b' ? 'win' : ''}">${esc(App.entryLabel(App.entry(r.b)))}</td></tr>`; }).join('')}</tbody></table>`;
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
  function certPage(ev, athleteId, kontingenId, rank) {
    const E = App.S.event;
    const fill = (t) => t.replace(/\{(\w+)\}/g, (_, k) => ({
      nama: App.athName(athleteId), kontingen: App.kName(kontingenId), nomor: ev.name,
      juara: rank ? App.ROMAWI[rank] : '', medali: rank ? App.MEDAL[rank] : '', event: E.title,
      tanggal: App.fmtDateRange(E.dateStart, E.dateEnd), kota: E.city,
    }[k] ?? `{${k}}`));
    const logos = (E.logos || []).map((id) => App.files.url(id)).filter(Boolean);
    return `<section class="page cert"><div class="cert-frame"><div class="cert-inner">
      <div class="cert-logos">${logos.map((u) => `<img src="${u}" alt="">`).join('')}</div>
      <div class="cert-title">${esc(E.certTitle)}</div>
      <div class="cert-intro">${esc(E.certIntro)}</div>
      <div class="cert-name">${esc(App.athName(athleteId))}</div>
      <div class="cert-k">Kontingen ${esc(App.kName(kontingenId))}</div>
      <div class="cert-body">${esc(fill(rank ? E.certBody : E.certPartBody))}</div>
      <div class="cert-date">${signDate()}</div>
      <div class="signs cert-signs">${E.signers.map((s) => signBox(s.title, s.name)).join('')}</div>
    </div></div></section>`;
  }

  function certPages(ev) {
    const evs = ev ? [ev] : App.S.events;
    let html = '';
    evs.forEach((e) => {
      const pl = App.placements(e).list.filter((p) => p.rank <= 3);
      const ranked = new Set();
      pl.forEach((p) => {
        const en = App.entry(p.entryId);
        if (!en) return;
        ranked.add(en.id);
        en.members.filter(Boolean).forEach((aid) => (html += certPage(e, aid, en.kontingenId, p.rank)));
      });
      if (opts.withParticipants) {
        App.entriesOf(e.id).filter((en) => !ranked.has(en.id)).forEach((en) => en.members.filter(Boolean).forEach((aid) => (html += certPage(e, aid, en.kontingenId, 0))));
      }
    });
    return html || `<section class="page">${kop('SERTIFIKAT')}<p class="c">Belum ada juara.</p></section>`;
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

  function buildPages(doc, params) {
    const ev = App.event(params[0]);
    if (doc === 'medals') return medalsPage();
    if (doc === 'athletes') return athletesPage();
    if (doc === 'certificates') return certPages(ev);
    if (!ev) return '<p class="c">Pilih nomor.</p>';
    if (doc === 'scorecard-stroke') {
      if (ev.kind === 'team' || ev.discipline !== 'stroke') return '<p class="c">Pilih nomor stroke single/double.</p>';
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
    if (doc === 'result') return resultPage(ev);
    if (doc === 'bracket') return ev.discipline === 'fairway' ? bracketPage(ev) : '<p class="c">Bagan hanya untuk nomor fairway.</p>';
    return '';
  }

  App.views.print = {
    render(params) {
      const doc = DOCS[params[0]] ? params[0] : 'result';
      const p = params.slice(1);
      const ev = App.event(p[0]);
      const needEv = !['medals', 'athletes'].includes(doc);
      const evList = App.S.events.filter((e) => (doc === 'scorecard-stroke' ? e.discipline === 'stroke' && e.kind !== 'team' : doc === 'scorecard-fairway' || doc === 'bracket' ? e.discipline === 'fairway' : true));
      let extra = '';
      if (doc === 'scorecard-stroke' && ev && ev.kind !== 'team') {
        extra = `<select id="pr-round">${App.ui.options(ev.config.rounds.map((r, i) => [i, r.name]), p[1] || 0)}</select>`;
        if (!p[2]) extra += `<select id="pr-layout">${App.ui.options([['sheet', 'Rekap 1 halaman'], ['cards', 'Kartu per pairing']], opts.layout)}</select>`;
      }
      return `<div class="print-toolbar no-print card">
          <div class="row gap wrap">
            <select id="pr-doc">${App.ui.options(Object.entries(DOCS), doc)}</select>
            ${needEv ? `<select id="pr-ev">${doc === 'certificates' ? '<option value="">Semua nomor</option>' : ''}${App.ui.options(evList.map((e) => [e.id, e.name]), ev ? ev.id : '')}</select>` : ''}
            ${extra}
            ${doc.startsWith('scorecard') ? `<label class="chk"><input type="checkbox" id="pr-filled" ${opts.filled ? 'checked' : ''}> Isi skor</label>` : ''}
            ${doc === 'certificates' ? `<label class="chk"><input type="checkbox" id="pr-part" ${opts.withParticipants ? 'checked' : ''}> Termasuk peserta (non-juara)</label>` : ''}
            ${['result', 'medals', 'certificates'].includes(doc) ? `<label class="mini">Tanggal tanda tangan<input type="date" id="pr-date" value="${opts.date || App.today()}"></label>` : ''}
            <div class="spacer"></div>
            <button class="btn" id="pr-go">🖨️ Cetak / Simpan PDF</button>
          </div>
          <p class="muted small">Di dialog cetak pilih <b>Simpan sebagai PDF</b> atau printer, ukuran <b>A4</b>, orientasi <b>Lanskap</b>, margin <b>Default/Tidak ada</b>, dan centang <b>Grafis latar belakang</b>.</p>
        </div>
        <div class="print-area">${needEv && !ev && doc !== 'certificates' ? '<p class="c no-print">Pilih nomor terlebih dahulu.</p>' : buildPages(doc, p)}</div>`;
    },
    mount(root, params) {
      const doc = DOCS[params[0]] ? params[0] : 'result';
      const go = (d, evId, ...rest) => App.go(['print', d, evId || '', ...rest].filter((x, i) => i < 3 || x).join('/').replace(/\/+$/, ''));
      root.querySelector('#pr-doc').addEventListener('change', (e) => go(e.target.value, root.querySelector('#pr-ev')?.value));
      root.querySelector('#pr-ev')?.addEventListener('change', (e) => go(doc, e.target.value));
      root.querySelector('#pr-round')?.addEventListener('change', (e) => go(doc, params[1], e.target.value));
      root.querySelector('#pr-layout')?.addEventListener('change', (e) => { opts.layout = e.target.value; App.rerender(); });
      root.querySelector('#pr-filled')?.addEventListener('change', (e) => { opts.filled = e.target.checked; App.rerender(); });
      root.querySelector('#pr-part')?.addEventListener('change', (e) => { opts.withParticipants = e.target.checked; App.rerender(); });
      root.querySelector('#pr-date')?.addEventListener('change', (e) => { opts.date = e.target.value; App.rerender(); });
      root.querySelector('#pr-go').addEventListener('click', () => window.print());
      // Perkecil pratinjau agar halaman A4 muat di layar (tidak memengaruhi hasil cetak).
      const area = root.querySelector('.print-area');
      const fit = () => {
        if (!area.isConnected) return window.removeEventListener('resize', fit);
        const pageW = 297 * 96 / 25.4 + 4;
        area.style.zoom = Math.min(1, area.parentElement.clientWidth / pageW);
      };
      fit();
      window.addEventListener('resize', fit);
    },
  };
})(window.App);
