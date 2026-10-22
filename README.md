# Jogo Pasuruan - Server Multiplayer

Folder ini berisi game Jogo Pasuruan beserta server kecil yang menghubungkan pemain.
Siapa saja yang punya alamat webnya bisa ikut main, tanpa akun apa pun.

Isi folder:
- `server.js`      server (tanpa library tambahan)
- `package.json`   keterangan program
- `public/index.html`   game-nya

## Cara memasang di Render (gratis)

### 1. Siapkan akun GitHub
Buka https://github.com/signup lalu daftar. Kalau sudah punya, lewati.

### 2. Buat repository baru
1. Setelah masuk GitHub, klik tombol **+** di pojok kanan atas, pilih **New repository**.
2. Isi **Repository name**: `jogo-pasuruan`.
3. Pilih **Public**.
4. Klik **Create repository**.

### 3. Unggah file
1. Di halaman repository yang kosong, klik tautan **uploading an existing file**.
2. Ekstrak dulu file zip ini di komputermu. Jangan unggah zip-nya.
3. Buka folder hasil ekstrak, pilih SEMUA isinya (`server.js`, `package.json`, `README.md`, dan folder `public`), lalu seret ke halaman GitHub.
   Pastikan folder `public` ikut terunggah beserta `index.html` di dalamnya.
4. Tunggu sampai semua file muncul di daftar, lalu klik **Commit changes**.

### 4. Daftar di Render
Buka https://dashboard.render.com/register lalu pilih **GitHub** untuk masuk.
Izinkan Render melihat repository `jogo-pasuruan`.

### 5. Buat Web Service
1. Di dashboard Render, klik **+ New** lalu pilih **Web Service**.
2. Pilih repository `jogo-pasuruan`, klik **Connect**.
3. Isi seperti ini:
   - **Language**: Node
   - **Branch**: main
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type / Compute**: Free
4. Klik **Deploy** di bagian bawah.

### 6. Tunggu sampai Live
Pantau halaman **Deploys**. Kalau statusnya **Live**, alamat web game muncul di bagian atas halaman service,
bentuknya `https://jogo-pasuruan-xxxx.onrender.com`. Buka alamat itu untuk mencoba.

## Cara bermain bersama
1. Bagikan alamat web itu ke semua pemain.
2. Tiap pemain membuka alamatnya, klik **Multiplayer**, isi **nama**, dan isi **kode ruang yang sama** (misalnya `kelas7a`).
3. Pemain yang masuk pertama menjadi host dan menekan **Mulai Permainan**.
4. Siapa paling cepat dan paling banyak merangkul rombongan pada satu ronde, dia mendapat giliran menjawab soal lebih dulu.

Satu ruang menampung sampai 16 pemain. Untuk permainan yang lancar, disarankan 8 pemain atau kurang.
Kelas atau kelompok berbeda cukup memakai kode ruang yang berbeda.

## Catatan penting
- Server gratis Render tertidur setelah 15 menit tanpa aktivitas. Saat dibuka lagi, perlu sekitar 1 menit untuk bangun.
  Buka alamatnya 1 sampai 2 menit sebelum acara dimulai.
- Kalau server direstart, permainan yang sedang berjalan terputus dan pemain perlu masuk ruang lagi.
- Mode **Main Sendiri** tidak butuh server dan tetap jalan.
- Mencoba di komputer sendiri: pasang Node.js 18 ke atas, jalankan `node server.js` di folder ini, lalu buka http://localhost:3000.

## Kalau ada masalah
- Tombol Masuk menjawab "Belum bisa tersambung": tunggu 1 menit lalu coba lagi.
- Pemain tidak saling terlihat: pastikan kode ruangnya sama persis.
- Deploy **Failed** di Render: buka tab **Logs**, salin pesan merahnya, dan kirim ke yang membantu.
