# Symmetry Stroll

A single-page static app (`symmetrystroller/index.html`, self-contained folder) for building and taking self-guided "symmetry walk" photo tours — geotagged photos of architectural symmetry patterns, plotted on a map.

## Three modes, driven by URL

- **Viewer** (default, `?walk=<slug>`, or no `walk` at all for the built-in default tour) — the public-facing experience. Photos appear as small circular markers on a Leaflet map (CARTO tiles with a key, otherwise Esri's keyless Light Gray tiles); click one to see it large (a centered floating overlay, sized to fill most of the screen); click away or move the mouse off to dismiss. Overlapping markers can be clicked through one at a time (each collapses to the back of its stack after viewing). The gallery's title floats over the map in a self-hosted EB Garamond font with a white halo for legibility. A walk switcher lets visitors move between tours without leaving the viewer.
- **Writer** (`?mode=writer`, or the secret shortcut Cmd+Shift+Option+8 — not linked anywhere public) — the full authoring tool, for use at a desk. Drop in a folder of photos (GPS pulled from EXIF), drag to reposition, Option-drag to resize, rename/reorder in the sidebar, set a gallery name and slug, and manage the whole tour list (delete entries from `walks.json` right from the UI). Saves either straight to a connected local folder (File System Access API) or as a downloaded zip (photos + `walk.json` + updated `walks.json`) for manual drop-in; a local helper server (`local_server.js`) also adds a one-click "Deploy" button that shells out to `deploy.sh` over SFTP.
- **Field mode** — a stripped-down, map-only editor meant for a single dedicated phone/tablet used on-site during a walk. Writes straight to the live server through `symmetrystroller/api/save.php`, gated by an ECDSA P-256 keypair (see `~/.claude/CLAUDE.md`'s "Symmetry Stroller field-mode private key" section for the key/rotation details) rather than a login.

## Data layout

One shared `index.html` reads `walks.json` (a manifest of `{slug, title, dataFile}`) to find which walk to load, then fetches that walk's own JSON (photo positions, filenames, saved map view) plus its `photos/` folder — this replaced an earlier version that was four separate copy-pasted HTML files, one per walk.

See `walks.json` for the current list of built-in tours.

## Deploying

Upload the `symmetrystroller/` folder as-is (or use `symmetrystroller/deploy.sh`, which does this over SFTP and skips unchanged photos — see that file's own comments). `myurl.com/symmetrystroller?walk=...` works via the standard directory-redirect-to-index behavior every static server already provides (confirmed on Apache, nginx, and Python's dev server) — no server config needed. `symmetrystroller/vendor/` (Leaflet, exif-js, JSZip) must deploy alongside `index.html`, since those used to be CDN-loaded and now aren't.

## Map tiles / your own API key

The map uses CARTO's "light_all" basemap, which needs a (free, fair-use) API key from [carto.com](https://carto.com). No key is included in this repo. Without one the app still works: it falls back to Esri's keyless Light Gray Canvas tiles.

To use your own CARTO key, either:

- **Config file** (for your own deploy): copy `symmetrystroller/config.example.js` to `symmetrystroller/config.local.js` and put your key in `cartoApiKey`. `config.local.js` is gitignored; upload it next to `index.html` (`deploy.sh` does this automatically).
- **URL parameter** (no file needed): open the app once with `?cartoKey=YOUR_KEY`. It's saved in that browser's localStorage; `?cartoKey=` with an empty value clears it.

Precedence: URL/saved key, then `config.local.js`, then the Esri fallback.
