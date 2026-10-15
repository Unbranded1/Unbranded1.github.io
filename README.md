# Sheet music website

Static GitHub Pages site for `Unbranded1/Unbranded1.github.io`. Public content is loaded from the existing Firebase `site/content` document, with optional `data.json` and built-in fallbacks. Firebase email/password authentication controls admin publishing. Maintenance mode stays available during updates.

## Import arrangements

1. Sign in to Admin and open **Import arrangements**.
2. Choose a ZIP or normal folder. A ZIP can contain several songs and nested instrument folders. Put a `.txt` file containing only its Google Drive **folder URL** at each arrangement root.
3. Review the proposed conductor PDF, generated first-page JPG, titles, instruments, ensemble, and song grouping. Select another PDF if necessary. English titles are preferred, with supplied romaji as the fallback. Missing names stay blank; fields are editable. Melody folders, filenames, and PDF labels such as “melody parts” are recognized before ensemble instrumentation. Parts-only folders without Melody evidence use Other and the N/A arrangement label. Scanned image-only PDFs require manual text entry.
4. Choose **Friends Vault** or **Published scores**, select arrangements, and mark the default arrangement for each song. Existing-song matches can be changed.
5. Publish selected arrangements. Only generated cover JPGs are committed to `previews/imported/`; metadata is saved through the existing Firebase publisher. The original ZIP, PDFs, audio, and videos are never uploaded by the importer.

The review queue stays in the current browser tab. A failed publication keeps the queue available for retry. Reloading or clearing the queue discards unsubmitted recommendations. Pause/resume operates within the open tab.

Cover publishing uses the existing **Backup & Data** token setting. A fine-grained GitHub token should select only this repository and grant **Contents: Read and write**. The token is stored on the current device. A CLI or Codex GitHub login is separate from the browser's saved token. GitHub cover commits update `main` without forcing the branch; if another commit wins the race, retry. Cover URLs become available when GitHub Pages finishes deploying.

MP4 previews are deferred. MP4 entries are skipped, including in large archives. Existing supported media references remain available. PDFs are limited to 50 MB each and 512 MB in aggregate; archives are limited to 20,000 entries. These limits exclude skipped videos.

## Score data

`score-model.js` normalizes old flat score records into songs with `variants` and `defaultVariantId`. Each variant owns its ensemble, instruments, cover, and links. Category buttons above each library include Melody; selecting a category displays the matching arrangement and its own download link. Melody is also available in the admin tag picker and import review dropdown. Legacy arrangement IDs remain usable in deep links.

`initial-arrangements.js` contains the reviewed 35-arrangement collection and matched Drive links from the supplied archive. For content older than version 4, the migration fills in that collection and preserves existing media and maintenance settings. The next successful admin save publishes the migrated schema. Version 4 content and drafts remain authoritative, so later intentional deletions are not re-added. Public score descriptions and the specified old instructional subtitles are cleared in the same migration.

The browser implementation is split between `app.js` (site and existing admin), `score-model.js` (shared data model), and `score-sorter.js` (local analysis and reviewed publishing). No build step is required. Dependencies are pinned and vendored; see `vendor/README.md`.

## Local verification

Run the pure model checks with Node.js:

```sh
node --test tests/score-model.test.cjs
```

Run the isolated browser checks with Python and Playwright:

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/browser_regression.py
```

Optional arguments: `--browser-executable PATH`, `--published-fixture FILE.json`, and `--screenshots DIRECTORY`. The test starts its own temporary local server and generates synthetic PDF/ZIP fixtures outside the served site. All external requests are blocked or mocked, including Firebase and GitHub writes.
