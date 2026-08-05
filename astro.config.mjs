import { defineConfig } from "astro/config";

// Static site — served on account.oriz.in + auth.oriz.in via CF Pages.
export default defineConfig({
  site: "https://account.oriz.in",
  output: "static",
  trailingSlash: "ignore",
});
