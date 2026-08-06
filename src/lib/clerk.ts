import type { Clerk as ClerkType } from "@clerk/clerk-js";
import { readReturnUrl } from "./return-url";

const PUBLISHABLE_KEY = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;

type MountKind = "sign-in" | "sign-up" | "user-button";

// oriz central-auth appearance — calm, branded, distinct from content sites.
const appearance = {
  variables: {
    colorPrimary: "#3d5a80",
    colorText: "#1b2733",
    colorBackground: "#ffffff",
    colorInputBackground: "#f5f7fa",
    borderRadius: "10px",
    fontFamily: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  elements: {
    rootBox: "oriz-clerk-root",
    card: "oriz-clerk-card",
    headerTitle: "oriz-clerk-title",
    footer: "oriz-clerk-footer",
  },
} as const;

// Frontend API host is base64-encoded in the publishable key (after pk_live_/pk_test_,
// trailing `$` stripped). Used to build the CDN URLs for the browser scripts.
function frontendApiFromKey(key: string): string {
  const encoded = key.replace(/^pk_(live|test)_/, "");
  return atob(encoded).replace(/\$$/, "");
}

function loadScript(src: string, attrs: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.async = true;
    el.crossOrigin = "anonymous";
    el.src = src;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(el);
  });
}

// In @clerk/clerk-js v6 the prebuilt UI lives in a SEPARATE bundle (@clerk/ui →
// ui.browser.js) that registers window.__internal_ClerkUICtor. The core
// clerk.browser.js only READS that ctor — loading core alone leaves Clerk
// effectively headless and mountSignIn throws "Clerk was not loaded with Ui
// components". So load BOTH the core SDK and the UI bundle before clerk.load().
let clerkReady: Promise<ClerkType> | null = null;

function ensureClerk(key: string): Promise<ClerkType> {
  const w = window as unknown as {
    Clerk?: ClerkType;
    __internal_ClerkUICtor?: unknown;
  };
  if (clerkReady) return clerkReady;

  const host = frontendApiFromKey(key);
  const attrs = { "data-clerk-publishable-key": key };

  clerkReady = (async () => {
    await Promise.all([
      w.Clerk
        ? Promise.resolve()
        : loadScript(`https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, attrs),
      w.__internal_ClerkUICtor
        ? Promise.resolve()
        : loadScript(`https://${host}/npm/@clerk/ui@1/dist/ui.browser.js`, {
            ...attrs,
            "data-clerk-ui-script": "true",
          }),
    ]);
    if (!w.Clerk) throw new Error("Clerk core loaded but window.Clerk missing");
    if (!w.__internal_ClerkUICtor) throw new Error("Clerk UI bundle loaded but ctor missing");
    return w.Clerk;
  })();

  return clerkReady;
}

export async function getClerk(): Promise<ClerkType> {
  if (!PUBLISHABLE_KEY) throw new Error("missing publishable key");
  return ensureClerk(PUBLISHABLE_KEY);
}

export async function bootstrapClerk(kind: MountKind): Promise<void> {
  const mount = document.getElementById("clerk-mount");
  const statusEl = document.getElementById("clerk-status");

  if (!PUBLISHABLE_KEY) {
    if (statusEl) statusEl.textContent = "Auth misconfigured: missing publishable key.";
    return;
  }
  if (!mount) return;

  const returnUrl = readReturnUrl();
  const clerk = await ensureClerk(PUBLISHABLE_KEY);

  await clerk.load({ appearance });

  // Already signed in? Send home immediately (SSO already established).
  if (clerk.user) {
    window.location.replace(returnUrl);
    return;
  }

  // Belt-and-suspenders: if a session appears while on this page, redirect.
  clerk.addListener(({ user }) => {
    if (user) window.location.replace(returnUrl);
  });

  const redirectProps = {
    forceRedirectUrl: returnUrl,
    signInForceRedirectUrl: returnUrl,
    signUpForceRedirectUrl: returnUrl,
  };

  if (statusEl) statusEl.remove();

  if (kind === "sign-in") {
    clerk.mountSignIn(mount, { ...redirectProps, signUpUrl: "/sign-up" });
  } else if (kind === "sign-up") {
    clerk.mountSignUp(mount, { ...redirectProps, signInUrl: "/sign-in" });
  } else {
    clerk.mountUserButton(mount, { afterSignOutUrl: "/sign-in" });
  }
}
