/**
 * Offline unit test for ZIP writer + HTML/TXT builders.
 * Run: node scripts/test_zip.js
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

// load zip.js into a fake global
const zipSrc = fs.readFileSync(path.join(__dirname, "../lib/zip.js"), "utf8");
const g = { TextEncoder, Blob, Uint8Array, ArrayBuffer, DataView };
// Blob may need Node 18+
eval(zipSrc);
const { ZipWriter } = g.WAZip || global.WAZip || globalThis.WAZip;

async function main() {
  const zip = new ZipWriter();
  const txt = "Hello ZIP\nline2";
  const html = "<!DOCTYPE html><html><body><p>hi</p></body></html>";
  const json = JSON.stringify({ ok: true });
  const bin = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);

  await zip.add("demo/chat.txt", txt);
  await zip.add("demo/chat.html", html);
  await zip.add("demo/chat.json", json);
  await zip.add("demo/media/blob.bin", bin);

  const blob = zip.build();
  const buf = Buffer.from(await blob.arrayBuffer());

  const out = path.join(os.tmpdir(), "wabk_test.zip");
  fs.writeFileSync(out, buf);
  console.log("wrote", out, "bytes", buf.length);

  // Verify local file header signature PK\x03\x04
  if (buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
    throw new Error("Bad ZIP signature");
  }
  // End of central directory
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Missing EOCD");
  const count = buf.readUInt16LE(eocd + 10);
  if (count !== 4) throw new Error("Expected 4 entries, got " + count);
  console.log("ZIP OK: 4 entries, signature valid");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
