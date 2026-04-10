# StarCraft TMG Mobile Rules App (Modular)

This package is split so content updates do not require editing one giant `index.html`.

## Structure

- `index.html` — mobile app shell
- `print.html` — printable rules view
- `assets/app.css` — mobile app styles
- `assets/app.js` — mobile app behavior
- `assets/print.css` — print styles
- `assets/print.js` — printable view renderer
- `data/manifest.json` — ordered list of Parts to load
- `data/parts/part-*.json` — one JSON file per Part

## Updating content

Edit the relevant file in `data/parts/`.

Example:
- Core Concepts → `data/parts/part-2.json`
- Measuring and Movement → `data/parts/part-4.json`
- Quick Reference → `data/parts/part-12.json`

## GitHub Pages

Upload the **contents** of this folder to the repo root (not the zip file itself).

Because the app uses relative `fetch()` calls to load local JSON files, it should be served from GitHub Pages or another web server. Opening `index.html` directly from the filesystem may block JSON loading in some browsers.
