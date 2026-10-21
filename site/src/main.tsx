import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root")!;
if (root.hasChildNodes()) hydrateRoot(root, <App />);
else createRoot(root).render(<App />);
