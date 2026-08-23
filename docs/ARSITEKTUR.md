# Arsitektur Hosting EDU Network

## Keputusan inti

- **Satu** Cloudflare Pages project untuk seluruh game.
- Setiap game memakai path: `https://ea29118c.edu-network.pages.dev/game-N/`
- **Tidak** memakai R2, **tidak** memakai wildcard subdomain.
- Backend API = **Pages Functions** + binding **D1** (`EDU_DB`).
- File game yang di-upload **tetap mentah** (tidak di-patch sebelum upload).

## Alur deploy (baru)

1. Game dikumpulkan lewat **Game Collector Pro** → ZIP.
2. ZIP di-extract ke folder lokal `game-N/` (1 game = 1 slot).
3. Deploy ke Pages via **Git push** (disarankan) atau Direct Upload.
4. Saat pengunjung buka `/game-N/`, **`functions/_middleware.js`** berjalan:
   - Inject SDK + `window.__EDU_GAME_ID__`
   - Rewrite domain API lama → origin EDU (on-the-fly)
   - Asset (gambar/audio/font) dilewatkan apa adanya

### Kenapa tidak pakai Worker untuk unzip lagi?

Worker Free plan punya limit CPU ~10ms/request. Unzip ratusan file (~20–30 MB) sering gagal (`Failed to fetch` di `/api/hosting/upload`).
Patch dipindah ke middleware Pages → tidak membebani CPU sebelum upload.

## Direct Upload vs Git

| Mode | Sifat | Risiko |
|------|--------|--------|
| Git (repo ini) | Incremental, history jelas | Aman untuk multi-game |
| Direct Upload | **Snapshot penuh** tiap deploy | Game lama hilang jika folder tidak ikut di-upload |

**Aturan:** setiap deploy Direct Upload harus menyertakan **semua** folder `game-*` yang ingin tetap live, atau selalu pakai Git.

## D1 + Pages Functions

- Binding: `EDU_DB` di `wrangler.toml`
- Database ID produksi: `5fc9965a-7f77-436e-943d-cf76ed8968d7`
- Health: `GET /api/db-health`
- API game: `/api/game/*`, slot: `/api/slot/*`, admin: `/api/admin/*`

## Middleware (`functions/_middleware.js`)

| Request | Perilaku |
|---------|----------|
| `OPTIONS` | CORS preflight |
| `/api/*` | Lanjut ke function + pastikan CORS header |
| HTML di `/game-N/` | Inject SDK + `__EDU_GAME_ID__` + rewrite domain |
| JS / JSON / CSS | Rewrite domain API lama → origin EDU |
| Binary (img, audio, font, wasm) | Pass-through |

## Batas file

Maks **25 MB per file** (limit Cloudflare Pages). Dicek oleh `scripts/check-sizes.js`.

## Slot game

- Range: `game-1` … `game-150`
- Placeholder default: `index.html` minimal
- Game real: ganti isi folder `game-N/` utuh (index + assets)
