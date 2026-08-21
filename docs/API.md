# EDU Network API

API ini berjalan sebagai Cloudflare Pages Functions dan memakai binding D1 `EDU_DB` dari database `EDU`. Semua endpoint menggunakan path relatif terhadap domain Pages.

## Cek koneksi

### `GET /api/db-health`

Memastikan Pages Function dapat mengakses D1.

Contoh respons:

```json
{ "ok": true, "database": "EDU" }
```

## Katalog game

### `GET /api/games`

Mengambil semua game dari tabel `games`.

Contoh respons:

```json
{
  "ok": true,
  "games": [
    {
      "id": 1,
      "name": "Game 1",
      "source_domain_id": null,
      "version": "1.0.0",
      "synced_at": "2026-08-21 00:00:00"
    }
  ]
}
```

## Skor

### `POST /api/scores`

Menyimpan skor baru. `game_slug`, `player_id`, dan `score` wajib diisi. `score` harus bilangan bulat nol atau lebih. `metadata` bersifat opsional dan harus berupa object JSON.

Contoh request:

```json
{
  "game_slug": "game-1",
  "player_id": "player-123",
  "score": 850,
  "metadata": { "level": 3, "duration_seconds": 91 }
}
```

Contoh respons:

```json
{ "ok": true, "score_id": 42 }
```

### `GET /api/scores`

Mengambil skor. Filter yang tersedia:

- `game_slug` — filter berdasarkan game
- `player_id` — filter berdasarkan pemain
- `limit` — jumlah hasil, maksimum 100, default 50

Contoh:

```text
/api/scores?game_slug=game-1&limit=20
```

## Catatan keamanan

Endpoint skor saat ini belum memakai autentikasi pemain. Gunakan ID pemain sementara untuk integrasi awal; sebelum produksi, tambahkan Clerk atau Replit Auth dan validasi kepemilikan `player_id` di server.
