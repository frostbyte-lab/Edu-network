# Deployment EDU Network

## Project

| Item | Nilai |
|------|--------|
| Cloudflare Pages | `edu-network` |
| Repository | `frostbyte-lab/Edu-network` |
| Branch produksi | `main` |
| Build command | `npm run prepare-deploy` |
| Output directory | `.` |
| Live | https://ea29118c.edu-network.pages.dev |

## Alur resmi (1 game per hari)

1. **Collect** game di Game Collector Pro → unduh ZIP.
2. **Extract** ZIP ke folder sementara, pastikan ada `index.html` di root paket.
3. **Pasang ke slot:**
   ```bash
   node scripts/install-game.js --slot 12 --from /path/ke/extracted-game
   npm run prepare-deploy
   ```
4. **Commit & push:**
   ```bash
   git add game-12
   git commit -m "feat(game-12): deploy collected package"
   git push origin main
   ```
5. Tunggu Pages rebuild (~1–3 menit).
6. Buka `https://ea29118c.edu-network.pages.dev/game-12/`
7. Verifikasi API: `GET /api/db-health` → `{ "ok": true }`

## Direct Upload (darurat)

1. Siapkan **seluruh** isi repo (semua `game-*` yang ingin tetap hidup).
2. Dashboard Cloudflare → Pages → `edu-network` → Create deployment → Upload assets.
3. Ingat: Direct Upload **mengganti** seluruh snapshot, bukan append.

## Middleware

Setelah deploy, `functions/_middleware.js` aktif otomatis (Pages Functions).
Tidak perlu patch manual domain di dalam ZIP — middleware rewrite on-the-fly.

## Checklist pasca-deploy

- [ ] `/api/db-health` → ok
- [ ] `/game-N/` load tanpa error console fatal
- [ ] Network tab: request ke `/api/game/*` (bukan domain provider lama)
- [ ] `window.edu` atau `window.__EDU_GAME_ID__` ada di console
- [ ] Tidak ada file > 25 MB (`npm run check-sizes`)


## Patch permanen (API custom di dalam file)

Setelah `install-game`, file di `game-N/` **sudah** berisi:
- domain API → EDU
- saldo hardcode → 0
- inject SDK + game_id

Jadi kalau kamu **download ulang** dari repo/Pages, API custom sudah terpasang (tidak hanya on-the-fly).

```bash
# Install + patch otomatis
node scripts/install-game.js --slot 12 --from ./extracted --domain https://provider-lama.com

# Re-patch slot yang sudah ada
node scripts/patch-game.js --slot 12 --domain https://provider-lama.com
node scripts/patch-game.js --all
```

Middleware tetap jalan sebagai jaring pengaman untuk yang terlewat.


## Nama di web utama, nomor di admin

```bash
node scripts/install-game.js --slot 12 --from ./fortune-tiger.zip --name "Fortune Tiger"
npm run prepare-deploy
```

- **Web utama** (`/`): kartu menampilkan **nama** (Fortune Tiger), bukan nomor
- **Admin / path teknis**: tetap `game-12` (slot 12)
- Meta disimpan di `game-12/edu-meta.json`
- Daftar admin: `admin/slots.json` (nomor + nama)
- Slot kosong (placeholder tanpa meta) **tidak** tampil di katalog publik
