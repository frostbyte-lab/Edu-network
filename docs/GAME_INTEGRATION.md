# Integrasi API di dalam Game

## 1. Domain API (wajib diset di game)

```js
const API_BASE = "https://ea29118c.edu-network.pages.dev";
// atau relative jika game di-host di domain yang sama:
// const API_BASE = "";
```

## 2. Cara cepat — pakai SDK

```html
<script src="https://ea29118c.edu-network.pages.dev/sdk/edu-game-client.js"></script>
<script>
  const edu = new EduGameClient({
    baseUrl: "https://ea29118c.edu-network.pages.dev",  // DOMAIN
    gameId: "game-1",                          // id game ini
  });

  async function boot() {
    const state = await edu.start();           // config + init + session
    console.log("balance", state.player.balance);

    // saat user tekan SPIN
    const r = await edu.spin(10);
    console.log(r.result.symbols, r.result.win, r.player.balance);
  }
  boot();
</script>
```

## 3. Mapping endpoint → kapan dipanggil

| Endpoint | Kapan di game | Update admin? |
|----------|---------------|---------------|
| `GET /api/game/config` | Load awal (paytable, min/max bet) | — |
| `POST /api/game/init` | Pertama kali player masuk | ✅ player baru |
| `POST /api/game/session` | Mulai sesi main | ✅ session |
| `GET /api/game/balance` | Refresh saldo UI | — |
| `POST /api/game/bet` | Validasi taruhan (opsional) | ✅ history |
| `POST /api/game/spin` | Tombol spin / play | ✅ spin + saldo |
| `GET /api/game/result` | Cek hasil spin_id | — |
| `GET /api/game/history` | Panel riwayat di game | — |
| `POST /api/game/collect` | Keluar / tutup sesi | ✅ session closed |
| `POST /api/game/bonus` | Klaim bonus harian | ✅ history |

Semua write (init/spin/bonus/collect) **otomatis tersimpan di D1** dan muncul di:

**Admin Panel:** https://ea29118c.edu-network.pages.dev/admin/

## 4. Domain di dalam ZIP game (Game Collector)

Saat edit game hasil collector, ganti base URL API ke:

```
https://ea29118c.edu-network.pages.dev
```

Contoh pola yang sering ada di game slot:

```js
// SEBELUM (domain asli game)
const API = "https://provider-asli.com";

// SESUDAH (EDU Network)
const API = "https://ea29118c.edu-network.pages.dev";
```

Path yang dipakai game harus mengarah ke `/api/game/*` (bukan path provider lama).

## 5. Admin panel

- URL: `/admin/`
- Data dari:
  - `GET /api/admin/stats`
  - `GET /api/admin/players`
  - `GET /api/admin/spins`
  - `GET /api/admin/history`

Tidak perlu kode tambahan di game agar admin terisi — cukup panggil API game di atas.
