// Papan pengumuman: dikelola admin, tampil di beranda umum.
(function (App) {
  const esc = App.esc;
  let editId = null;

  // Disematkan dulu, lalu yang terbaru.
  App.sortedAnnouncements = () => (App.S.announcements || []).slice()
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.date || '').localeCompare(a.date || ''));

  App.views.announcements = {
    admin: true,
    render() {
      const a = (editId && (App.S.announcements || []).find((x) => x.id === editId)) || { title: '', body: '', date: App.today(), pinned: false };
      return `<h2>${esc(App.S.menu.announcements || 'Pengumuman')}</h2>
        <form id="an-form" class="card form"><h3>${a.id ? 'Ubah pengumuman' : 'Tulis pengumuman'}</h3>
          <div class="grid3">
            <label>Judul<input name="title" value="${esc(a.title)}" required></label>
            <label>Tanggal<input type="date" name="date" value="${esc(a.date)}" required></label>
          </div>
          <label>Isi<textarea name="body" rows="4" style="font-family:inherit" required>${esc(a.body)}</textarea></label>
          <label class="chk"><input type="checkbox" name="pinned" ${a.pinned ? 'checked' : ''}> Sematkan di paling atas</label>
          <div class="row gap"><button class="btn">${a.id ? 'Simpan' : '+ Terbitkan'}</button>${a.id ? '<button type="button" class="btn ghost" id="an-cancel">Batal</button>' : ''}</div>
        </form>
        <div class="card"><h3>Daftar pengumuman</h3>
          ${App.sortedAnnouncements().map((x) => `<div class="an-item"><div><b>${x.pinned ? '📌 ' : ''}${esc(x.title)}</b> <small class="muted">${esc(App.fmtDate(x.date))}</small>
            <p>${esc(x.body).replace(/\n/g, '<br>')}</p></div>
            <div class="row gap"><button class="btn sm ghost" data-an-edit="${x.id}">Ubah</button><button class="btn sm danger" data-an-del="${x.id}">Hapus</button></div></div>`).join('') || App.ui.empty('Belum ada pengumuman.')}
        </div>`;
    },
    mount(root) {
      const form = root.querySelector('#an-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const data = { title: f.get('title').trim(), body: f.get('body').trim(), date: f.get('date'), pinned: f.get('pinned') === 'on' };
        const cur = editId && App.S.announcements.find((x) => x.id === editId);
        if (cur) Object.assign(cur, data);
        else App.S.announcements.push({ id: App.uid('an_'), ...data });
        editId = null;
        App.commit('Pengumuman tersimpan');
      });
      root.querySelector('#an-cancel')?.addEventListener('click', () => { editId = null; App.rerender(); });
      root.querySelectorAll('[data-an-edit]').forEach((b) => b.addEventListener('click', () => { editId = b.dataset.anEdit; App.rerender(); window.scrollTo(0, 0); }));
      root.querySelectorAll('[data-an-del]').forEach((b) => b.addEventListener('click', async () => {
        const x = App.S.announcements.find((n) => n.id === b.dataset.anDel);
        if (!(await App.ask(`Hapus pengumuman "${x.title}"?`))) return;
        App.S.announcements = App.S.announcements.filter((n) => n.id !== x.id);
        App.commit('Pengumuman dihapus');
      }));
    },
  };
})(window.App);
