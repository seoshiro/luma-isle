# LUMA ISLE

A quiet interactive island with four connected puzzles, Russian and English UI,
local progress saving, and postcard exports. Built with React, TypeScript, Three.js
and Vite. No account, server, analytics or paid hosting is required to play.

## Local development

Requires Node.js 22 or newer compatible with Vite 7.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Progress stays in this browser's local storage. The settings menu can export and
import a save backup. Clearing browser storage removes local progress unless a
backup is kept. Localhost progress does not automatically transfer to GitHub Pages.

## Deployment

Repository: https://github.com/seoshiro/luma-isle

Live GitHub Pages site:
https://seoshiro.github.io/luma-isle/

In repository Settings > Pages, set Source to **GitHub Actions**. The workflow
tests and builds `main`, then uploads only `dist` to Pages. A public repository
and the standard GitHub-hosted workflow keep this deployment on GitHub's free
route. No custom domain or paid service is needed.

The release contains six optimized GLB models (about 10.3 MB total).
See [asset provenance](docs/ASSETS.md) for generation and terms information.

Only application code, release assets and documentation belong in the repository.
Reference archives, development captures, credentials, dependencies and player
save backups are deliberately excluded. Do not publish a staging build before
final artwork and release QA are complete.

See [QA status](docs/QA.md) for verified local/live flows and testing limitations.
