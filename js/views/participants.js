// List Peserta (umum): semua atlet per kontingen, dengan cari, saring, dan urutkan di bagian atas.
(function (App) {
  const esc = App.esc;
  const f = { q: '', k: '', ev: '', g: '', sort: 'nama' };

  const SORTS = [['nama', 'Nama A-Z'], ['nama-desc', 'Nama Z-A'], ['nomor', 'Nomor tanding'], ['jumlah', 'Kontingen terbanyak']];

  function listHtml() {
    const S = App.S;
    const q = f.q.trim().toLowerCase();
    const match = (a) => (!q || a.name.toLowerCase().includes(q))
      && (!f.k || a.kontingenId === f.k) && (!f.g || a.gender === f.g) && (!f.ev || (a.events || []).includes(f.ev));
    const evOrder = (a) => Math.min(...(a.events || []).map((id) => S.events.findIndex((e) => e.id === id)).filter((i) => i >= 0), 999);
    const cmp = {
      nama: (a, b) => a.name.localeCompare(b.name),
      'nama-desc': (a, b) => b.name.localeCompare(a.name),
      nomor: (a, b) => evOrder(a) - evOrder(b) || a.name.localeCompare(b.name),
      jumlah: (a, b) => a.name.localeCompare(b.name),
    }[f.sort];
    let groups = S.kontingen.map((k) => ({ k, list: S.athletes.filter((a) => a.kontingenId === k.id && match(a)).sort(cmp) })).filter((x) => x.list.length);
    groups = f.sort === 'jumlah' ? groups.sort((x, y) => y.list.length - x.list.length || x.k.name.localeCompare(y.k.name)) : groups.sort((x, y) => x.k.name.localeCompare(y.k.name));
    const total = groups.reduce((n, x) => n + x.list.length, 0);
    if (!S.athletes.length) return App.ui.empty('Daftar peserta belum tersedia.');
    if (!total) return App.ui.empty('Tidak ada peserta yang cocok dengan pilihan ini.');
    return `<p class="muted small ps-sum">${total} atlet dari ${groups.length} kontingen</p>`
      + groups.map(({ k, list }) => {
        const pa = list.filter((a) => a.gender === 'L').length;
        return `<section class="card ps-k" id="k-${esc(k.id)}">
          <div class="row between wrap"><h3>${esc(k.name)}</h3><span class="muted small">${list.length} atlet · ${pa} putra · ${list.length - pa} putri</span></div>
          <div class="table-wrap"><table><thead><tr><th class="c">No</th><th>Nama</th><th class="c">L/P</th><th>Nomor tanding</th></tr></thead><tbody>
          ${list.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${esc(a.name)}</td><td class="c">${a.gender}</td>
            <td>${(a.events || []).map(App.event).filter(Boolean).map((ev) => `<span class="code" title="${esc(ev.name)}">${esc(ev.code)}</span>`).join(' ')}</td></tr>`).join('')}
          </tbody></table></div></section>`;
      }).join('');
  }

  App.views.peserta = {
    render() {
      const S = App.S;
      return `<h2>${esc(S.menu.peserta || 'List Peserta')}</h2>
        <div class="card ps-filter">
          <div class="ps-controls">
            <label>Cari nama<input id="ps-q" type="search" value="${esc(f.q)}" placeholder="Ketik nama atlet" autocomplete="off"></label>
            <label>Kontingen<select id="ps-k">${App.ui.options([['', 'Semua kontingen'], ...S.kontingen.map((k) => [k.id, k.name])], f.k)}</select></label>
            <label>Nomor tanding<select id="ps-ev">${App.ui.options([['', 'Semua nomor'], ...S.events.map((e) => [e.id, `${e.code} · ${e.name}`])], f.ev)}</select></label>
            <label>Putra/Putri<select id="ps-g">${App.ui.options([['', 'Semua'], ['L', 'Putra'], ['P', 'Putri']], f.g)}</select></label>
            <label>Urutkan<select id="ps-sort">${App.ui.options(SORTS, f.sort)}</select></label>
          </div>
          <details class="legend-wrap"><summary class="muted small">Arti kode nomor</summary>${App.eventLegend()}</details>
        </div>
        <div id="ps-list">${listHtml()}</div>`;
    },
    mount(root) {
      const box = root.querySelector('#ps-list');
      const redraw = () => { box.innerHTML = listHtml(); };
      root.querySelector('#ps-q').addEventListener('input', (e) => { f.q = e.target.value; redraw(); });
      [['#ps-k', 'k'], ['#ps-ev', 'ev'], ['#ps-g', 'g'], ['#ps-sort', 'sort']].forEach(([sel, key]) =>
        root.querySelector(sel).addEventListener('change', (e) => { f[key] = e.target.value; redraw(); }));
    },
  };
})(window.App);
