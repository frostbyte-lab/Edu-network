# Arsitektur Hosting EDU

## Keputusan

- Satu Cloudflare Pages project untuk seluruh game.
- Setiap game menggunakan path: `domain-edu.example/game-N/`.
- Tidak menggunakan R2.
- Tidak menggunakan wildcard subdomain.
- Backend Worker + D1 berjalan terpisah untuk user, progress, skor, dan logic aplikasi.

## Alasan

Pendekatan ini menghindari batas jumlah project Pages dan menjaga moving parts tetap sedikit. Batas file 25 MB diperiksa otomatis oleh `scripts/check-sizes.js`. Katalog game dibuat dari folder yang tersedia sehingga penambahan game tidak memerlukan perubahan manual pada landing page.

## Integrasi backend di masa depan

Game dapat memanggil Worker API dari JavaScript sisi client untuk menyimpan skor atau progress. Worker harus mengizinkan CORS dari domain Pages produksi. Endpoint dan kontrak API belum didefinisikan di repository ini.

## Deploy

1. Jalankan `npm run prepare-deploy`.
2. Pastikan tidak ada file tunggal di atas 25 MB.
3. Hubungkan repository ini ke satu project Cloudflare Pages.
4. Set custom domain pada project tersebut.
