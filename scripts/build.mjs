#!/usr/bin/env node
/**
 * Builds nearpay-js:
 *   dist/v1/nearpay.js          loader (IIFE, global NearPay) served by nearpay-deploy's `js` site
 *   dist/v1/integrity.json      SRI hashes of the loader (publish with every release)
 *   packages/js/dist            @nearpay-money/js (ESM + .d.ts)
 *   packages/react/dist         @nearpay-money/react (ESM + .d.ts; react and @nearpay-money/js external)
 * NP_PAY_ORIGIN sets the loader's fallback checkout origin (default https://pay.nearpay.money);
 * normally the loader derives it from its own js.<domain> URL.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const payOrigin = process.env.NP_PAY_ORIGIN ?? "https://pay.nearpay.money";
if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(payOrigin)) {
  throw new Error(`NP_PAY_ORIGIN must be an https origin, got ${payOrigin}`);
}
const alias = { "@nearpay-money/js": join(root, "packages/js/src/index.ts") };

rmSync(join(root, "dist"), { recursive: true, force: true });
for (const p of ["js", "react"]) rmSync(join(root, "packages", p, "dist"), { recursive: true, force: true });

await build({
  entryPoints: [join(root, "packages/loader/src/entry.ts")],
  outfile: join(root, "dist/v1/nearpay.js"),
  bundle: true,
  format: "iife",
  target: ["es2019", "chrome80", "firefox78", "safari13"],
  minify: true,
  legalComments: "none",
  alias,
  define: { __NP_DEFAULT_PAY_ORIGIN__: JSON.stringify(payOrigin) },
  banner: { js: "/*! NearPay loader v1 | Apache-2.0 */" },
});
const loader = readFileSync(join(root, "dist/v1/nearpay.js"));
const sri = (alg) => `${alg}-${createHash(alg).update(loader).digest("base64")}`;
const version = JSON.parse(readFileSync(join(root, "packages/js/package.json"), "utf8")).version;
writeFileSync(
  join(root, "dist/v1/integrity.json"),
  `${JSON.stringify({ file: "nearpay.js", version, protocol: 1, bytes: loader.length, sha384: sri("sha384"), sha512: sri("sha512") }, null, 2)}\n`,
);

await build({
  entryPoints: [join(root, "packages/js/src/index.ts")],
  outfile: join(root, "packages/js/dist/index.js"),
  bundle: true,
  format: "esm",
  target: "es2020",
  legalComments: "none",
});
await build({
  entryPoints: [join(root, "packages/react/src/index.tsx")],
  outfile: join(root, "packages/react/dist/index.js"),
  bundle: true,
  format: "esm",
  target: "es2020",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime", "@nearpay-money/js"],
  legalComments: "none",
});

// Type declarations (react resolves @nearpay-money/js to the declarations emitted just before).
const tsc = join(root, "node_modules/.bin/tsc");
for (const p of ["js", "react"])
  execFileSync(tsc, ["-p", join(root, "packages", p, "tsconfig.build.json")], { stdio: "inherit" });
for (const p of ["js", "react"]) cpSync(join(root, "LICENSE"), join(root, "packages", p, "LICENSE"));
console.log(
  `built dist/v1/nearpay.js (${loader.length} bytes, ${sri("sha384")}), @nearpay-money/js, @nearpay-money/react`,
);
