import { renderToString } from "react-dom/server";
import { App } from "./App";

/** The page as HTML at build time, for search engines and AI crawlers that don't run JavaScript. */
export function render() {
  return renderToString(<App />);
}
