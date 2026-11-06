import { createRoot } from "react-dom/client";
import { NearPayCheckout, NearPayProvider } from "../../../packages/react/src/index";

declare global {
  interface Window {
    __cfg: { pk: string; sessionId: string; clientSecret: string; payOrigin: string };
    __events: unknown[];
  }
}

const cfg = window.__cfg;
window.__events = [];
function App() {
  return (
    <NearPayProvider publishableKey={cfg.pk} payOrigin={cfg.payOrigin}>
      <h1>React shop</h1>
      <NearPayCheckout
        sessionId={cfg.sessionId}
        clientSecret={cfg.clientSecret}
        appearance={{ theme: "light", radius: 6 }}
        onReady={() => window.__events.push(["ready"])}
        onComplete={(r) => window.__events.push(["complete", r])}
      />
    </NearPayProvider>
  );
}
const el = document.getElementById("root");
if (el) createRoot(el).render(<App />);
