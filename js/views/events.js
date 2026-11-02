// Halaman Nomor & Entri: daftar nomor, aturan tiap nomor, entri (single/pasangan/tim).
(function (App) {
  const esc = App.esc;

  function summary(ev) {
    const c = ev.config;
    if (ev.discipline === 'stroke') {
      if (ev.kind === 'team') return `Jumlah ${c.countBest} pemain terbaik dari ${esc((App.event(c.sourceEvent) || {}).name || '?')}`;
      return c.rounds.map((r) => `${esc(r.name)} (${r.gates}${r.cut ? `, ${r.cut} besar` : ''})`).join(' → ');
    }
    return `${App.fairway.FORMATS[c.format]}${c.format === 'group_ko' ? ` · ${c.groupCount} grup, ${c.qualify} lolos` : ''} · ${App.fairway.THIRD[c.thirdPlace]}`;
  }

  App.views.events = {
    admin: true,
    render(params) {
      if (params[0]) return renderDetail(App.event(params[0]));
      const rows = App.S.events.map((ev, i) => `<tr>
        <td class="c">${i + 1}</td><td><b>${esc(ev.code)}</b></td><td><a href="#/events/${ev.id}">${esc(ev.name)}</a></td>
        <td>${ev.discipline === 'stroke' ? 'Stroke' : 'Fairway'} · ${App.kindLabel(ev.kind)} · ${App.genderLabel(ev.gender)}</td>
        <td class="c">${App.entriesOf(ev.id).length}</td><td class="small">${summary(ev)}</td>
        <td class="nowrap"><button class="btn sm ghost" data-up="${i}" title="Naik">↑</button><button class="btn sm ghost" data-down="${i}" title="Turun">↓</button></td></tr>`).join('');
      return `<div class="card"><h2>${esc(App.S.menu.events)}</h2>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Kode</th><th>Nomor</th><th>Jenis</th><th>Entri</th><th>Aturan</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <form id="ev-add" class="row gap wrap">
          <input name="code" placeholder="Kode (mis. SS-PA)" required style="max-width:140px">
          <input name="name" placeholder="Nama nomor" required>
          <select name="discipline">${App.ui.options([['stroke', 'Stroke'], ['fairway', 'Fairway']])}</select>
          <select name="kind">${App.ui.options([['single', 'Single'], ['double', 'Double'], ['team', 'Team']])}</select>
          <select name="gender">${App.ui.options([['L', 'Putra'], ['P', 'Putri'], ['X', 'Campuran']])}</select>
          <button class="btn">+ Tambah nomor</button>
        </form></div>`;
    },
    mount(root, params) {
      if (params[0]) return mountDetail(root, App.event(params[0]));
      const move = (i, d) => {
        const a = App.S.events, j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]];
        App.commit();
      };
      root.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => move(+b.dataset.up, -1)));
      root.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => move(+b.dataset.down, 1)));
      root.querySelector('#ev-add').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const code = f.get('code').trim().toUpperCase();
        if (App.S.events.some((x) => x.code === code)) return App.toast('Kode sudah dipakai', 'err');
        const kind = f.get('kind');
        App.S.events.push({
          id: App.uid('ev_'), code, name: f.get('name').trim(), discipline: f.get('discipline'), kind, gender: f.get('gender'),
          members: kind === 'single' ? 1 : kind === 'double' ? 2 : 4, config: App.newEventTemplate(f.get('discipline'), kind),
        });
        App.commit('Nomor ditambahkan');
      });
    },
  };

  // ---------- Detail nomor ----------
  function configForm(ev) {
    const c = ev.config;
    const num = (name, val, label, min = 0) => `<label>${label}<input type="number" min="${min}" data-cfg="${name}" value="${val ?? ''}"></label>`;
    let html = '';
    if (ev.discipline === 'stroke' && ev.kind !== 'team') {
      html += `<h4>Ronde</h4><div class="table-wrap"><table><thead><tr><th>#</th><th>Nama ronde</th><th>Jumlah gate</th><th>Cut (hanya N besar)</th><th></th></tr></thead><tbody>
        ${c.rounds.map((r, i) => `<tr><td class="c">${i + 1}</td><td><input data-round="${i}" data-f="name" value="${esc(r.name)}"></td>
        <td><input type="number" min="1" data-round="${i}" data-f="gates" value="${r.gates}" style="max-width:90px"></td>
        <td><input type="number" min="0" data-round="${i}" data-f="cut" value="${r.cut || ''}" placeholder="semua" style="max-width:110px"></td>
        <td><button class="btn sm danger" data-round-del="${i}">Hapus</button></td></tr>`).join('')}
        </tbody></table></div><button class="btn sm ghost" id="round-add">+ Tambah ronde</button>
        <div class="grid4">${num('groupSize', c.groupSize, 'Peserta per pairing', 1)}${num('maxPerKontingen', c.maxPerKontingen, 'Maks. entri per kontingen')}</div>`;
    } else if (ev.discipline === 'stroke') {
      const src = App.event(c.sourceEvent);
      html += `<div class="grid4">
        <label>Sumber skor (nomor single)<select data-cfg-s="sourceEvent">${App.ui.options([['', '-'], ...App.S.events.filter((x) => x.discipline === 'stroke' && x.kind === 'single').map((x) => [x.id, x.name])], c.sourceEvent)}</select></label>
        ${num('countBest', c.countBest, 'Jumlah pemain yang dihitung', 1)}${num('maxPerKontingen', c.maxPerKontingen, 'Maks. tim per kontingen')}</div>
        <div class="chks"><span class="muted">Ronde yang dihitung:</span> ${src ? src.config.rounds.map((r, i) => `<label class="chk"><input type="checkbox" data-srcround="${i}" ${c.sourceRounds.includes(i) ? 'checked' : ''}> ${esc(r.name)}</label>`).join('') : '-'}</div>`;
    } else {
      html += `<div class="grid4">
        <label>Format<select data-cfg-s="format">${App.ui.options(Object.entries(App.fairway.FORMATS), c.format)}</select></label>
        ${num('groupCount', c.groupCount, 'Jumlah grup', 1)}${num('qualify', c.qualify, 'Lolos per grup ke bagan', 1)}
        <label>Juara 3<select data-cfg-s="thirdPlace">${App.ui.options(Object.entries(App.fairway.THIRD), c.thirdPlace)}</select></label>
        ${num('gates', c.gates, 'Jumlah gate', 1)}${num('winPoints', c.winPoints, 'Poin per kemenangan (klasemen)')}${num('maxPerKontingen', c.maxPerKontingen, 'Maks. entri per kontingen')}</div>`;
      if (ev.kind === 'team') {
        html += `<h4>Posisi pemain & partai (best of ${c.games.length})</h4>
          <div class="grid4">${c.slots.map((s, i) => `<label>Posisi ${i + 1}<input data-slot="${i}" value="${esc(s)}"></label>`).join('')}</div>
          ${c.games.map((g, gi) => `<div class="row gap wrap"><input data-game="${gi}" value="${esc(g.label)}" style="max-width:180px">
            ${c.slots.map((s, si) => `<label class="chk"><input type="checkbox" data-game-slot="${gi}:${si}" ${g.slots.includes(si) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}</div>`).join('')}`;
      }
    }
    if (ev.discipline === 'stroke') {
      const tb = c.tiebreak || [];
      const avail = Object.keys(App.stroke.TIEBREAKS).filter((k) => !tb.includes(k));
      html += `<h4>Urutan penentuan jika skor sama</h4><ol class="tb">${tb.map((k, i) => `<li>${esc(App.stroke.TIEBREAKS[k])}
        <button class="btn sm ghost" data-tb-up="${i}">↑</button><button class="btn sm ghost" data-tb-del="${i}">✕</button></li>`).join('')}</ol>
        ${avail.length ? `<select id="tb-add"><option value="">+ tambah kriteria…</option>${App.ui.options(avail.map((k) => [k, App.stroke.TIEBREAKS[k]]))}</select>` : ''}`;
    }
    return html;
  }

  function entryRow(ev, e, i) {
    const opts = (cur, slotIdx) => {
      let list = App.eligibleAthletes(ev, e.kontingenId);
      if (ev.gender === 'X' && ev.kind === 'double') list = list.filter((a) => a.gender === (slotIdx === 0 ? 'L' : 'P'));
      return `<option value="">-</option>` + list.map((a) => `<option value="${a.id}" ${a.id === cur ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
    };
    const slotNames = ev.discipline === 'fairway' && ev.kind === 'team' ? ev.config.slots : null;
    const members = Array.from({ length: ev.members }, (_, s) => `<label class="mini">${slotNames ? esc(slotNames[s]) : ev.gender === 'X' && ev.kind === 'double' ? (s === 0 ? 'Putra' : 'Putri') : 'Pemain ' + (s + 1)}
      <select data-member="${e.id}:${s}">${opts(e.members[s], s)}</select></label>`).join('');
    return `<tr><td class="c">${i + 1}</td><td><select data-ek="${e.id}">${App.ui.kontingenOptions(e.kontingenId)}</select></td>
      <td><div class="members">${members}</div></td><td><button class="btn sm danger" data-edel="${e.id}">Hapus</button></td></tr>`;
  }

  function renderDetail(ev) {
    if (!ev) return App.ui.empty('Nomor tidak ditemukan.');
    const entries = App.entriesOf(ev.id);
    const reg = App.S.athletes.filter((a) => (a.events || []).includes(ev.id)).length;
    return `<p><a href="#/events">← Semua nomor</a></p>
      <div class="card"><div class="row between"><h2>${esc(ev.name)}</h2><button class="btn sm danger" id="ev-del">Hapus nomor</button></div>
        <div class="grid4">
          <label>Kode<input id="ev-code" value="${esc(ev.code)}"></label>
          <label>Nama nomor<input id="ev-name" value="${esc(ev.name)}"></label>
          <label>Kategori<select id="ev-gender">${App.ui.options([['L', 'Putra'], ['P', 'Putri'], ['X', 'Campuran']], ev.gender)}</select></label>
          <label>Jenis<input value="${ev.discipline === 'stroke' ? 'Stroke' : 'Fairway'} · ${App.kindLabel(ev.kind)} (${ev.members} pemain)" disabled></label>
        </div>
        <h3>Aturan</h3>${configForm(ev)}
      </div>
      <div class="card"><div class="row between"><h3>Entri (${entries.length})</h3>
        <div class="row gap"><button class="btn sm ghost" id="e-auto">⚡ Dari pendaftaran atlet (${reg})</button><button class="btn sm" id="e-add">+ Entri</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Kontingen</th><th>Pemain</th><th></th></tr></thead><tbody>
        ${entries.map((e, i) => entryRow(ev, e, i)).join('') || `<tr><td colspan="4">${App.ui.empty('Belum ada entri.')}</td></tr>`}</tbody></table></div>
      </div>`;
  }

  function mountDetail(root, ev) {
    if (!ev) return;
    const c = ev.config;
    const $ = (s) => root.querySelector(s);
    $('#ev-code').addEventListener('change', (e) => { ev.code = e.target.value.trim().toUpperCase(); App.commit(); });
    $('#ev-name').addEventListener('change', (e) => { ev.name = e.target.value.trim(); App.commit(); });
    $('#ev-gender').addEventListener('change', (e) => { ev.gender = e.target.value; App.commit(); });
    $('#ev-del').addEventListener('click', () => {
      if (!confirm(`Hapus nomor ${ev.name} beserta semua entri & skornya?`)) return;
      App.S.events = App.S.events.filter((x) => x.id !== ev.id);
      App.S.entries = App.S.entries.filter((x) => x.eventId !== ev.id);
      delete App.S.stroke[ev.id];
      delete App.S.fairway[ev.id];
      App.save();
      App.go('events');
    });
    root.querySelectorAll('[data-cfg]').forEach((inp) => inp.addEventListener('change', () => { c[inp.dataset.cfg] = App.num(inp.value); App.commit('Aturan disimpan'); }));
    root.querySelectorAll('[data-cfg-s]').forEach((inp) => inp.addEventListener('change', () => { c[inp.dataset.cfgS] = inp.value || null; App.commit('Aturan disimpan'); }));
    root.querySelectorAll('[data-round]').forEach((inp) => inp.addEventListener('change', () => {
      const r = c.rounds[+inp.dataset.round], f = inp.dataset.f;
      r[f] = f === 'name' ? inp.value : App.num(inp.value) || (f === 'gates' ? 12 : null);
      App.commit('Ronde disimpan');
    }));
    root.querySelectorAll('[data-round-del]').forEach((b) => b.addEventListener('click', () => {
      if (c.rounds.length <= 1) return App.toast('Minimal 1 ronde', 'err');
      if (!confirm('Hapus ronde ini? Skor ronde tersebut ikut terhapus.')) return;
      const i = +b.dataset.roundDel;
      c.rounds.splice(i, 1);
      App.stroke.data(ev).rounds.splice(i, 1);
      App.commit();
    }));
    $('#round-add')?.addEventListener('click', () => { c.rounds.push({ name: `Ronde ${c.rounds.length + 1}`, gates: 12, cut: null }); App.commit(); });
    root.querySelectorAll('[data-srcround]').forEach((cb) => cb.addEventListener('change', () => {
      const i = +cb.dataset.srcround;
      c.sourceRounds = cb.checked ? [...new Set([...c.sourceRounds, i])].sort() : c.sourceRounds.filter((x) => x !== i);
      App.commit();
    }));
    root.querySelectorAll('[data-slot]').forEach((inp) => inp.addEventListener('change', () => { c.slots[+inp.dataset.slot] = inp.value; App.commit(); }));
    root.querySelectorAll('[data-game]').forEach((inp) => inp.addEventListener('change', () => { c.games[+inp.dataset.game].label = inp.value; App.commit(); }));
    root.querySelectorAll('[data-game-slot]').forEach((cb) => cb.addEventListener('change', () => {
      const [gi, si] = cb.dataset.gameSlot.split(':').map(Number);
      const g = c.games[gi];
      g.slots = cb.checked ? [...new Set([...g.slots, si])].sort() : g.slots.filter((x) => x !== si);
      App.commit();
    }));
    root.querySelectorAll('[data-tb-up]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.tbUp;
      if (i > 0) [c.tiebreak[i - 1], c.tiebreak[i]] = [c.tiebreak[i], c.tiebreak[i - 1]];
      App.commit();
    }));
    root.querySelectorAll('[data-tb-del]').forEach((b) => b.addEventListener('click', () => { c.tiebreak.splice(+b.dataset.tbDel, 1); App.commit(); }));
    $('#tb-add')?.addEventListener('change', (e) => { if (e.target.value) { c.tiebreak.push(e.target.value); App.commit(); } });

    $('#e-add').addEventListener('click', () => {
      App.S.entries.push({ id: App.uid('e_'), eventId: ev.id, kontingenId: '', members: Array(ev.members).fill(null) });
      App.commit();
    });
    $('#e-auto').addEventListener('click', () => {
      const n = App.autoEntries(ev);
      App.commit(n ? `${n} entri dibuat` : 'Tidak ada pendaftaran baru');
    });
    root.querySelectorAll('[data-ek]').forEach((sel) => sel.addEventListener('change', () => {
      const e = App.entry(sel.dataset.ek);
      e.kontingenId = sel.value;
      e.members = e.members.map((m) => (m && App.athlete(m)?.kontingenId === sel.value ? m : null));
      App.commit();
    }));
    root.querySelectorAll('[data-member]').forEach((sel) => sel.addEventListener('change', () => {
      const [eid, s] = sel.dataset.member.split(':');
      App.entry(eid).members[+s] = sel.value || null;
      App.commit();
    }));
    root.querySelectorAll('[data-edel]').forEach((b) => b.addEventListener('click', () => {
      if (!confirm('Hapus entri ini?')) return;
      App.removeEntry(b.dataset.edel);
      App.commit('Entri dihapus');
    }));
  }
})(window.App);
