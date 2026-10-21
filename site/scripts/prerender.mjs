// After the client and server builds: puts the rendered page into dist/index.html.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { render } = await import(resolve(root, "dist-ssr/entry-server.js"));
const file = resolve(root, "dist/index.html");
writeFileSync(file, readFileSync(file, "utf8").replace('<div id="root"></div>', `<div id="root">${render()}</div>`));
console.log("prerendered dist/index.html");
