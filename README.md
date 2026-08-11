# Cina · Itinerario — companion PWA

App offline-first per seguire l'itinerario Cina (23 ago → 12 set 2026). Niente backend, niente account: tutto lo stato vive nel `localStorage` di ogni telefono. **Fase 1** = itinerario + navigazione + checklist/note. **Fase 2** (più avanti) = password + wallet biglietti cifrato.

## File
- `index.html` — l'app (vanilla, nessun build).
- `logic.js` — funzioni pure (oggi/riordino/merge/link mappe/tel/WeChat). Testate da `selftest.js`.
- `crypto.js` — cifratura del seed. **Lo stesso file gira nel browser e nella CLI**, così non possono divergere.
- `seed.json` — **l'itinerario in chiaro**. Non è nel repo (`.gitignore`): è l'originale che modifichi tu.
- `seed.enc.json` — quello che viene pubblicato. Cifrato, inutile senza password.
- `tools/seed-crypt.js` — cifra/decifra il seed.
- `sw.js` + `manifest.json` + `icon.svg` — offline + installabile.
- `selftest.js` — `node selftest.js` (logica + round-trip della cifratura).

## Il seed è cifrato
Il repo è pubblico, quindi l'itinerario (hotel, indirizzi, numeri di prenotazione) non ci va in chiaro.

```bash
node tools/seed-crypt.js encrypt        # seed.json -> seed.enc.json, chiede la password
node tools/seed-crypt.js decrypt        # verifica che si apra
node tools/seed-crypt.js decrypt --write # riscrive seed.json per modificarlo
```

AES-GCM 256 con chiave da PBKDF2-SHA256, 250 000 round. La password non passa mai da `argv`
(finirebbe nella history della shell): prompt nascosto, oppure `SEED_PASS` per gli script.

Nell'app la password si inserisce **una volta per telefono**: il testo in chiaro resta in `localStorage`,
quindi in Cina l'app si apre offline e senza chiedere niente. La chiave di cache è l'IV del file, che
cambia a ogni ri-cifratura: pubblicare un seed nuovo invalida la cache da solo e richiede la password una volta.

⚠️ **Password persa = itinerario perso.** Non c'è recupero, è il senso della cifratura.
Mettila nel password manager di entrambi **e** tieni i `.md` dell'itinerario fuori dall'app.

⚠️ La cifratura non ripulisce la **history di git**: il commit `08fe5ec` contiene ancora il seed in chiaro.
Per chiuderla davvero serve riscrivere quel commit e forzare il push, o cancellare e ricreare il repo.

## Deploy su GitHub Pages
1. `git add -A && git commit -m "app"`, poi `git add -f seed.enc.json` (è gitignorato
   apposta: solo un atto esplicito lo pubblica), infine push. Remote: `overrid3/china-trip-companion`.
2. GitHub → repo → **Settings → Pages** → Source = `main` / root → Save.
3. URL: **https://overrid3.github.io/china-trip-companion/** (HTTPS obbligatorio per il service worker).

## Installazione su Android (fare **prima** di partire, in Italia)
1. Aprire l'URL in **Chrome**.
2. Menu ⋮ → **Aggiungi a schermata Home** / "Installa app".
3. Aprirla una volta **online**: il service worker scarica tutto → poi funziona **offline**.
4. Ripetere su entrambi i telefoni (lo stato è per-dispositivo, non si sincronizza).

## Navigazione (Cina)
Ogni luogo ha: **🗺 Google Maps** (ricerca per nome, funziona con l'eSIM Trip.com), **🧭 Amap** (fallback senza VPN) e **📋 copia** del nome cinese. Nessuna coordinata: la ricerca per nome evita l'offset GCJ-02.

## Modificare l'itinerario
1. `node tools/seed-crypt.js decrypt --write` (se non hai già `seed.json` in locale)
2. edita `seed.json`
3. `node tools/seed-crypt.js encrypt`
4. **bump** `CACHE` in `sw.js` (es. `china-trip-v10` → `-v11`) e push

I telefoni installati prendono la nuova versione al riavvio e richiedono la password una volta.
Gli `id` degli item sono stabili → le tue note/spunte non si perdono.

## Contatti delle strutture
Ogni alloggio nel seed ha `phone`, `ci`/`co` (orari check-in/out), e i flag `noDesk` / `smoking`.
Il tasto 📞 è un normale `tel:`. Il tasto 💬 **copia il numero e apre WeChat**: Tencent non espone
nessun deep link per aggiungere un contatto dal numero, quindi il percorso resta manuale
(*+ › Aggiungi contatti › Numero di telefono*).

## Da fare
- Redesign a 4 schede (Oggi / Viaggio / Wallet / Frasi) — vedi `../china-trip-REDESIGN-v2.html`.
- Feed scadenze pre-partenza + export `.ics`.

**Non** faremo un wallet di file (PDF/QR dentro l'app): la galleria del telefono lo fa già meglio
e IndexedDB può essere svuotato da Chrome sotto pressione di memoria. L'app tiene il **testo copiabile**,
la galleria tiene le **immagini**.
