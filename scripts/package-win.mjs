import { packager } from "@electron/packager";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

const outDir = "release";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const result = await packager({
  dir: ".",
  platform: "win32",
  arch: "x64",
  out: outDir,
  overwrite: true,
  asar: true,
  electronVersion: "28.3.3",
  appCopyright: "CC-Tuner",
  appVersion: "0.1.0",
  ignore: [/release\b/],
});

console.log("Packaged:", result);
