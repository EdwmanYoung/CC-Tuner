import { packager } from "@electron/packager";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const outDir = "release";

// Post-build: replace absolute asset paths with relative paths
// Needed because file:// protocol doesn't resolve /_astro/ paths.
function fixPaths() {
  const htmlPath = "dist/index.html";
  let html = readFileSync(htmlPath, "utf-8");
  html = html.replace(/href="\/_astro\//g, 'href="./_astro/');
  html = html.replace(/src="\/_astro\//g, 'src="./_astro/');
  html = html.replace(/href="\/js\//g, 'href="./js/');
  html = html.replace(/src="\/js\//g, 'src="./js/');
  writeFileSync(htmlPath, html);
  console.log("[PostBuild] Fixed asset paths to relative");
}

fixPaths();

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
