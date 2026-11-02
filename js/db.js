// Penyimpanan lokal di browser: IndexedDB (store "kv" untuk data, "files" untuk logo & scan).
(function (App) {
  const DB_NAME = 'woodball-app';
  let dbPromise = null;
  const memFiles = new Map();
  let useFallback = false;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB tidak tersedia'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => {
      console.warn('IndexedDB gagal, memakai localStorage:', e);
      useFallback = true;
      return null;
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const req = fn(s);
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
    }));
  }

  App.db = {
    async get(store, key) {
      await open();
      if (useFallback) {
        if (store === 'files') return memFiles.get(key);
        const v = localStorage.getItem('wb:' + key);
        return v ? JSON.parse(v) : undefined;
      }
      return tx(store, 'readonly', (s) => s.get(key));
    },
    async put(store, key, val) {
      await open();
      if (useFallback) {
        if (store === 'files') return memFiles.set(key, val);
        return localStorage.setItem('wb:' + key, JSON.stringify(val));
      }
      return tx(store, 'readwrite', (s) => s.put(val, key));
    },
    async del(store, key) {
      await open();
      if (useFallback) {
        if (store === 'files') return memFiles.delete(key);
        return localStorage.removeItem('wb:' + key);
      }
      return tx(store, 'readwrite', (s) => s.delete(key));
    },
    async clear(store) {
      await open();
      if (useFallback) {
        if (store === 'files') return memFiles.clear();
        return Object.keys(localStorage).filter((k) => k.startsWith('wb:')).forEach((k) => localStorage.removeItem(k));
      }
      return tx(store, 'readwrite', (s) => s.clear());
    },
    async entries(store) {
      await open();
      if (useFallback) return store === 'files' ? Array.from(memFiles.entries()) : [];
      const db = await open();
      return new Promise((resolve, reject) => {
        const out = [];
        const t = db.transaction(store, 'readonly');
        const req = t.objectStore(store).openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out);
        };
        req.onerror = () => reject(req.error);
      });
    },
    get isFallback() { return useFallback; },
  };

  // Cache file (dataURL) agar render tetap sinkron.
  App.files = {
    cache: new Map(),
    async loadAll() {
      const all = await App.db.entries('files');
      all.forEach(([k, v]) => App.files.cache.set(k, v));
    },
    async add(name, type, dataUrl) {
      const id = App.uid('f_');
      const rec = { id, name, type, dataUrl, created: Date.now() };
      App.files.cache.set(id, rec);
      await App.db.put('files', id, rec);
      return id;
    },
    get(id) { return App.files.cache.get(id); },
    url(id) { const f = App.files.cache.get(id); return f ? f.dataUrl : ''; },
    async remove(id) {
      App.files.cache.delete(id);
      await App.db.del('files', id);
    },
  };
})(window.App);
