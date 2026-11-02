// Helper umum yang dipakai seluruh aplikasi.
window.App = window.App || {};

(function (App) {
  App.uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  App.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  App.$ = (sel, root = document) => root.querySelector(sel);
  App.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  App.num = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  App.fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${BULAN[m - 1]} ${y}`;
  };
  App.fmtDateRange = (a, b) => {
    if (!a) return '';
    if (!b || a === b) return App.fmtDate(a);
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    if (y1 === y2 && m1 === m2) return `${d1} - ${d2} ${BULAN[m2 - 1]} ${y2}`;
    return `${App.fmtDate(a)} - ${App.fmtDate(b)}`;
  };
  // Umur "X tahun Y bulan Z hari" pada tanggal acuan (default: hari pertama event).
  App.age = (birth, ref) => {
    if (!birth) return null;
    ref = ref || App.S?.event?.dateStart || App.today();
    const [y1, m1, d1] = birth.split('-').map(Number);
    const [y2, m2, d2] = ref.split('-').map(Number);
    if (!y1 || !y2) return null;
    let y = y2 - y1, m = m2 - m1, d = d2 - d1;
    if (d < 0) { m--; d += new Date(y2, m2 - 1, 0).getDate(); } // hari dalam bulan sebelum bulan acuan
    if (m < 0) { y--; m += 12; }
    return y < 0 ? null : { y, m, d };
  };
  App.ageText = (birth, ref) => {
    const a = App.age(birth, ref);
    return a ? `${a.y} tahun ${a.m} bulan ${a.d} hari` : '';
  };
  App.today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  App.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  App.chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Hash sederhana untuk PIN admin (hanya pengunci tampilan, bukan keamanan sungguhan).
  App.hash = (str) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };

  App.download = (filename, content, type = 'application/json') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  App.readFile = (file, as = 'dataURL') => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    if (as === 'text') r.readAsText(file); else r.readAsDataURL(file);
  });

  // Perkecil gambar besar (scan HP) supaya database tidak cepat penuh.
  // keepAlpha: simpan sebagai PNG agar latar transparan (logo) tidak berubah hitam.
  App.compressImage = (dataUrl, maxSide = 2000, quality = 0.85, keepAlpha = false) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      if (scale === 1 && (keepAlpha || dataUrl.length < 1.5e6)) return resolve(dataUrl);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(keepAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

  let toastTimer;
  App.toast = (msg, kind = 'ok') => {
    let el = App.$('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = ''), 2600);
  };

  App.ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  App.MEDAL = { 1: 'Emas', 2: 'Perak', 3: 'Perunggu' };
})(window.App);
