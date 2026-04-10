# StarCraft TMG — Mobile Rules Compendium

This package is organized for GitHub Pages and easy editing.

## Structure
- `index.html` — mobile app shell
- `print.html` — printable rules compendium
- `assets/app.css` — mobile styling
- `assets/app.js` — mobile behavior
- `assets/print.css` — print styling
- `assets/print.js` — print rendering
- `data/manifest.json` — ordered part list and metadata
- `data/parts/*.json` — one JSON file per rules Part

## Editing content
Edit the JSON file for the Part you want to change.
Examples:
- `data/parts/part-8.json` for The Game Sequence
- `data/parts/part-11.json` for the Keyword Glossary

## Publishing on GitHub Pages
Upload the contents of this folder to the root of a GitHub Pages repo.
Do **not** upload the zip itself.

## Local testing
Because the app loads JSON with `fetch()`, test it through GitHub Pages or a local web server.
Opening `index.html` directly with `file://` may not work in some browsers.


Additional modular guide layers:
- `data/play-guide.json` — Part VIII field manual
- `data/battlefield-guide.json` — Part VII rulings layer
- `data/movement-guide.json` — Part IV movement/coherency layer
- `data/keyword-guide.json` — Part XI grouped glossary
