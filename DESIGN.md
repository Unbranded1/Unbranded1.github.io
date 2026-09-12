# Score-first redesign

## Decisions

- Performers are the primary audience. Listeners use MuseScore Studio audio as a score preview.
- Friends has its own route, with passcode entry and an unlocked vault state.
- Admin has its own route and navigation visible only with existing admin access.
- Appearance follows the system by default, with light/dark overrides and the existing inversion preference preserved.
- Keep existing data, storage keys, Firebase, uploads, voting, media, games, text editing, and maintenance behavior.

## Direction

Score-library composition: left-aligned titles, a small publication-like score cover, readable instrumental metadata, and compact controls. Avoid a video-led hero, oversized marketing cards, decorative notes, repeated eyebrows, and dashboards on public pages.

Palette: paper #F7F8F5, surface #FFFFFF, ink #242D28, secondary #5C6860, accent #29654C, line #D9DFD8. Dark: charcoal #181E1B, raised #222A25, text #E8EEE9, accent #9FCDB4. Destructive actions use a separate semantic red.

Typography: retain Inter for controls and metadata; use Fraunces selectively for the page heading and score-cover titles. Most component titles use Inter. This keeps continuity without making every control look editorial.

Spacing uses a 4/8px scale, 44px touch targets, 1200px public content, a wider admin workspace, and responsive gutters. Use 6px controls, 12px dialogs, quiet borders, and contextual overlay shadows.

```
Public:  wordmark | destinations | help/settings
         identity + heading     | public score cover
         browse catalog / vote  | score details
         featured score / FAQ / contact

Catalog: heading + grid/list
         search | expandable filters
         sheet preview / title / composer / ensemble / preview / links

Admin:   workspace header
         sidebar | current editor and content list
```

The design-system search initially suggested an entertainment style, which conflicted with the score-first brief. A narrower editorial search returned Minimalism & Swiss Style. Apply its hierarchy and restrained interactions, with the existing musical display face and forest accent instead of a generic blue product palette.

## Audit map

Views: Home, published catalog, voting, Games, Friends access. Move the Home-embedded vault and admin into dedicated route containers. Update every shortcut, login/logout, help, score deep link, and maintenance path that depended on the old location.

Dynamic surfaces: score cards/list rows/details, featured arrangement, voting rows, instrument/difficulty/genre choices, admin lists, dashboard, FAQ, media controls, toast, quiz options, and leaderboards.

Dialogs: settings, help, score, confirmation, text edit, intro, disclaimer. Keep native dialog focus behavior. Preserve every existing static ID, editable key, and form/event hook unless explicitly updated and tested.

Two existing defects discovered during audit: local content saves recursively call afterContentChange; hidden mobile navigation remains keyboard-focusable. Repair these as part of the relevant workflows.

## Validation

Use isolated browser fixtures for admin/Friends and external integrations. Do not write test content to production Firebase or submit real contact messages. Check desktop and mobile views, system theme changes, stored settings, access boundaries, data editing, filter combinations, dialogs, voting, media, games, keyboard controls, and import/export. Compare old/new IDs, data defaults, and core game/integration functions.

## Implemented and verified

Home, Scores, Vote, Games, Friends, Admin, dialogs, dynamically rendered content, and the 404/Snake page now share the neutral paper/forest design. Friends and Admin use dedicated hash routes. Admin navigation follows existing access state. The public home uses only catalog content. Score covers lead cards and detail dialogs; MuseScore Studio audio is secondary, with video available in score details.

Shared appearance follows the system, supports light/dark overrides, and keeps the existing inversion setting. Shared styling is in `site.css`; the error page adds `not-found.css`. The service worker caches those files with the page shell and keeps navigations under their own URLs.

Validation scripts and screenshots are outside the served site in `../.redesign-checks`. `workflows.cjs` passed the route/access, theme/motion, search, dialog, local-save, voting, quiz, Snake, and dance-disable checks. All six views were checked for overflow at 320, 375, 430, 768, 1024, 1280, 1440, 1920, and 2560 pixels. All 12 admin sections were checked at 375 pixels. No horizontal overflow or browser JavaScript errors remained.

`audit.cjs` verified unchanged default data, retained original IDs and editable keys, no duplicate DOM IDs, labels on visible admin fields, combined filters, preview/link markup, modal-to-editor navigation, and keyboard admin tabs. Screenshots were reviewed in light/dark and mobile/desktop layouts.

External requests were blocked during tests. Actual Firebase sign-in and publishing, GitHub uploads, Formspree submissions, remote playback, live voting/leaderboard writes, and deployed offline behavior were not tested. The existing integration endpoints, storage keys, default data, and game scoring rules remain in place.
