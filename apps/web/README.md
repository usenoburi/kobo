# Kōbō website

The public site at https://kobo.noburi.space: `index.html` (landing) and `download.html`, two
static pages built with Vite+. Pixel art comes from the repository's `assets/`.

```bash
pnpm --filter @kobo/web dev
pnpm --filter @kobo/web build
```

Deploys run on Vercel (project `noburi`, team `useburoo`) from GitHub: every push to `main`
goes to production and every pull request gets a preview. A build is skipped when nothing under
`apps/web`, `assets/` or `pnpm-lock.yaml` changed.
