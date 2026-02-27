# Akses Publik Tanpa Kartu

Ini opsi gratis tanpa kartu kredit, memakai server lokal + Cloudflare Tunnel.

## Jalankan

```bash
chmod +x scripts/start_no_card.sh scripts/stop_no_card.sh scripts/get_public_link.sh scripts/install_autostart.sh scripts/uninstall_autostart.sh
./scripts/start_no_card.sh
```

Script akan:

- Menyalakan backend pada port 3000
- Menyalakan tunnel publik cloudflared
- Menampilkan URL publik `https://...trycloudflare.com`

## Hentikan

```bash
./scripts/stop_no_card.sh
```

## Ambil link publik yang aktif

```bash
./scripts/get_public_link.sh
```

## Auto-start saat laptop dinyalakan (login macOS)

```bash
./scripts/install_autostart.sh
```

Untuk mematikan auto-start:

```bash
./scripts/uninstall_autostart.sh
```

## Catatan

- Tetap gratis tanpa kartu
- Link publik berubah tiap kali tunnel dinyalakan ulang
- Laptop harus tetap hidup dan terkoneksi internet agar website tetap bisa diakses
- Auto-start berjalan saat kamu login ke macOS (LaunchAgent)
