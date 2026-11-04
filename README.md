# E-Woodball · Sistem Skor Pertandingan Woodball

Aplikasi lokal untuk mengelola pertandingan Woodball, yaitu peserta, undian grup, input skor, ranking, bagan, medali, dan cetak PDF.
Default diatur untuk **PORPROV VIII Kaltim 2026** (18–22 November 2026, Paser), dan semuanya bisa diubah di mode admin untuk event lain.

## Cara menjalankan

1. Buka folder ini, lalu klik dua kali **`index.html`** (pakai **Chrome** atau **Edge**).
2. Klik **Masuk Admin**. Saat pertama kali, buat PIN admin.
3. Data tersimpan otomatis di browser laptop tersebut. Tidak perlu internet.

> Selalu buka file `index.html` yang sama dengan browser yang sama. Data tidak ikut pindah kalau ganti browser atau laptop. Untuk memindahkan data, pakai **Backup Data → Backup lengkap**, lalu **Pulihkan** di perangkat tujuan.

### Versi online (Vercel)

Repo ini berupa situs statis, jadi bisa langsung di-import ke Vercel tanpa pengaturan tambahan:
**Framework Preset: Other**, Build Command dikosongkan, Output Directory dibiarkan default (root).
Data tetap tersimpan di browser masing-masing perangkat, bukan di server.

## Alur kerja

| Langkah | Menu |
|---|---|
| Atur identitas event, logo, penandatangan, teks sertifikat, validasi | **Pengaturan** |
| Cek daftar Kab/Kota | **Kontingen** |
| Atur formulir, lalu periksa dan terima kiriman official | **Pendaftaran** |
| Tulis pengumuman untuk beranda umum | **Pengumuman** |
| Input atlet (manual atau tempel dari Excel) dan nomor yang diikuti | **Atlet** |
| Klik **⚡ Buat entri otomatis**, lalu cek pasangan/tim dan aturan tiap nomor | **Nomor & Entri** |
| Undi pairing (acak / ranking / manual), input skor per gate, upload scan score card | **Stroke** |
| Undi grup atau seed, input skor per pertandingan, buat bagan | **Fairway** |
| Lihat ranking, klasemen, bagan, dan rekap medali | **Hasil & Medali** |
| Cetak A4 landscape atau simpan sebagai PDF | **Cetak PDF** |
| Tampilan besar yang berganti otomatis untuk proyektor | **Layar Proyektor** |

## Pendaftaran oleh official (`daftar.html`)

1. Admin membuka menu **Pendaftaran**: atur batas waktu dan kontak panitia, lalu salin pesan undangan WhatsApp.
2. Official membuka menu **Pendaftaran** di halaman umum, memilih Kab/Kota, mengetik ulang namanya dengan huruf kapital, lalu mengisi nama atlet dan nomor tanding.
3. Official mengklik **Kirim ke panitia**. Kalau internet bermasalah, **Unduh berkas** lalu kirim file-nya lewat WhatsApp/email.
4. Kiriman masuk ke menu **Pendaftaran**. Admin memeriksa catatan, lalu **Terima** atau **Tolak**. Nama kabupaten bisa diketik siapa saja, jadi setiap kiriman tetap perlu diperiksa.

Formulir mengambil logo, kontingen, nomor, dan pengaturan dari server. `pendaftaran.json` hanya dipakai kalau server tidak bisa dihubungi.

## Aturan (default dari THB, bisa diubah per nomor)

- **Single Stroke:** Penyisihan R1 + R2 (24 fairway), lalu Final 12 besar (12 fairway). Pairing final diurutkan dari ranking.
  Jika skor sama: pukulan terkecil per fairway di babak terakhir → urutan manual (adu penalti).
- **Team Stroke:** jumlah skor 4 pemain dari Single Stroke R1 + R2. Jika sama: skor pemain terbaik → manual.
- **Double / Mix Stroke:** 2 ronde (24 fairway), langsung diranking.
- **Fairway (Single/Double/Mix):** pilih format **gugur**, **grup + bagan**, atau **setengah kompetisi**.
  Pemenang gate mendapat nilai 1. Jika sama setelah 12 gate, lanjut sudden death (PK1, PK2, …). Pertandingan otomatis selesai jika selisih sudah tidak terkejar.
- **Team Fairway:** 3 partai (Tunggal I, Ganda, Tunggal II), best of 3, dengan format yang bisa dipilih.
- **Juara 3:** perebutan juara 3, juara 3 bersama, atau tanpa juara 3.
- **Validasi** hanya berupa peringatan dan bisa dinyalakan/dimatikan: maks. 2 nomor per atlet, Stroke ≠ Fairway, batas entri per kontingen.

## Struktur kode

```
index.html          halaman utama
css/app.css         tampilan + aturan cetak A4 landscape
js/util.js          helper umum
js/db.js            penyimpanan IndexedDB (data, logo, scan)
js/defaults.js      data awal PORPROV (nomor, kontingen, teks)
js/store.js         state & selector
js/stroke.js        logika stroke (ronde, grup, ranking, tie-break)
js/fairway.js       logika fairway (gate, sudden death, grup, bagan, tim)
js/medals.js        peringkat akhir, rekap medali, validasi
js/app.js           router, layout, mode admin
js/views/*.js       halaman-halaman aplikasi
js/reg.js           aturan & format berkas pendaftaran (dipakai admin dan formulir)
daftar.html         formulir pendaftaran untuk official (js/daftar.js, css/daftar.css)
```

Tanpa build tool, jadi bisa langsung di-hosting di Vercel atau GitHub Pages. Sinkron online memakai Supabase (lihat `js/cloud.js`).
