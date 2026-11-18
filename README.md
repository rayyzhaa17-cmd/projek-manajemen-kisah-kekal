# Kisah Kekal CRM

Hybrid CRM dan Kanban untuk pipeline booking photobooth. Client React + Vite, server Node + Express, database MySQL.

## Struktur
- client: aplikasi React (Vite, Tailwind, dnd-kit)
- server: API Express, SSE realtime, endpoint booking dari website, script akun dan backup
- database: schema.sql untuk instalasi baru. fase2, fase4, fase6, fase7 untuk upgrade berurutan dari versi lama. create-db-user.sql untuk user MySQL terbatas

## Jalan lokal (XAMPP)
1. Start MySQL di XAMPP, import database/schema.sql lewat phpMyAdmin
2. Copy server/.env.example jadi server/.env
3. npm run setup
4. Buat superadmin pertama: npm run user:add -- email@contoh.com passwordminimal10 superadmin
5. Terminal 1: npm run dev:server. Terminal 2: npm run dev:client
6. Buka http://localhost:5173 lalu masuk

## Upgrade dari versi lama
Jalankan database/fase7.sql di phpMyAdmin, ekstrak project baru menimpa folder lama, npm run setup, restart server. Server menolak start kalau database belum dimigrasi. Sesi login berpindah ke cookie, jadi semua orang perlu login ulang sekali.

## Akun login
Tidak ada pendaftaran lewat website. Superadmin pertama dibuat manual oleh developer dengan npm run user:add -- email password superadmin (password 10 sampai 72 karakter). Setelah itu superadmin menambah, mengubah, dan menghapus akun lain lewat menu Pengaturan. Role admin hanya bisa memakai fitur umum, menu Pengaturan dan export CSV hanya untuk superadmin. Perintah user:add yang sama dipakai untuk reset password, role hanya berubah kalau kata terakhir diisi.

## Produksi, satu proses satu port
npm run setup
npm run build
npm start

Server melayani API sekaligus hasil build client di PORT (default 4000). Di mode ini server menolak jalan kalau JWT_SECRET kurang dari 32 karakter. Buat secret dengan:

    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

## Deploy VPS Ubuntu
1. Install Node 20 dan MySQL, buat database lalu import database/schema.sql
2. Buat user MySQL terbatas lewat database/create-db-user.sql, pakai di DB_USER dan DB_PASS
3. Upload project, isi server/.env (DB_*, JWT_SECRET, TRUST_PROXY=1, BOOKING_KEY kalau dipakai)
4. npm run setup && npm run build
5. npm i -g pm2 && pm2 start ecosystem.config.cjs && pm2 save
6. Nginx di depan, proxy_buffering off wajib supaya notifikasi realtime jalan:

    server {
      server_name crm.domainkamu.com;
      location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
      }
    }

7. certbot --nginx -d crm.domainkamu.com untuk HTTPS. Wajib, tanpa HTTPS cookie sesi tidak aman

## Deploy cPanel (Setup Node.js App)
1. Build di komputer sendiri (npm run build), upload seluruh project termasuk client/dist
2. Buat database dan user MySQL lewat cPanel dengan hak SELECT, INSERT, UPDATE, DELETE, import database/schema.sql
3. Setup Node.js App: startup file server/start.js, isi environment variable sesuai server/.env.example
4. Klik Run NPM Install lalu Restart

## Booking dari website
Aktif hanya kalau BOOKING_KEY diisi (minimal 24 karakter acak). POST ke /api/public/booking dengan header x-booking-key. Body boleh teks form booking atau data JSON. Kartu masuk ke list pertama board pertama, atau ke BOOKING_LIST_ID kalau diisi.

Panggil endpoint ini dari server website (edge function, API route, backend), jangan dari JavaScript di browser, karena BOOKING_KEY akan terlihat publik.

    fetch('https://crm.domainkamu.com/api/public/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-booking-key': process.env.BOOKING_KEY },
      body: JSON.stringify({ text: teksFormBooking }),
    })

Kalau website beda domain dengan CRM, isi CORS_ORIGIN dengan domain website.

## Keamanan
Sudah ada:
- password bcrypt, 10 sampai 72 karakter
- sesi cookie HttpOnly dan SameSite Strict, berlaku 12 jam, hangus otomatis saat password diganti atau akun dihapus
- proteksi CSRF lewat header khusus pada semua request pengubah data
- akun terkunci 15 menit setelah 5 kali salah login (per IP dan email), plus rate limit per IP
- role dicek dari database di setiap request, hapus board dan export CSV hanya superadmin
- semua input divalidasi dan dibatasi panjangnya, query memakai parameter
- header keamanan termasuk CSP, dan HSTS saat HTTPS
- log aktivitas (menu Pengaturan) untuk login, perubahan, dan penghapusan data
- backup lewat npm run backup

Belum ada: 2FA, tempat sampah atau undo untuk data yang dihapus, izin akses per board, pentest independen.

Checklist sebelum dipakai perusahaan:
1. HTTPS aktif dan TRUST_PROXY=1 di belakang Nginx
2. JWT_SECRET acak minimal 32 karakter
3. Pakai user MySQL terbatas, bukan root
4. Jadwalkan backup dan simpan hasilnya di tempat aman, isinya data pelanggan
5. Jalankan npm audit berkala dan update dependency
6. Data pelanggan termasuk data pribadi (UU PDP), tentukan siapa yang berhak akses dan berapa lama data disimpan

## Backup
    npm run backup

Hasil di server/backups, memuat seluruh data termasuk data pelanggan dan hash password, jadi simpan dengan aman. File lama di atas BACKUP_KEEP otomatis dihapus. Jadwal harian di Linux:

    0 2 * * * cd /path/ke/crm-kanban && npm run backup

Di Windows pakai Task Scheduler dengan perintah yang sama. Restore: import file .sql lewat phpMyAdmin atau mysql -u user -p crm_kanban < file.sql (tabel lama ditimpa).

## Environment
- DB_HOST, DB_USER, DB_PASS, DB_NAME: koneksi MySQL
- JWT_SECRET: wajib di produksi, minimal 32 karakter acak
- BOOKING_KEY: kosong berarti booking dari website mati. Kalau diisi minimal 24 karakter
- BOOKING_LIST_ID: opsional, list tujuan booking masuk
- CORS_ORIGIN: opsional, domain website booking
- TRUST_PROXY: isi 1 kalau di belakang Nginx
- PORT: default 4000
- BACKUP_KEEP: jumlah file backup yang disimpan, default 14
