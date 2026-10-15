# Local import dependencies

- **PDF.js / pdfjs-dist 5.6.205**: `pdfjs/`, Apache License 2.0. Includes the browser module, worker, font/CMap resources, and upstream support assets. See `pdfjs/LICENSE`.
- **zip.js / @zip.js/zip.js 2.23.0**: `zipjs/`, BSD 3-Clause License. Includes the native browser bundle and worker. See `zipjs/LICENSE`.

Upstream distributions are kept verbatim. They are loaded only when an admin selects import files. ZIP entry enumeration and selective PDF/TXT reads avoid loading skipped MP4 data into memory. PDF.js evaluation and WebAssembly execution are disabled for this importer.

When upgrading, replace the matching module/worker/resource distribution together, retain licenses, and repeat the model, browser, and large-archive checks.
