#!/usr/bin/env node
// Encrypt / decrypt seed.json.
//
//   node tools/seed-crypt.js encrypt          seed.json      -> seed.enc.json
//   node tools/seed-crypt.js decrypt          seed.enc.json  -> checks it opens
//   node tools/seed-crypt.js decrypt --write  seed.enc.json  -> seed.json (per modificarlo)
//
// The password is NEVER an argv argument: it would land in the shell history and
// in `ps`. It comes from a hidden prompt, or from SEED_PASS when scripting.
const fs = require("fs");
const path = require("path");
const CTC = require("../crypto.js");

const DIR = path.join(__dirname, "..");
const PLAIN = path.join(DIR, "seed.json");
const ENC = path.join(DIR, "seed.enc.json");

// Lettore di righe per stdin non interattivo. Il buffer e' condiviso fra le chiamate:
// con una pipe le due righe (password + conferma) arrivano in un solo evento `data`,
// e leggendone una per volta senza conservare il resto la seconda restava vuota —
// il comando rispondeva "le due password non coincidono" anche quando coincidevano.
let stdinBuf = "", stdinEnded = false;
function readLine() {
  const stdin = process.stdin;
  return new Promise((resolve) => {
    const take = () => {
      const i = stdinBuf.indexOf("\n");
      if (i >= 0) {
        const line = stdinBuf.slice(0, i);
        stdinBuf = stdinBuf.slice(i + 1);
        resolve(line.replace(/\r$/, ""));
        return true;
      }
      if (stdinEnded) { const line = stdinBuf; stdinBuf = ""; resolve(line.trim()); return true; }
      return false;
    };
    if (take()) return;
    const onData = (d) => { stdinBuf += d; if (take()) cleanup(); };
    const onEnd = () => { stdinEnded = true; if (take()) cleanup(); };
    const cleanup = () => { stdin.removeListener("data", onData); stdin.removeListener("end", onEnd); };
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
    stdin.on("end", onEnd);
    stdin.resume();
  });
}

// Lettura in raw mode invece che con readline: con `terminal: true` readline
// riscrive la riga (ANSI [0J) e cancellava il prompt, e senza echo il terminale
// restava completamente muto — indistinguibile da un comando bloccato.
// Qui ogni carattere stampa un asterisco, quindi si vede che sta aspettando.
function askHidden(question) {
  if (process.env.SEED_PASS) return Promise.resolve(process.env.SEED_PASS);
  const stdin = process.stdin;

  // Senza TTY (pipe, CI) non c'è niente da mascherare: basta leggere una riga.
  if (!stdin.isTTY) return readLine();

  return new Promise((resolve) => {
    process.stdout.write(question);
    let pw = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = (value) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") return done(pw);
      if (ch === "\u0003") { stdin.setRawMode(false); process.stdout.write("\n"); process.exit(130); } // Ctrl-C
      if (ch === "\u007f" || ch === "\b") {              // backspace
        if (pw) { pw = pw.slice(0, -1); process.stdout.write("\b \b"); }
        return;
      }
      if (ch < " ") return;                              // ignora gli altri caratteri di controllo
      pw += ch;
      process.stdout.write("*");
    };
    stdin.on("data", onData);
  });
}

// Sei parole da questa lista = ~46 bit. Con 250k round di PBKDF2 sono decenni di
// tentativi offline, e si digitano su un telefono senza impazzire — che è il punto:
// la stessa password va inserita a mano su due Android.
const WORDS = ("abete acqua ala albero ancora anello aprile arco argento aria arte asse balena banco barca " +
"bosco botte braccio bronzo bussola caffe calma campo canto capra carta casa cavallo cedro cena cera cerchio " +
"chiave cielo cima cipolla circo citta collina colore conchiglia corda corvo costa cotone cratere cucina cuoio " +
"delta dente deserto dito dono duna erba faro fascia faggio farfalla fiamma fico fiume foglia fondo fonte forno " +
"fossa freccia fumo fungo gabbia galleria gelo giglio ginepro giorno gomma gonna grano grotta gufo isola lago " +
"lampo lana lanterna legno lento leone letto libro limone lince luce luna lupo maglia mano mappa mare marmo " +
"melo mento miele monte mosaico muschio nave nebbia neve nido noce nodo notte nuvola oliva ombra onda orso orto " +
"ostrica pane panca pausa pepe pesca pietra pino piuma polvere ponte porta pozzo prato quercia radice ragno rame " +
"rana remo riva roccia rosa rovo ruota sabbia salice sale scala scoglio seme sentiero sera serra sole sorgente " +
"spiga stagno stella strada tavolo tegola tela tempio terra tetto tiglio torre traccia treno tromba tronco tulipano " +
"uva valle vaso velo vento verde vetro via vigna viola volpe zaffiro zolla").split(" ");

function generate(n) {
  const { randomInt } = require("crypto");
  return Array.from({ length: n }, () => WORDS[randomInt(WORDS.length)]).join("-");
}

async function encrypt() {
  const plaintext = fs.readFileSync(PLAIN, "utf8");
  const seed = JSON.parse(plaintext); // fail loudly rather than encrypt broken JSON

  let p1;
  if (process.argv.includes("--gen")) {
    p1 = generate(6);
    console.log("\n  ┌─ Password generata ─────────────────────────────────────┐");
    console.log("  │                                                         │");
    console.log("  │   " + p1.padEnd(54) + "│");
    console.log("  │                                                         │");
    console.log("  └─────────────────────────────────────────────────────────┘");
    console.log("  Mettila nel password manager di ENTRAMBI, adesso.");
    console.log("  Non esiste recupero: persa questa, il file non si riapre.\n");
  } else {
    // Niente conferma: la password si incolla dal password manager, e un errore di
    // battitura non e' distruttivo — seed.json resta qui, basta rilanciare il comando.
    p1 = await askHidden("Password:  ");
    if (p1.length < 10) throw new Error("Almeno 10 caratteri: è l'unica cosa che protegge il file");
  }

  const envelope = await CTC.encrypt(plaintext, p1);
  // Open it again before writing: never ship a file we cannot decrypt.
  if ((await CTC.decrypt(envelope, p1)) !== plaintext) throw new Error("Verifica round-trip fallita");

  fs.writeFileSync(ENC, JSON.stringify(envelope));
  const kb = (fs.statSync(ENC).size / 1024).toFixed(1);
  const d = seed.days;
  // Non un parametro crittografico: e' l'itinerario che c'e' dentro, cosi' se cifri
  // il file sbagliato te ne accorgi subito.
  console.log(`✓ seed.enc.json  ${kb} KB  ·  AES-GCM 256, ${CTC.ITER} round PBKDF2`);
  console.log(`  Contiene: itinerario di ${d.length} giorni, dal ${d[0].date} al ${d[d.length - 1].date}`);
  console.log("");
  console.log("  Verificalo:   node tools/seed-crypt.js decrypt");
  console.log("  Pubblicalo:   git add -f seed.enc.json   (il -f serve, e' gitignorato apposta)");
  console.log("                git commit --amend --no-edit && git push --force-with-lease");
  console.log("  seed.json resta solo qui: e' l'originale modificabile, non va nel repo.");
}

async function decrypt() {
  const envelope = JSON.parse(fs.readFileSync(ENC, "utf8"));
  const plaintext = await CTC.decrypt(envelope, await askHidden("Password:  "));
  const seed = JSON.parse(plaintext);
  console.log(`✓ apre: ${seed.days.length} giorni — ${seed.title}`);
  if (process.argv[3] === "--write") {
    fs.writeFileSync(PLAIN, plaintext);
    console.log("  seed.json riscritto in chiaro (ricordati di ri-cifrare e non committarlo)");
  }
}

const cmd = process.argv[2];
const run = cmd === "encrypt" ? encrypt : cmd === "decrypt" ? decrypt : null;
if (!run) {
  console.log("uso: node tools/seed-crypt.js encrypt | decrypt [--write]");
  process.exit(1);
}
run().catch((e) => {
  console.error("✗ " + e.message);
  process.exit(1);
});
