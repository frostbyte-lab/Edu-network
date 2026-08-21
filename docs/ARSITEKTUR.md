# Arsitektur Hosting EDU

## Keputusan

- Satu Cloudflare Pages project untuk seluruh game.
- Setiap game menggunakan path: domain-edu.example/game-N/.
- Tidak menggunakan R2.
- Tidak menggunakan wildcard subdomain.
- Backend Worker + D1 berjalan terpisah untuk user, progress, skor, dan logic aplikasi.

## D1 dan Pages Functions

Binding D1 untuk database produksi EDU dikonfigurasi di wrangler.toml dengan nama binding EDU_DB. Endpoint /api/db-health melakukan query ringan untuk memverifikasi bahwa Pages Function dapat mengakses database.

Database ID produksi: 5fc9965a-7f77-436e-943d-cf76ed8968d7.

Game dapat memanggil Worker API dari JavaScript sisi client untuk menyimpan skor atau progress. Pages Functions mengakses binding melalui context.env.EDU_DB. Endpoint bisnis dapat ditambahkan di direktori functions/.

## Deploy

1. Hubungkan repositori ini ke satu project Cloudflare Pages.
2. Set build command ke npm run prepare-deploy dan output directory ke ..
3. Pastikan Pages project menggunakan konfigurasi wrangler.toml dari repository ini.
4. Redeploy project setelah binding D1 ditambahkan.
5. Verifikasi koneksi melalui /api/db-health.

## Batas file

Batas file 25 MB diperiksa otomatis oleh scripts/check-sizes.js.
