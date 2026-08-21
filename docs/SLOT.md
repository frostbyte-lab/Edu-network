# EDU Play — Slot Poin Virtual

## Status

EDU Play adalah game hiburan dengan poin virtual. Poin tidak dapat dibeli, ditukar, ditarik, atau dikonversi menjadi uang. Tidak ada pembayaran atau taruhan real-money.

Halaman live: `/slot/`

## API

### `GET /api/slot/state?player_id=...`

Membuat pemain anonim bila belum ada, lalu mengembalikan saldo dan 10 riwayat spin terakhir. Pemain demo mendapat saldo awal 1.000 poin virtual.

### `POST /api/slot/spin`

Request:

```json
{
  "player_id": "guest-example",
  "stake": 10
}
```

`stake` harus bilangan bulat antara 1 dan 100. Hasil simbol dibuat di server menggunakan Web Crypto. Payout hanya berupa poin virtual:

- Tiga `7`: 10x stake
- Tiga `star`: 5x stake
- Tiga simbol lain yang sama: 3x stake
- Dua simbol sama: 2x stake
- Kombinasi lain: 0

Saldo dikurangi terlebih dahulu, lalu payout ditambahkan.

## Tabel D1

- `slot_players` — saldo poin virtual dan jumlah spin
- `slot_spins` — hasil spin dan riwayat

## Batasan keamanan

Versi ini memakai ID pemain anonim dari browser dan ditujukan untuk hiburan/demo. Untuk leaderboard atau progress produksi, tambahkan autentikasi dan rate limiting. Jangan menambahkan deposit, penarikan, pembayaran, atau penukaran poin.
