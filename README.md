# EDU Network

EDU Network adalah fondasi hosting game edukasi berbasis path untuk platform EDU. Semua game ditempatkan dalam satu Cloudflare Pages project dan diakses melalui URL seperti `/game-1/`, `/game-2/`, hingga `/game-150/`.

## Struktur

- `index.html` — landing page katalog game yang dihasilkan otomatis
- `game-1/` sampai `game-150/` — direktori game statis
- `scripts/generate-index.js` — membuat katalog dari folder game
- `scripts/check-sizes.js` — menolak file yang melebihi batas 25 MB
- `docs/ARSITEKTUR.md` — keputusan arsitektur hosting

## Menjalankan validasi sebelum deploy

```bash
npm run prepare-deploy
```

## Cloudflare Pages

Gunakan root repository ini sebagai output directory dan deploy satu project Pages. Backend Worker + D1 tetap terpisah dari hosting file statis ini.

Game asli dapat menggantikan `game-N/index.html` beserta aset lain tanpa mengubah struktur platform.
