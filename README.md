# Cina · Itinerario — companion PWA

App offline-first per seguire l'itinerario Cina (23 ago → 12 set 2026). Niente backend, niente account: tutto lo stato vive nel `localStorage` di ogni telefono. **Fase 1** = itinerario + navigazione + checklist/note. **Fase 2** (più avanti) = password + wallet biglietti cifrato.

## File
- `index.html` — l'app (vanilla, nessun build).
- `logic.js` — funzioni pure (oggi/riordino/merge/link mappe). Testate da `selftest.js`.
- `seed.json` — **l'itinerario**. Modifica qui giorni/attività (vedi sotto).
- `sw.js` + `manifest.json` + `icon.svg` — offline + installabile.
- `selftest.js` — `node selftest.js` (verifica la logica).

## Deploy su GitHub Pages
1. `git add -A && git commit -m "app" && git push` (remote: `overrid3/china-trip`).
2. GitHub → repo → **Settings → Pages** → Source = `main` / root → Save.
3. URL: **https://overrid3.github.io/china-trip/** (HTTPS obbligatorio per il service worker).

## Installazione su Android (fare **prima** di partire, in Italia)
1. Aprire l'URL in **Chrome**.
2. Menu ⋮ → **Aggiungi a schermata Home** / "Installa app".
3. Aprirla una volta **online**: il service worker scarica tutto → poi funziona **offline**.
4. Ripetere su entrambi i telefoni (lo stato è per-dispositivo, non si sincronizza).

## Navigazione (Cina)
Ogni luogo ha: **🗺 Google Maps** (ricerca per nome, funziona con l'eSIM Trip.com), **🧭 Amap** (fallback senza VPN) e **📋 copia** del nome cinese. Nessuna coordinata: la ricerca per nome evita l'offset GCJ-02.

## Modificare l'itinerario
Edita `seed.json`, poi **bump** `CACHE` in `sw.js` (es. `china-trip-v1` → `-v2`) e fai push: i telefoni installati prendono la nuova versione al riavvio. Gli `id` degli item sono stabili → le tue note/spunte non si perdono.

## Da fare (Fase 2)
- Gate password (PBKDF2) + wallet biglietti cifrato (AES-GCM, IndexedDB) quando esisteranno i QR/prenotazioni reali.
