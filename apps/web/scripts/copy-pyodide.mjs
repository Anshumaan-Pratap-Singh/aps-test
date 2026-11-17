// Self-host the Pyodide runtime under /public/pyodide so the coding lab works offline
// and without third-party CDNs. Runs on postinstall/prebuild.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pyodide");
const dst = join(root, "public", "pyodide");
if (!existsSync(src)) { console.warn("pyodide not installed; coding lab execution disabled"); process.exit(0); }
mkdirSync(dst, { recursive: true });
for (const f of ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) cpSync(join(src, f), join(dst, f));
console.log("copied pyodide runtime to public/pyodide");
