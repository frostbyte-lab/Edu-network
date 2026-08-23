# EDU Network — Game API

Base URL (production):

```
https://ea29118c.edu-network.pages.dev
```

Semua endpoint di bawah `/api/game/*` memakai **Cloudflare Pages Functions** + **D1** (`EDU_DB`).

Mata uang = **poin virtual** (`pts`). Bukan uang sungguhan.

---

## Endpoints

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/game/config?game_id=` | Konfigurasi game (RTP, bet, symbols, paytable) |
| POST | `/api/game/init` | Init player + config |
| POST | `/api/game/session` | Buat session baru |
| GET | `/api/game/session?session_id=` / `?player_id=` | Baca session |
| GET | `/api/game/balance?player_id=` | Saldo & statistik |
| POST | `/api/game/bet` | Validasi taruhan (belum potong saldo) |
| POST | `/api/game/spin` | Spin: potong bet, undi, kredit win |
| GET/POST | `/api/game/result` | Ambil hasil spin |
| GET | `/api/game/history?player_id=` | Riwayat aksi + spin |
| POST | `/api/game/collect` | Tutup session, ringkasan saldo |
| POST | `/api/game/bonus` | Bonus harian / freespin / manual |

CORS: `Access-Control-Allow-Origin: *` (siap dipanggil dari ratusan web lain).

---

## Contoh request

### 1. Init
```http
POST /api/game/init
Content-Type: application/json

{
  "player_id": "siswa_001",
  "game_id": "game-1",
  "initial_balance": 10000
}
```

### 2. Session
```http
POST /api/game/session
Content-Type: application/json

{
  "player_id": "siswa_001",
  "game_id": "game-1"
}
```

### 3. Spin
```http
POST /api/game/spin
Content-Type: application/json

{
  "player_id": "siswa_001",
  "game_id": "game-1",
  "session_id": "<session_id>",
  "bet": 10
}
```

### 4. Balance
```http
GET /api/game/balance?player_id=siswa_001
```

### 5. History
```http
GET /api/game/history?player_id=siswa_001&limit=20
```

### 6. Bonus harian
```http
POST /api/game/bonus
Content-Type: application/json

{
  "player_id": "siswa_001",
  "type": "daily"
}
```

### 7. Collect (tutup session)
```http
POST /api/game/collect
Content-Type: application/json

{
  "player_id": "siswa_001",
  "session_id": "<session_id>"
}
```

---

## Flow standar di client game

```
1. GET  /api/game/config?game_id=...
2. POST /api/game/init
3. POST /api/game/session
4. loop:
     POST /api/game/bet   (opsional validasi UI)
     POST /api/game/spin
     GET  /api/game/result?spin_id=...
5. POST /api/game/collect
```

---

## Database (D1)

Migration: `migrations/001_game_api.sql`

Tabel utama:
- `game_players`
- `game_sessions`
- `game_spins`
- `game_history`
- `game_config`

Jalankan sekali:

```bash
npx wrangler d1 execute EDU --remote --file=migrations/001_game_api.sql
```

---

## Integrasi dengan Game Collector / web lain

Di dalam ZIP game, arahkan base API ke:

```
https://ea29118c.edu-network.pages.dev
```

Contoh di JS game:

```js
const API = "https://ea29118c.edu-network.pages.dev";

async function spin(playerId, bet, sessionId) {
  const res = await fetch(`${API}/api/game/spin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      player_id: playerId,
      bet,
      session_id: sessionId,
      game_id: "game-1",
    }),
  });
  return res.json();
}
```

Terkonek dengan sistem:
- GitHub: https://github.com/frostbyte-lab/Edu-network
- Live: https://ea29118c.edu-network.pages.dev/

## RNG level (1 / 2 / 3)

Disimpan di `game_config.meta_json.rng_level`. Dipakai `/api/game/spin`.

| Level | Nama | Efek server |
|-------|------|-------------|
| 1 | Down | Lebih sering kalah, payout ×0.7 |
| 2 | Imbang | Acak adil (default) |
| 3 | Menang | Lebih sering match, payout ×1.15 |

Set via admin:
```http
POST /api/admin/balance
{ "game_id": "game-12", "rng_level": 1 }
```

Atau bersama initial_balance:
```json
{ "game_id": "game-12", "initial_balance": 1000, "rng_level": 3 }
```

Override per request (opsional): body `rng_level` di `POST /api/game/spin`.
