# Score library and arrangement importer

The public home leads with the featured score. Navigation contains Home, Scores, and Friends, with Admin shown after sign-in. The neutral light/dark palette, Inter controls, Fraunces display headings, existing settings, Firebase authentication, and maintenance controls remain in use.

Score covers display the complete first PDF page with `object-fit: contain`. Grid, list, featured, and detail views share the same arrangement selection. A song can contain several arrangements, and the admin chooses which appears first. Changing arrangements changes the cover, instruments, media, and download links together. Old arrangement IDs still open the appropriate variant.

The admin importer is a review workspace: ZIP/folder selection, scan progress and pause/resume, destination and bulk selection, then one review row per arrangement. Each row exposes its source folder, selected conductor PDF, cover, Japanese/English titles, ensemble, instruments, Drive folder, existing-song match, and default choice. An uncertain English title stays blank. Empty content fields are supported throughout the admin editors.

The ZIP reader uses selective entry reads. It recursively includes instrument folders and skips MP4 entries. PDF analysis and JPG rendering run locally, one arrangement at a time, using lazy-loaded local PDF.js and zip.js workers. Publishing saves only the generated covers to GitHub and reviewed metadata to the existing Firebase content document. The archive and original PDFs, audio, and videos stay on the device.

The initial migration matches the supplied archive to the existing vault, repairs Drive folder links, adds the missing melody arrangement, and presents 35 arrangements in 28 songs. Existing public scores, unknown custom scores, media references, legacy links, and maintenance state are preserved. Once schema version 4 is published, later removals and edits remain authoritative.

Voting, games, Help, version reminders, the custom 404 page, the music-note logo, and the requested marketing/instructional text have been removed. The two published score descriptions are cleared during the schema migration. Third-party code remains verbatim under `vendor/` with its licenses.

Validation covers model/grouping/migration regressions, maintenance and sign-in routes, blank fields, defaults and backups, recursive ZIP/folder import, a 20-arrangement pause/resume queue, malformed inputs and conductor replacement, permission and publishing failures, and responsive views at 320, 375, 768, and 1440 pixels. External writes are mocked in browser tests. The full supplied archive was also scanned locally: all 35 arrangements and cover JPGs succeeded, with 31 videos skipped. Repeated imports retain 28 songs and 35 arrangements.
