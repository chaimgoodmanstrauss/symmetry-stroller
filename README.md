# Symmetry Stroll

A single-page static app (`symmetrystroller/index.html`, self-contained folder) for building and taking self-guided "symmetry walk" photo tours — geotagged photos of architectural symmetry patterns, plotted on a map.

## Two modes, driven by URL

- **Viewer** (default, `?walk=<slug>`) — the public-facing experience. Photos appear as small circular markers on a Leaflet/CartoDB map; click one to see it large (a centered floating overlay, sized to fill most of the screen); click away or move the mouse off to dismiss. Overlapping markers can be clicked through one at a time (each collapses to the back of its stack after viewing). The gallery's title floats over the map in a self-hosted EB Garamond font with a white halo for legibility.
- **Writer** (`?mode=writer`, or the secret shortcut Cmd+Shift+Option+8 — not linked anywhere public) — the authoring tool. Drop in a folder of photos (GPS pulled from EXIF), drag to reposition, Option-drag to resize, rename/reorder in the sidebar, set a gallery name and slug, and manage the whole tour list (delete entries from `walks.json` right from the UI). "Export" bundles everything — photos, `walk.json`, and an updated `walks.json` manifest — into a zip download, since there's no backend; publishing is a manual drop-in of the exported files.

## Data layout

One shared `index.html` reads `walks.json` (a manifest of `{slug, title, dataFile}`) to find which walk to load, then fetches that walk's own JSON (photo positions, filenames, saved map view) plus its `photos/` folder — this replaced an earlier version that was four separate copy-pasted HTML files, one per walk.

Currently has three tours built in: Fifth Avenue, Bed-Stuy, and Galway.

## Deploying

Upload the `symmetrystroller/` folder as-is. `myurl.com/symmetrystroller?walk=...` works via the standard directory-redirect-to-index behavior every static server already provides (confirmed on Apache, nginx, and Python's dev server) — no server config needed. `original_symmetry_stroller/` is local reference material only and shouldn't be deployed.
