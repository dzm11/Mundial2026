// Deszyfracja feedów OddsPortal (rynek kursów ładowany jako zaszyfrowany .dat).
//
// OddsPortal od pewnej wersji nie wstawia kursów do DOM-u, tylko dociąga je
// jako zaszyfrowany blob z `/pl/match-event/<...>.dat`. Odszyfrowanie odbywa
// się w przeglądarce (kod w ich bundlu app-*.js). Algorytm (odtworzony 1:1):
//   1. base64(cały payload) -> tekst "<b64_ciphertext>:<hex_iv>"
//   2. klucz = PBKDF2(SHA-256, hasło=PASSWORD, sól=SALT, 1000 iteracji, 256 bit)
//   3. AES-256-CBC(iv) -> bajty; jeśli magic gzip (1f 8b) to gunzip
//   4. wynik to JSON z danymi rynku (oddsdata itd.)
//
// PASSWORD/SALT są zaszyte na stałe w bundlu OddsPortal (stałe globalne FVt/QVt).
// Jeśli kiedyś przestanie działać: znajdź w app-*.js funkcję z `crypto.subtle
// .deriveKey({name:"PBKDF2"...})` i odczytaj nowe wartości z tablicy stringów.
import { webcrypto as crypto } from "crypto"
import { gunzipSync } from "zlib"

const PASSWORD = "J*8sQ!p$7aD_fR2yW@gHn*3bVp#sAdLd_k"
const SALT = "5b9a8f2c3e6d1a4b7c8e9d0f1a2b3c4d"

export async function decryptFeed(payloadB64: string): Promise<string> {
  const outer = Buffer.from(payloadB64, "base64").toString("utf8")
  const sep = outer.indexOf(":")
  if (sep < 0) throw new Error("Feed: brak separatora ':' w payloadzie")
  const ctB64 = outer.slice(0, sep)
  const ivHex = outer.slice(sep + 1)
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)))
  const ct = new Uint8Array(Buffer.from(ctB64, "base64"))

  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey("raw", enc.encode(PASSWORD), { name: "PBKDF2" }, false, ["deriveKey"])
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(SALT), iterations: 1000, hash: "SHA-256" },
    base,
    { name: "AES-CBC", length: 256 },
    false,
    ["decrypt"],
  )
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ct))
  if (pt.length >= 2 && pt[0] === 0x1f && pt[1] === 0x8b) return gunzipSync(Buffer.from(pt)).toString("utf8")
  return new TextDecoder().decode(pt)
}
