import { cpSync, readFileSync, rmSync, writeFileSync } from "fs";

const DIST_DIR = "./dist";
const ENTRY = "./index.ts";
const STEAM_DLL = "./node_modules/steamworks.js/dist/win64/steam_api64.dll";
const STEAM_LIB = "./node_modules/steamworks.js/dist/win64/steam_api64.lib";
const VIDLIB_DIR = "./node_modules/simplevideo/dist/Release";
const SHARP_DIR = "./node_modules/@img/sharp-win32-x64/lib";

async function build() {
  try {
    rmSync(DIST_DIR, { recursive: true });
  } catch {}

  await Bun.build({
    entrypoints: [ENTRY],
    outdir: DIST_DIR,
    format: "cjs",
    target: "node",
    naming: "[dir]/[name].js",
    external: ["electron"],
  });
  cpSync(STEAM_DLL, `${DIST_DIR}/steam_api64.dll`);
  cpSync(STEAM_LIB, `${DIST_DIR}/steam_api64.lib`);

  cpSync(SHARP_DIR, `${DIST_DIR}/`, {
    recursive: true,
  });

  cpSync(VIDLIB_DIR, `${DIST_DIR}/`, {
    recursive: true,
  });
  
  writeFileSync(
    `${DIST_DIR}/index.js`,
    readFileSync(`${DIST_DIR}/index.js`, "utf-8").replace(
      "sharp = require(",
      'sharp = require("./sharp-win32-x64.node"); console.log('
    )
  );

  writeFileSync(
    `${DIST_DIR}/index.js`,
    `const { createRequire } = require('node:module');
require = createRequire(__filename); \n${readFileSync(
      `${DIST_DIR}/index.js`,
      "utf-8"
    )}`
  );

  rmSync(`${DIST_DIR}/lib`, { recursive: true, force: true });
  rmSync(`${DIST_DIR}/node-bindings.node`);
  cpSync("./public/", `${DIST_DIR}/public/`, { recursive: true });
}

build();

export {};
