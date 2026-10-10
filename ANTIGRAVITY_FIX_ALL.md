# FIX EVERYTHING: CivicTrack (Team 4 Eyes)

The app builds and runs at http://localhost:5000, but testing found real bugs. Fix ALL items below and check EVERY page in the app, not just the ones mentioned.

## Rules for this task
- Do NOT change the port (keep 5000) or server host/binding. Do NOT test with your shell tool opening a second terminal to connect to your own server (it fails and wastes time). Test by running `npm run build` then `npm start` and using a real browser to load http://localhost:5000, or only edit code and tell me what to test.
- No `any`/`@ts-ignore` shortcuts. `npm run build` must exit 0 and `npm test` must pass at the end.
- Fix the real cause. No fake data, no stubs, no removing features to hide errors.
- Do not stop at the first fix. Work through the whole list, then do the full-site audit (section 9).
- At the end, give me a table: Item | Fixed? | How you verified it. If you could not verify something in a real browser, say so honestly.

---

## 1. EXPLORE MAP NOT WORKING (highest priority)
The Explore map page does not show a working map. Find the cause and fix it. Check these likely causes in order:
a. `helmet` Content-Security-Policy in the server blocks map tiles and fonts. Allow `img-src` for `https://*.basemaps.cartocdn.com`, `https://*.tile.openstreetmap.org`, `data:` and `blob:` (and the uploads folder), and allow `style-src` / `font-src` for `fonts.googleapis.com` and `fonts.gstatic.com`. Do not disable helmet entirely.
b. The map container has no height. Give it an explicit height (e.g. `min-height: 60vh` or a defined flex height) and call `invalidateSize()` after layout or tab changes.
c. Leaflet CSS is not imported (`import 'leaflet/dist/leaflet.css'`), and the default marker icon images are broken by the bundler. Use custom SVG markers (severity/status coloured, pulsing ring for Major) so nothing depends on default icon images.
d. `/api/projects` fails or returns data the map can't render (lat/lng types, null coordinates, bbox filters). Handle loading, empty and error states visibly.

Confirm: tiles load, markers for all seeded projects appear, clicking a marker opens the project, filters update the markers, and the list stays in sync with the map. Also fix every other map in the app that uses the same setup: heatmap (department analytics), the "Report an issue" location picker with manual pin, the verification map, the "Avoid this road" planner map, subscription area drawing.

## 2. "REPORT ISSUE" AND OTHER NAV LINKS SHOW "PAGE NOT FOUND"
Clicking **Report Issue** (logged in as citizen) shows the app's Page Not Found screen. Compare every link in the navbar, footer and every `<Link>` / `navigate()` / `href` in the client with the routes defined in the router. Make them match.
- Click EVERY navbar item and every main call-to-action as a citizen, an officer and an admin (Home, Explore, Report Issue, My Reports, Verify Progress, Alerts, About, budget page "Where the money goes", Avoid this road, all department pages, analytics, admin settings). None may show Page Not Found.
- The 404 page should display the path that was not found.
- The report flow must work end to end: choose category, describe, add a JPEG (up to 3), confirm location (EXIF / device GPS / manual pin with source and trust shown), submit, then see it in My Reports and see the problem-group count increase.
- Photo rules must be enforced and show clear errors: wrong type (including a renamed .txt), over 5 MB, 4th photo, duplicate image.

## 3. CITIZEN CALLS AN OFFICER-ONLY API (403)
A logged-in citizen triggers `GET /api/groups?status=open&limit=1` which returns 403. Find the component that calls it and only call it for officers/admins. The console must show no 4xx errors for a logged-in citizen on any page.

## 4. CONSOLE NOISE WHEN LOGGED OUT
- Only fetch notifications (and start any polling) when a user is authenticated.
- `GET /api/auth/me` must return 200 with `{ user: null }` when there is no session, not 401. Update `authService.ts` to handle it.
- The console must be clean (apart from browser-extension errors) on `/`, `/login`, `/map` when logged out, and after login and logout, for every role.

## 5. FORM FIELD STYLING
The login email input has a black background with dark text, so typed text is unreadable.
- Light (citizen) theme: inputs, textareas and selects must have a white background, near-black text (#0B1512), a visible 1px border, a readable placeholder, and a clear focus ring. Set `color-scheme: light`.
- Dark (department) theme: dark panel background with light text (#E8EFEA) and visible borders.
- Check every form: login, register, report an issue, verify progress, reply to report, project create/edit, work-order delay reason, admin settings. Verify at least WCAG AA contrast.

## 6. FONTS NOT LOADING
Headings such as "Welcome to CivicTrack" render in default Times. Load **Fraunces** (headings), **Instrument Sans** (body) and **JetBrains Mono** (numbers, IDs, budgets) correctly (Google Fonts link in `index.html`, or `@fontsource` packages) and make sure headings actually use them. Make sure the CSP from item 1 allows them. Verify in the browser that the computed font-family is Fraunces on headings.

## 7. NAVBAR / HEADER LAYOUT
The header is cramped: the tagline "Transparency and Coordination in Public Works" wraps over four lines and "Citizen 1 / Logout" breaks onto a second row. Redesign the header:
- Logo and short wordmark on the left, nav links in a single row, user menu (name, role badge, notifications bell with unread count, logout) on the right.
- Hide the long tagline on small widths.
- At phone width, use a clean mobile menu (bottom navigation or hamburger).
- It must look intentional, not default, and match the "City Ledger" design brief (paper tones, deep moss, editorial typography).

## 8. KEEP THE BUILD HEALTHY
- `npm run build` from the repo root must exit 0 with no TypeScript errors.
- The build must copy any non-TS runtime assets (e.g. `schema.sql`) into `dist`.
- `npm test` must pass.
- Starting from a deleted `dist` and a deleted database file, `npm run build && npm start` must create, migrate and seed the database and serve the app.

## 9. FULL-SITE AUDIT (do this after items 1-8)
Open EVERY page and feature in a real browser as each role: public (logged out), `citizen@demo.com`, `sewage@demo.com`, `roads@demo.com`, `admin@demo.com` (password `demo1234`). For each page check: loads without Page Not Found, no console errors (apart from browser-extension noise), no failed network calls, no 4xx/5xx, real data (no empty or lorem ipsum), readable text and forms, and a sensible layout at 360 px, 768 px and 1440 px in light and dark mode.

Then verify these README features actually work end to end, and fix anything that does not:
1. Home stats, map, project page (purpose, department, contractor, dates, status, timeline, delay history with reasons, budget with sanctioned / spent / maintenance / variance).
2. "Where the money goes" budget page with charts by department, contractor, ward.
3. Filters and search on Explore.
4. Report an issue (see item 2), My Reports, replies, Confirm resolved and Reopen.
5. Problem grouping by location and type, severity Minor / Moderate / Major with a reason, officer queue sorted by severity.
6. Work order for a spot with 2+ departments: primary and secondary, tie-break reason (Electricity vs Telecom), primary completes then the secondary is scheduled 1 hour later and notified instantly.
7. Escalation: admin Time travel +1 hour / +1 day / +3 days triggers Overdue, then Level 1, then Level 2, each once.
8. Dig-once conflict warning appears before saving a conflicting project; deadline change without a reason is blocked.
9. Progress verification: one per user per project per status, within 200 m (demo location mode lets desktop users pick a location), accuracy check, photo required, 3-user quorum gives "Citizen-confirmed", citizen vs contractor disagreement gives "Disputed", own-department users blocked.
10. Alerts: subscribe by ward, area or road; notification bell and unread count; "Avoid this road" planner.
11. Department analytics: heatmap, hotspots, department and contractor scorecards, early-warning alerts.
12. Admin: settings page edits numbers, tie-break override (parallel), release or reassign stalled items, review disputed verifications, time travel, reset demo data.
13. Access control: a citizen cannot open officer pages; one department's officer cannot act on another's items; friendly messages instead of blank pages.

Add a top-level React error boundary so a crash shows a readable message instead of a blank screen.

## Final report
Give me:
1. The table from the rules section.
2. A list of every page you opened and whether it passed.
3. Anything you could NOT fix or verify, stated honestly.
4. The single command sequence I should run to see the final app.
