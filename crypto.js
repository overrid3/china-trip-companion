// Password-based encryption for seed.json.
// The SAME file runs in the browser (index.html) and in node (tools/seed-crypt.js),
// so the encryptor and the decryptor can never drift apart.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CTC = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const webcrypto = globalThis.crypto;
  const subtle = webcrypto.subtle;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // ponytail: 250k PBKDF2 rounds ≈ 0.3 s on a mid-range Android. It runs once per
  // device (the plaintext is cached afterwards), so there is no reason to go lower.
  // Raise it if phones get faster; the count is stored in the envelope, so old
  // files keep opening.
  const ITER = 250000;

  // Chunked: String.fromCharCode(...arr) blows the argument limit on a 30 KB payload.
  function toB64(buf) {
    const a = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(s) {
    const bin = atob(s);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }

  function deriveKey(password, salt, iterations) {
    return subtle
      .importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
      .then((base) =>
        subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        )
      );
  }

  // Envelope is plain JSON so it survives GitHub Pages, the service worker and
  // any text editor. Salt and IV are public by design; only the password isn't.
  async function encrypt(plaintext, password) {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, ITER);
    const ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(plaintext));
    return { v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
  }

  async function decrypt(envelope, password) {
    if (!envelope || envelope.v !== 1) throw new Error("Formato del file non riconosciuto");
    const key = await deriveKey(password, fromB64(envelope.salt), envelope.iter);
    let pt;
    try {
      pt = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(envelope.iv) }, key, fromB64(envelope.ct));
    } catch (e) {
      // AES-GCM verifies an auth tag: a wrong password is the only realistic cause.
      throw new Error("Password sbagliata");
    }
    return dec.decode(pt);
  }

  return { encrypt: encrypt, decrypt: decrypt, ITER: ITER };
});
