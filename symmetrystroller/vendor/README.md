Vendored third-party libraries, previously loaded from cdnjs.cloudflare.com.
Field mode runs on-site, sometimes on unreliable cell connections, where a
blocked or slow CDN request could take the whole app down before it starts —
these are small enough (~270KB total) to just ship alongside the app instead.

- `leaflet.js` / `leaflet.css` — Leaflet 1.9.4 (map). Default marker/layer
  icon images aren't included: this app only uses its own custom photo
  markers, not Leaflet's built-in ones or its layers control.
- `exif.min.js` — exif-js 2.3.0 (reads GPS from photo EXIF on import).
- `jszip.min.js` — JSZip 3.10.1 (writer mode's zip export).

To update a version: re-download from the same cdnjs paths and replace the
file in place; nothing else needs to change.
