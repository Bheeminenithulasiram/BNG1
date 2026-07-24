try {
  let origFetch = window.fetch;
  Object.defineProperty(window, 'fetch', {
    get() {
      return origFetch;
    },
    set(v) {
      origFetch = v;
    },
    configurable: true,
    enumerable: true
  });
} catch {}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
