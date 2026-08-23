# EDU Network

Hosting game edukasi berbasis path di **satu** Cloudflare Pages project.

Live: **https://ea29118c.edu-network.pages.dev**

Game diakses lewat `/game-1/` … `/game-150/`.

## Arsitektur singkat

```
Pengunjung → Cloudflare Pages
               ├─ static: game-N/*, sdk/*, index.html, admin/, slot/
               └─ functions/
                    ├─ _middleware.js   ← inject SDK + rewrite domain API
                    └─ api/*            ← D1 (scores, spin, config, admin)
```

- File game di-upload **mentah** (tanpa patch manual).
- Patch domain + inject SDK terjadi **on-the-fly** di `_middleware.js`.
- Worker unzip/upload **tidak dipakai** (limit CPU Free plan).

## Struktur repo

| Path | Fungsi |
|------|--------|
| `index.html` | Katalog game (auto-generate) |
| `game-1/` … `game-150/` | Slot game statis |
| `sdk/edu-game-client.js` | Client SDK |
| `functions/_middleware.js` | Rewrite + inject |
| `functions/api/` | API game / slot / admin |
| `scripts/install-game.js` | Pasang ZIP/folder ke slot |
| `scripts/generate-index.js` | Rebuild katalog |
| `scripts/check-sizes.js` | Tolak file > 25 MB |
| `docs/` | Arsitektur, deploy, integrasi API |

## Deploy 1 game

```bash
node scripts/install-game.js --slot 12 --from /path/ke/extracted
npm run prepare-deploy
git add game-12
git commit -m "feat(game-12): deploy package"
git push origin main
```

Tunggu Pages rebuild, buka: `https://ea29118c.edu-network.pages.dev/game-12/`

## Verifikasi

```bash
curl -s https://ea29118c.edu-network.pages.dev/api/db-health
# {"ok":true,"database":"EDU"}
```

Di browser console pada halaman game:

```js
window.__EDU_GAME_ID__  // "game-12"
window.edu              // instance SDK (jika inject berhasil)
```

## Dokumentasi

- [Arsitektur](docs/ARSITEKTUR.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Integrasi API di game](docs/GAME_INTEGRATION.md)
- [Game API](docs/GAME_API.md)
- [Slot virtual](docs/SLOT.md)

## Batas

- Maks **25 MB per file** (Cloudflare Pages)
- 150 slot (`game-1` … `game-150`)
- Direct Upload = snapshot penuh (bukan append) — prefer **Git**
