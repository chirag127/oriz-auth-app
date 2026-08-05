import { Clerk } from "@clerk/clerk-js";
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

export async function bootstrapClerk(kind: MountKind): Promise<void> {
  const mount = document.getElementById("clerk-mount");
  const statusEl = document.getElementById("clerk-status");

  if (!PUBLISHABLE_KEY) {
    if (statusEl) statusEl.textContent = "Auth misconfigured: missing publishable key.";
    return;
  }
  if (!mount) return;

  const returnUrl = readReturnUrl();
  const clerk = new Clerk(PUBLISHABLE_KEY);
  // Expose for verification / debugging.
  (window as unknown as { Clerk: Clerk }).Clerk = clerk;

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

  if (kind === "sign-in") {
    clerk.mountSignIn(mount, { ...redirectProps, signUpUrl: "/sign-up" });
  } else if (kind === "sign-up") {
    clerk.mountSignUp(mount, { ...redirectProps, signInUrl: "/sign-in" });
  } else {
    clerk.mountUserButton(mount, { afterSignOutUrl: "/sign-in" });
  }
}
