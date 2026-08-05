// Open-redirect guard for the `return` query param.
// Allowlist: https on oriz.in + any *.oriz.in subdomain, and http localhost / 127.0.0.1 (dev).
// Anything else -> fall back to https://oriz.in.

const FALLBACK = "https://oriz.in";

export function safeReturnUrl(raw: string | null | undefined): string {
  if (!raw) return FALLBACK;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return FALLBACK;
  }

  const host = u.hostname.toLowerCase();

  // (a) https on oriz.in or any *.oriz.in subdomain
  if (u.protocol === "https:" && (host === "oriz.in" || host.endsWith(".oriz.in"))) {
    return u.toString();
  }

  // (b) http localhost / 127.0.0.1 (any port) for dev
  if (u.protocol === "http:" && (host === "localhost" || host === "127.0.0.1")) {
    return u.toString();
  }

  return FALLBACK;
}

/** Read `return` from the current browser location and validate it. */
export function readReturnUrl(): string {
  if (typeof window === "undefined") return FALLBACK;
  const raw = new URLSearchParams(window.location.search).get("return");
  return safeReturnUrl(raw);
}
