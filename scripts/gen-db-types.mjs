#!/usr/bin/env node
/**
 * `supabase gen types typescript --linked` çıktısını her platformda
 * UTF-8 olarak `src/types/database.ts` dosyasına yazar.
 *
 * Neden Node üzerinden? PowerShell 5.1'in `>` yönlendirmesi çıktıyı
 * UTF-16 LE + BOM ile yazıyor; TypeScript ve ESLint bunu "binary"
 * olarak görüp derleyemiyor. Node'un writeFileSync utf8 default'u ile
 * bu risk tamamen ortadan kalkar.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { platform } from "node:os";
import { resolve } from "node:path";

const outFile = resolve("src/types/database.ts");
const cliArgs = [
  "supabase",
  "gen",
  "types",
  "typescript",
  "--linked",
  ...process.argv.slice(2),
];

const npxCommand = platform() === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCommand, cliArgs, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

writeFileSync(outFile, result.stdout, { encoding: "utf8" });
console.log(`Wrote ${result.stdout.length} chars to ${outFile}`);
