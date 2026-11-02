// Halaman Hasil & Medali (bisa dilihat tanpa admin) dan Layar Proyektor.
(function (App) {
  const esc = App.esc, Fw = App.fairway;

  App.podiumHtml = (ev) => {
    const pl = App.placements(ev);
    const top = pl.list.filter((p) => p.rank <= 3);
    if (!top.length) return '';
    return `<div class="podium">${top.map((p) => {
      const e = App.entry(p.entryId);
      return `<div class="pod r${p.rank}"><div class="medal-ic">${['', '🥇', '🥈', '🥉'][p.rank]}</div><b>${esc(App.entryName(e))}</b><span>${esc(App.kName(e?.kontingenId))}</span></div>`;
    }).join('')}</div>${pl.final ? '' : '<p class="muted small c">Hasil sementara - pertandingan belum selesai semua.</p>'}`;
  };

  App.eventResultHtml = (ev, link) => {
    let html = App.podiumHtml(ev);
    if (ev.discipline === 'stroke') return html + App.strokeRankingTable(ev);
    const d = Fw.data(ev);
    if (Fw.koMatches(ev).length) html += `<h4>Bagan</h4>${App.bracketHtml(ev, link)}`;
    d.groups.forEach((g) => { html += `<h4>Grup ${esc(g.name)}</h4>${App.standingsTable(ev, g)}${App.matchListHtml(ev, Fw.groupMatches(ev, g.id), link)}`; });
    if (Fw.koMatches(ev).length) html += `<h4>Pertandingan bagan</h4>${App.matchListHtml(ev, Fw.koMatches(ev), link)}`;
    if (!d.matches.length) html += App.ui.empty('Pertandingan belum diundi.');
    return html;
  };

  App.views.results = {
    render(params) {
      const ev = App.event(params[0]);
      const tabs = `<div class="tabs"><a href="#/results" class="${!ev ? 'active' : ''}">🏅 Medali</a>${App.S.events.map((e) => `<a href="#/results/${e.id}" class="${ev && e.id === ev.id ? 'active' : ''}">${esc(e.name)}</a>`).join('')}</div>`;
      if (ev) {
        return `<h2>${esc(App.S.menu.results)}</h2>${tabs}<div class="card"><div class="row between"><h3>${esc(ev.name)}</h3><a class="btn sm ghost" href="#/print/result/${ev.id}">🖨️ Hasil resmi</a></div>${App.eventResultHtml(ev, App.isAdmin())}</div>`;
      }
      const { rows, perEvent } = App.medalTally();
      return `<h2>${esc(App.S.menu.results)}</h2>${tabs}
        <div class="card"><div class="row between"><h3>Klasemen Medali per Kab/Kota</h3><a class="btn sm ghost" href="#/print/medals">🖨️ Rekap medali</a></div>${App.medalTableHtml(rows)}</div>
        <div class="card"><h3>Peraih Medali per Nomor</h3><div class="table-wrap"><table><thead><tr><th>Nomor</th><th>🥇 Emas</th><th>🥈 Perak</th><th>🥉 Perunggu</th></tr></thead><tbody>
        ${perEvent.map(({ ev: e, medalists, final }) => `<tr><td><a href="#/results/${e.id}">${esc(e.name)}</a>${final ? '' : ' <small class="muted">(sementara)</small>'}</td>
          ${[1, 2, 3].map((rk) => `<td>${medalists.filter((p) => p.rank === rk).map((p) => esc(App.entryLabel(App.entry(p.entryId)))).join('<br>') || '-'}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div></div>`;
    },
  };

  // ---------- Layar proyektor ----------
  let timer = null;
  const prefKey = 'wb-display';
  const prefs = () => { try { return JSON.parse(localStorage.getItem(prefKey)) || {}; } catch (e) { return {}; } };
  const savePrefs = (p) => { try { localStorage.setItem(prefKey, JSON.stringify(p)); } catch (e) { /* abaikan */ } };

  function slides(p) {
    const list = [];
    const sel = p.events && p.events.length ? p.events : App.S.events.map((e) => e.id);
    sel.forEach((id) => {
      const ev = App.event(id);
      if (!ev) return;
      if (ev.discipline === 'stroke') {
        if (App.entriesOf(ev.id).length) list.push({ title: ev.name, html: App.podiumHtml(ev) + App.strokeRankingTable(ev) });
      } else {
        const d = Fw.data(ev);
        if (Fw.koMatches(ev).length) list.push({ title: ev.name + ' · Bagan', html: App.bracketHtml(ev, false) });
        d.groups.forEach((g) => list.push({ title: `${ev.name} · Grup ${g.name}`, html: App.standingsTable(ev, g) + App.matchListHtml(ev, Fw.groupMatches(ev, g.id), false) }));
      }
    });
    if (p.medals !== false) list.push({ title: 'Klasemen Medali', html: App.medalTableHtml(App.medalTally().rows) });
    return list;
  }

  App.views.display = {
    bare: true,
    render() {
      const p = prefs();
      const E = App.S.event;
      return `<div class="display ${p.theme === 'light' ? 'light' : ''}">
        <header class="dhead">${App.logoImgs('logo')}<div><b>${esc(E.title)}</b><span>${esc(E.sport)} · ${esc(App.fmtDateRange(E.dateStart, E.dateEnd))} · ${esc(E.city)}</span></div><div class="spacer"></div><div id="d-clock"></div></header>
        <h1 id="d-title"></h1><div id="d-body" class="dbody"></div>
        <div class="dctl no-print">
          <a href="#/dashboard" class="btn sm ghost">← Keluar</a>
          <button class="btn sm ghost" id="d-prev">◀</button><button class="btn sm ghost" id="d-next">▶</button>
          <label class="mini">Ganti tiap <input type="number" id="d-int" class="tiny" value="${p.interval || 15}"> detik</label>
          <button class="btn sm ghost" id="d-theme" title="Ganti mode terang / gelap">${p.theme === 'light' ? '🌙 Mode gelap' : '☀ Mode terang'}</button>
          <button class="btn sm ghost" id="d-full">⛶ Layar penuh</button>
          <details><summary class="btn sm ghost">Pilih nomor</summary><div class="dpick">
            ${App.S.events.map((e) => `<label class="chk"><input type="checkbox" data-dev="${e.id}" ${!p.events || !p.events.length || p.events.includes(e.id) ? 'checked' : ''}> ${esc(e.name)}</label>`).join('')}
            <label class="chk"><input type="checkbox" id="d-medals" ${p.medals !== false ? 'checked' : ''}> Klasemen medali</label></div></details>
        </div></div>`;
    },
    mount(root) {
      clearInterval(timer);
      let idx = 0;
      const show = (step = 0) => {
        const title = root.querySelector('#d-title'), body = root.querySelector('#d-body');
        if (App.route().name !== 'display' || !title) return clearInterval(timer);
        const list = slides(prefs());
        if (!list.length) { body.innerHTML = App.ui.empty('Belum ada data.'); return; }
        idx = (idx + step + list.length) % list.length;
        title.textContent = list[idx].title;
        body.innerHTML = list[idx].html;
        App.drawBrackets(body);
      };
      // Ambil data terbaru dari database sebelum ganti slide (admin bisa input di tab/jendela lain).
      const refreshThenShow = async (step) => {
        const fresh = await App.db.get('kv', 'state');
        if (fresh) App.S = App.migrate(fresh);
        show(step);
      };
      const restart = () => { clearInterval(timer); timer = setInterval(() => refreshThenShow(1), Math.max(5, prefs().interval || 15) * 1000); };
      const clock = () => { const el = root.querySelector('#d-clock'); if (el) el.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };
      clock();
      setInterval(clock, 30000);
      show(0); restart();
      root.querySelector('#d-prev').addEventListener('click', () => { show(-1); restart(); });
      root.querySelector('#d-next').addEventListener('click', () => { show(1); restart(); });
      root.querySelector('#d-int').addEventListener('change', (e) => { savePrefs({ ...prefs(), interval: App.num(e.target.value) || 15 }); restart(); });
      root.querySelector('#d-theme').addEventListener('click', (e) => {
        const light = root.querySelector('.display').classList.toggle('light');
        savePrefs({ ...prefs(), theme: light ? 'light' : 'dark' });
        e.currentTarget.textContent = light ? '🌙 Mode gelap' : '☀ Mode terang';
        App.drawBrackets(root.querySelector('#d-body'));
      });
      root.querySelector('#d-full').addEventListener('click', () => document.documentElement.requestFullscreen?.());
      const pick = () => {
        const evs = Array.from(root.querySelectorAll('[data-dev]')).filter((c) => c.checked).map((c) => c.dataset.dev);
        savePrefs({ ...prefs(), events: evs, medals: root.querySelector('#d-medals').checked });
        idx = 0; show(0);
      };
      root.querySelectorAll('[data-dev], #d-medals').forEach((c) => c.addEventListener('change', pick));
    },
  };
})(window.App);
