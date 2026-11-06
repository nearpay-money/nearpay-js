/**
 * Two origins for the loader tests:
 * - merchant: http://127.0.0.1:<m>/page/* (test pages) — the integrating site;
 * - nearpay:  http://{js,pay}.nearpay.localhost:<p> — js.* serves dist/ (the loader, with CORS for SRI),
 *   pay.* serves a fake /embed/:id checkout that implements the iframe side of protocol v1.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { build } from "esbuild";

export const PK = `pk_test_${"a".repeat(48)}`;
export const SID = "cs_01jbz9k3m4n5p6q7r8s9t0v1w2";
export const SECRET = `${SID}_secret_${"B".repeat(32)}`;
export const PI = "pi_01jbz9k3m4n5p6q7r8s9t0v1w2";

const root = join(import.meta.dirname, "../../..");

function listen(s: Server): Promise<number> {
  return new Promise((r) => s.listen(0, "127.0.0.1", () => r((s.address() as { port: number }).port)));
}

const FAKE_CHECKOUT = (sid: string) => `<!doctype html><html><body><p id="state">waiting</p>
<button id="complete">complete</button><button id="error">error</button><button id="close">close</button>
<script>
  let parentOrigin = null;
  window.__inits = [];
  addEventListener("message", (e) => {
    if (e.source !== parent || !e.data || e.data.type !== "np:init") return;
    window.__inits.push({ data: e.data, origin: e.origin, hash: location.hash });
    if (parentOrigin) return;
    parentOrigin = e.origin;
    document.getElementById("state").textContent = "ready";
    parent.postMessage({ type: "np:ready", v: 1 }, parentOrigin);
    parent.postMessage({ type: "np:resize", v: 1, height: 640 }, parentOrigin);
  });
  const send = (m) => parent.postMessage({ ...m, v: 1 }, parentOrigin);
  document.getElementById("complete").onclick = () => { send({ type: "np:complete", session_id: ${JSON.stringify(sid)}, payment_intent_id: ${JSON.stringify(PI)} }); send({ type: "np:complete", session_id: ${JSON.stringify(sid)}, payment_intent_id: ${JSON.stringify(PI)} }); };
  document.getElementById("error").onclick = () => send({ type: "np:error", code: "session_expired", message: "expired" });
  document.getElementById("close").onclick = () => send({ type: "np:close" });
</script></body></html>`;

// A frame on the pay origin that is NOT the checkout iframe: its messages must be ignored.
const ROGUE = `<!doctype html><script>
  parent.postMessage({ type: "np:complete", v: 1, session_id: ${JSON.stringify(SID)}, payment_intent_id: "pi_rogue" }, "*");
  parent.postMessage({ type: "np:ready", v: 1 }, "*");
</script>`;

export class Servers {
  private merchant: Server | null = null;
  private nearpay: Server | null = null;
  merchantPort = 0;
  nearpayPort = 0;

  get merchantOrigin() {
    return `http://127.0.0.1:${this.merchantPort}`;
  }
  get jsOrigin() {
    return `http://js.nearpay.localhost:${this.nearpayPort}`;
  }
  get payOrigin() {
    return `http://pay.nearpay.localhost:${this.nearpayPort}`;
  }

  async start(): Promise<void> {
    await build({
      entryPoints: [join(root, "test/e2e/harness/react-app.tsx")],
      outfile: join(root, "test/e2e/.build/react.js"),
      bundle: true,
      format: "iife",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      alias: { "@nearpay/js": join(root, "packages/js/src/index.ts") },
      logLevel: "silent",
    });
    this.nearpay = createServer((req, res) => {
      const host = (req.headers.host ?? "").split(":")[0];
      const url = new URL(req.url ?? "/", "http://x");
      if (host === "js.nearpay.localhost" && url.pathname.startsWith("/v1/")) {
        try {
          const body = readFileSync(join(root, "dist", url.pathname));
          res.writeHead(200, {
            "content-type": "text/javascript",
            "access-control-allow-origin": "*",
            "cross-origin-resource-policy": "cross-origin",
          });
          res.end(body);
        } catch {
          res.writeHead(404).end();
        }
        return;
      }
      if (host === "pay.nearpay.localhost") {
        const m = /^\/embed\/([^/]+)$/.exec(url.pathname);
        res.writeHead(200, { "content-type": "text/html" });
        res.end(m ? FAKE_CHECKOUT(m[1] as string) : url.pathname === "/rogue" ? ROGUE : "");
        return;
      }
      res.writeHead(404).end();
    });
    this.nearpayPort = await listen(this.nearpay);

    this.merchant = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname === "/harness/react.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        res.end(readFileSync(join(root, "test/e2e/.build/react.js")));
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(url.pathname === "/page/react" ? this.reactPage() : this.loaderPage(url.searchParams));
    });
    this.merchantPort = await listen(this.merchant);
  }

  private loaderPage(q: URLSearchParams): string {
    const integrity = JSON.parse(readFileSync(join(root, "dist/v1/integrity.json"), "utf8")) as { sha384: string };
    const sri =
      q.get("sri") === "bad"
        ? "sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        : integrity.sha384;
    return `<!doctype html><html><body><h1>Shop</h1><div id="pay"></div>
<script src="${this.jsOrigin}/v1/nearpay.js" integrity="${sri}" crossorigin="anonymous"></script>
<script>
  window.__events = [];
  window.__mount = (extra) => window.NearPay(${JSON.stringify(PK)}, extra || {}).mountCheckout({
    sessionId: ${JSON.stringify(SID)}, clientSecret: ${JSON.stringify(SECRET)}, element: "#pay",
    appearance: { theme: "dark", accent: "#ff5500", radius: 4 }, locale: "en",
    onReady: () => __events.push(["ready"]), onComplete: (r) => __events.push(["complete", r]),
    onError: (e) => __events.push(["error", e]), onClose: () => __events.push(["close"]),
  });
  window.__rogue = () => { const f = document.createElement("iframe"); f.src = ${JSON.stringify(`${this.payOrigin}/rogue`)}; document.body.append(f); };
</script></body></html>`;
  }

  private reactPage(): string {
    return `<!doctype html><html><body><div id="root"></div>
<script>window.__cfg = ${JSON.stringify({ pk: PK, sessionId: SID, clientSecret: SECRET, payOrigin: this.payOrigin })};</script>
<script src="/harness/react.js"></script></body></html>`;
  }

  async stop(): Promise<void> {
    await Promise.all(
      [this.merchant, this.nearpay].map((s) => new Promise<void>((r) => (s ? s.close(() => r()) : r()))),
    );
  }
}
