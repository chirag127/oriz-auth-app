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
// trailing `$` stripped). Used to build the UI-inclusive clerk.browser.js CDN URL.
function frontendApiFromKey(key: string): string {
  const encoded = key.replace(/^pk_(live|test)_/, "");
  const host = atob(encoded).replace(/\$$/, "");
  return host;
}

// Load the UI-inclusive clerk.browser.js from the Frontend API CDN and return the
// global Clerk instance. The npm `@clerk/clerk-js` bundle is effectively headless
// (mountSignIn throws "Clerk was not loaded with Ui components"); the CDN browser
// bundle self-registers window.Clerk WITH its UI components.
function loadClerkScript(key: string): Promise<ClerkType> {
  const w = window as unknown as { Clerk?: ClerkType };
  if (w.Clerk) return Promise.resolve(w.Clerk);

  return new Promise((resolve, reject) => {
    const host = frontendApiFromKey(key);
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-clerk-publishable-key", key);
    script.src = `https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`;
    script.addEventListener("load", () => {
      if (w.Clerk) resolve(w.Clerk);
      else reject(new Error("Clerk script loaded but window.Clerk missing"));
    });
    script.addEventListener("error", () => reject(new Error("Failed to load Clerk script")));
    document.head.appendChild(script);
  });
}

export async function getClerk(): Promise<ClerkType> {
  if (!PUBLISHABLE_KEY) throw new Error("missing publishable key");
  const clerk = await loadClerkScript(PUBLISHABLE_KEY);
  return clerk;
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
  const clerk = await loadClerkScript(PUBLISHABLE_KEY);

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
