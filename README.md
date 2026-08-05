# oriz-auth-app

Central Clerk-powered auth hub for the **oriz.in** family — one identity, cross-subdomain SSO for every `*.oriz.in` site.

**Live:** https://account.oriz.in · https://auth.oriz.in

## What it does

- Real Clerk UI (`@clerk/clerk-js`): `<SignIn/>`, `<SignUp/>`, `<UserButton/>` — Google, GitHub, email, passkeys, MFA.
- Cross-subdomain SSO across `*.oriz.in` (Clerk default with a `pk_live_` production key on the `clerk.oriz.in` FAPI).
- **Return-URL flow:** sites send users to `https://account.oriz.in/sign-in?return=<url>`; after auth the browser is sent back to `<url>`.
- **Open-redirect guard:** the `return` param is validated against an allowlist before use — see `src/lib/return-url.ts`.

### Return-URL allowlist

| Allowed | Example |
| --- | --- |
| `https://oriz.in` | `https://oriz.in/dashboard` |
| `https://*.oriz.in` | `https://finance.oriz.in/app` |
| `http://localhost:*` (dev) | `http://localhost:4321/` |
| `http://127.0.0.1:*` (dev) | `http://127.0.0.1:3000/` |

Anything else → falls back to `https://oriz.in`.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Client-side redirect → `/account` (signed in) or `/sign-in` |
| `/sign-in` | Clerk `<SignIn/>` |
| `/sign-up` | Clerk `<SignUp/>` |
| `/account` | Clerk `<UserButton/>`; bounces to `/sign-in` if signed out |

## Stack

Astro (static) + `@clerk/clerk-js`. Hosted on Cloudflare Pages (project `oriz-auth-app`).

## Develop

```sh
cp .env.example .env   # set PUBLIC_CLERK_PUBLISHABLE_KEY (pk_live_… — browser-safe)
npm install --legacy-peer-deps
npm run dev
```

## Build + deploy

```sh
npm run build
npm run deploy:pages   # wrangler pages deploy dist --project-name=oriz-auth-app
```

`PUBLIC_CLERK_PUBLISHABLE_KEY` is a publishable key — safe to ship in the browser bundle. The **secret key is never used here** and must never be committed.

## License

MIT
