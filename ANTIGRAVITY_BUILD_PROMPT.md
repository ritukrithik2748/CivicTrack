# BUILD INSTRUCTIONS: "CivicTrack" by Team 4 Eyes

You are building a complete, working, publicly deployed web application for a 24-hour hackathon (IIITDM Kancheepuram, CivicTech track: *Improving Transparency and Coordination in Public Works Projects*).

**Read `README.md` in this repository first. It is the product specification.** This file is the engineering brief that turns it into a working system. If the two ever disagree, the README's *behaviour* wins, but this file's *stack and structure* win (then update README section 5 "Tech Stack", section 7 "Setup" and section 9 "Repository Structure" so they match what you actually built).

## 0. Non-negotiable rules

1. **It must actually work. No bugs, no mocks, no placeholders.** Every feature in the README must be real, wired to the database, and demonstrable. No `TODO`, no lorem ipsum, no buttons that do nothing, no hard-coded fake responses. (The hackathon rules say fake or non-working demos are disqualified and incomplete projects are penalised.)
2. **Verify everything yourself.** After each phase, run the app, run the tests, and exercise the feature in a real browser. Fix every console error, failed request and layout glitch before moving on. Do not report "done" until section 14 (Definition of Done) is fully ticked.
3. **No setup for judges.** The deployed site opens with seeded demo data and working demo logins. No API keys required to run it.
4. **The UI must be distinctive and beautiful** (section 11). It must **not** look like a default Bootstrap, Material, shadcn-default or generic Tailwind template.
5. **Everything must be disclosed.** Keep the README's open-source library table in sync with `package.json`.
6. **Data is simulated.** Say so in the README and on an "About this demo" page. Use invented names for contractors and invented projects. Do not use real people, real companies or real phone numbers.
7. Build in phases (section 13). Keep the app runnable at the end of every phase. Commit after each phase.

---

## 1. Tech stack (use exactly this)

Chosen for zero external accounts, easy single-service deployment and few moving parts.

**Frontend:** React 18 + TypeScript + Vite, React Router, TanStack Query, react-hook-form + zod, Tailwind CSS **with a fully custom theme** (section 11, do not use the default palette), framer-motion, Recharts, react-leaflet + leaflet.heat, lucide-react icons, date-fns, heic2any (lazy loaded, for HEIC to JPEG conversion).

**Backend:** Node.js 20 + Express + TypeScript, **SQLite via better-sqlite3** (WAL mode, foreign keys ON), zod validation, bcryptjs, jsonwebtoken, helmet, cors, express-rate-limit, multer (memory storage), sharp, exifr, file-type, pino logger.

**Tests:** Vitest (unit and integration with supertest) and a Playwright smoke test for the main journeys.

**Maps:** OpenStreetMap-based tiles that need no API key (CARTO Voyager or Positron raster tiles, with correct attribution).

**Deployment:** One service. The Express server serves the built React app and the API from the same origin. Provide a `Dockerfile` and `render.yaml` (Render free tier) so it deploys as a single web service. The SQLite database is created and **seeded automatically on first boot** if empty (the free tier disk can be ephemeral, so seeding on boot is required). Provide a `/api/health` endpoint.

**Repository layout:**

```
├── client/                 # React app
├── server/                 # Express API + engines
│   ├── src/
│   │   ├── db/             # schema.sql, migrate.ts, seed.ts
│   │   ├── engines/        # clustering.ts, severity.ts, sequencing.ts, escalation.ts,
│   │   │                   # conflicts.ts, verification.ts, locationTrust.ts, clock.ts
│   │   ├── routes/         # auth, projects, reports, groups, workorders, verify,
│   │   │                   # subscriptions, notifications, analytics, admin
│   │   ├── middleware/     # auth, rbac, validate, rateLimit, upload
│   │   └── jobs/           # scheduler.ts (runs every 30 s)
│   └── tests/
├── data/seed/              # seed JSON/TS data
├── demo/                   # demo.mp4 goes here (a placeholder note until recorded)
├── Dockerfile, render.yaml, .env.example, README.md, LICENSE (MIT)
```

Root `package.json` scripts: `dev` (client + server together), `build`, `start`, `test`, `db:migrate`, `db:seed`, `lint`.

---

## 2. Roles and authentication

- Roles: `citizen`, `officer` (belongs to exactly one department), `admin`. Public visitors (not logged in) can browse everything read-only.
- Email + password, bcrypt-hashed, JWT in an httpOnly, SameSite=Lax cookie. Include logout and "me" endpoints.
- Citizens register with name, email and phone. For the demo, treat registration as "verified" (set `verified=1`), but keep the field and enforce it in the verification rules.
- RBAC middleware on every route. Officers can only act on their own department's items. Admin can act on everything. Return 401/403 correctly and show friendly UI messages.
- **Demo accounts (seeded, password `demo1234`)**: `citizen@demo.com`, `citizen2@demo.com`, `citizen3@demo.com`, `sewage@demo.com`, `drainage@demo.com`, `electricity@demo.com`, `telecom@demo.com`, `roads@demo.com`, `admin@demo.com`. Show a "Try a demo account" panel on the login page with one-click sign in for each role.
- Validate **every** request body, query and param with zod. Reject bad input with clear, field-level error messages. Never trust client-sent roles, user IDs or trust levels.

---

## 3. Data model (SQLite)

Create these tables with proper types, foreign keys, indexes (on lat/lng, status, department, spot), and `created_at` / `updated_at`.

- `users(id, name, email UNIQUE, phone, password_hash, role, department_id NULL, verified, created_at)`
- `departments(id, code, name, dependency_level, head_user_id)`. Seed: **Sewage & Water** (level 1), **Storm Drainage** (level 2), **Electricity** (level 3), **Telecom** (level 3), **Roads** (level 4). Lower level means work goes first (underground to surface).
- `contractors(id, name, rating)` (invented names)
- `projects(id, title, purpose, department_id, contractor_id, road_name, ward, lat, lng, status, claimed_status, start_date, planned_end, actual_end, sanctioned_budget, spent, maintenance_budget, maintenance_spent, created_by, created_at)`; status is one of `planned | in_progress | completed | delayed | disputed`
- `project_delays(id, project_id, old_end, new_end, reason NOT NULL, changed_by, changed_at)`
- `project_updates(id, project_id, status, note, created_by, created_at)` (timeline entries)
- `reports(id, user_id, category, department_id, description, lat, lng, location_source, location_trust, location_flag, weight, status, group_id, project_id NULL, image_hashes, created_at)`; `location_source` is `exif | device_gps | manual_pin`; `location_trust` is `high | low`; `location_flag` is `ok | unverified`; status is `open | acknowledged | in_progress | resolved | reopened`
- `report_photos(id, report_id, path, sha256, width, height, bytes)`
- `report_replies(id, report_id, user_id, message, created_at)`
- `spots(id, lat, lng, radius_m, label, created_at)` (a *location cluster*)
- `problem_groups(id, spot_id, category, department_id, severity, report_count, weighted_count, status, first_reported_at, last_reported_at, stalled_since NULL)`
- `work_orders(id, spot_id, status, created_at)` and `work_order_items(id, work_order_id, group_id, department_id, sequence_no, role, tie_break_reason, status, expected_complete_at, scheduled_start_at, started_at, completed_at, escalation_level, delay_reason)`; role is `primary | secondary | parallel`; status is `pending | scheduled | in_progress | complete | overdue`
- `verifications(id, user_id, project_id, status_type, lat, lng, accuracy_m, distance_m, photo_path, sha256, created_at, UNIQUE(user_id, project_id, status_type))`
- `subscriptions(id, user_id, kind, ward, center_lat, center_lng, radius_m, road_name, created_at)`
- `notifications(id, user_id, type, title, body, link, read, created_at)`
- `escalations(id, work_order_item_id, level, notified_user_id, reason, created_at)`
- `conflicts(id, project_a, project_b, distance_m, gap_days, suggestion, status, created_at)`
- `settings(key PRIMARY KEY, value)`, with every configurable number below stored here and editable in the admin panel
- `audit_log(id, actor_id, action, entity, entity_id, detail_json, created_at)`

---

## 4. The clock (needed for a live demo)

Create a `clock.ts` service. **All time-based logic (escalation, 1-hour secondary gap, 7-day windows, stalled detection) must call `clock.now()`**, never `Date.now()` directly. `clock.now()` returns real time plus an admin-set offset stored in `settings`.

Add a **"Time travel" control in the admin/officer UI** ("Skip +1 hour / +1 day / +3 days / Reset") so judges can watch escalation and the 1-hour hand-off happen in seconds. Label it clearly as a demo tool.

---

## 5. Core engines (the technical heart; write these as pure, unit-tested functions)

### 5.1 Clustering (grouping problems)
- Step 1, **by location**: union reports that are within `cluster_radius_m` (default **50 m**, haversine) into a *spot*. Only consider open, acknowledged, in-progress and reopened reports. Use a spatial pre-filter (bounding box) before haversine.
- Step 2, **by problem type**: inside each spot, group by `category`, creating `problem_groups`.
- Categories (each maps to an owning department): `sewage_leak, sewage_blockage, water_pipe_leak (Sewage & Water)`, `drain_blockage, waterlogging (Storm Drainage)`, `live_wire, streetlight_out, transformer_issue (Electricity)`, `cable_fault, open_trench_cable (Telecom)`, `pothole, road_cave_in, damaged_road (Roads)`.
- Cluster on every new report, on resolve and on reopen. It must be **idempotent** and must merge or split spots correctly when reports are added or removed. Ten reports of one pothole become one group with `report_count = 10`.
- A new report near an existing spot joins it. A far-away report creates a new spot.

### 5.2 Severity (Minor / Moderate / Major)
Compute per problem group, take the **highest** that applies:
- **Major**: category flagged safety/health-critical (`live_wire, road_cave_in, sewage_leak` with the "open or overflowing" flag, `transformer_issue`), **or** `weighted_count >= major_count_threshold` (default **10**), **or** the linked work has been stalled `>= stall_days_major` (default **14**) days.
- **Moderate**: `weighted_count` between **4 and 9**, **or** category is `drain_blockage, waterlogging, sewage_blockage, water_pipe_leak, cable_fault`.
- **Minor**: otherwise.
- `weighted_count` = sum of report `weight` (**high trust = 1.0, manual pin = 0.5**).
- Store a human-readable `severity_reason` (e.g. "Major: 12 reports, live wire") and show it in the UI.
- The officer queue sorts by severity, then weighted count, then age.

### 5.3 Multi-department sequencing (primary and secondary)
A **work order** exists for any spot that has problem groups owned by **2 or more departments**.
- Sort departments by `dependency_level` (lowest first). The first is **primary**, the following are **secondary** (chained, each one starting after the previous finishes).
- **Same-level tie-break**, applied in order until one wins, and store the winning rule in `tie_break_reason`:
  1. higher severity group first
  2. department already `in_progress` on site first
  3. higher `weighted_count` first
  4. older `first_reported_at` first
  5. admin can set `parallel`; otherwise the lower `department_id` goes first
- When the primary officer marks **Complete**: set `completed_at = clock.now()`, then for the next item set `scheduled_start_at = completed_at + secondary_gap_minutes` (default **60**), status `scheduled`, and **notify the secondary department's officers immediately** (in-app notification with the exact start time). Repeat down the chain.
- Show the full sequence to citizens and officers as a **timeline**, with a live countdown for the 1-hour gap.
- Recompute the work order when groups are added or removed (e.g. a new electricity problem appears at an existing sewage and pothole spot).
- Officers cannot mark a secondary item started before its `scheduled_start_at` unless an admin releases it.

### 5.4 Escalation ladder (primary does not finish)
- When an officer **accepts** a work item they set (or accept the default for) `expected_complete_at`. Defaults by severity: Major **1 day**, Moderate **3 days**, Minor **7 days** (configurable).
- Grace periods after `expected_complete_at`: Major **24 h**, Moderate **72 h**, Minor **7 days**.
- Scheduler (every 30 s) checks open items:
  - past expected completion: status `overdue`, project shows a **Delayed** badge, require a delay reason from the officer.
  - past expected + grace: **Level 1**, notify the primary department head.
  - past expected + 2x grace: **Level 2**, notify the admin (Municipal Commissioner role).
- While overdue, the secondary stays `pending` and is notified of the delay and new ETA.
- At Level 2, the admin can **reassign** the job (to another contractor or department) or **release the secondary** to proceed in parallel.
- Escalations are idempotent (one per level per item), recorded in `escalations`, and appear in notifications and the public delay history.

### 5.5 Dig-once conflict detection
When a project is created or its dates change, find other projects with `status in (planned, in_progress)` **or** completed within the last `conflict_months` (default **6**) that are within `conflict_radius_m` (default **100 m**) or share the same `road_name`. If the date windows overlap or the gap is under the threshold, create a `conflict` with a clear suggestion ("Roads work planned on Lake View Rd 12 days after Sewage work finished. Merge or sequence these jobs"). Show a warning banner **before** the officer saves, plus a conflicts list, and let them **link or merge schedules**. Citizens see "Coordinated with ..." on the project page.

### 5.6 Early warning and analytics
- **Early warning**: if a project or problem group gets `>= warning_reports` (default **5**) in `warning_days` (default **7**), notify the department head once.
- **Scorecards** per department and per contractor: complaints per project, average response time (report to acknowledgement), repeat-issue rate, delay rate, budget variance (spent vs sanctioned).
- **Heatmap** of open complaint density.
- Analytics endpoints return JSON that the charts consume.

### 5.7 Progress verification (anti-gaming)
Enforce all of these **on the server** (never only in the UI):
- Must be logged in and `verified = 1`.
- **One verification per user per project per `status_type`** (`in_progress`, `completed`), enforced by the DB UNIQUE constraint and a friendly error.
- Device GPS within `verify_radius_m` (default **200 m**) of the project site; reject if `accuracy_m > 50`; reject if no location sent.
- A **geotagged photo is required**, passing the same checks as report photos.
- **Quorum**: a status becomes **Citizen-confirmed** only after `>= 3` distinct users verify it.
- If citizen verification disagrees with `claimed_status` (for example contractor says completed, citizens say not completed), set the project to **Disputed** and notify the officer. Do **not** auto-change the official status.
- Users belonging to the project's own department cannot verify it. Officers and admins cannot verify at all.
- Daily cap per user (default 20 verifications). All verifications are written to the audit trail with distance and accuracy.

### 5.8 Photo upload and location trust
Pipeline for every uploaded image (reports and verifications):
1. multer in-memory, **max 5 MB per file, max 3 photos per report, 1 per verification**.
2. Detect the real type from **magic bytes** with `file-type`. Accept only JPEG, PNG and WebP. Reject everything else (including renamed files) with a clear message.
3. HEIC: convert to JPEG **in the browser** (lazy `heic2any`) before upload; if conversion fails show a clear message.
4. Read EXIF GPS and timestamp with `exifr` **before** stripping.
5. Resize to a max of 1600 px on the long side, re-encode, and **strip all EXIF** with `sharp` before storing. Never expose original metadata publicly.
6. Compute a sha256 of the cleaned image; reject or merge **duplicates**.
7. Save to `uploads/` (served as static files) and record in `report_photos`.

**Location source and trust** (`locationTrust.ts`, unit tested):
- Priority: **1) EXIF GPS** (only if EXIF timestamp is within 24 h) then **2) device GPS at submit time** then **3) manual pin**.
- EXIF and device GPS differ by **more than 200 m**: set `location_flag = unverified`.
- Manual pin: `location_trust = low`, `weight = 0.5`. It must lie inside the configured city bounding box, otherwise reject.
- Show the location source badge (EXIF / GPS / Pin) to officers on every report.
- Rate limit: max reports per user per day (default 10).

---

## 6. API (REST, JSON, all validated)

Implement at least:
`POST /api/auth/register|login|logout`, `GET /api/auth/me`
`GET /api/projects` (filters: ward, department, status, severity, q, bbox), `GET /api/projects/:id`, `POST/PATCH /api/projects` (officer/admin; PATCH of `planned_end` **requires** `reason`), `GET /api/projects/:id/timeline`, `GET /api/projects/:id/delays`
`GET /api/budget/summary` (by department, contractor, ward)
`POST /api/reports` (multipart), `GET /api/reports/mine`, `GET /api/reports/:id`, `POST /api/reports/:id/reply`, `POST /api/reports/:id/confirm-resolved`, `POST /api/reports/:id/reopen`
`GET /api/groups` (officer queue with severity ordering), `GET /api/groups/:id`, `PATCH /api/groups/:id/status`
`GET /api/workorders`, `GET /api/workorders/:id`, `POST /api/workorder-items/:id/accept|start|complete|delay`, `POST /api/workorder-items/:id/release` (admin), `POST /api/workorder-items/:id/reassign` (admin)
`POST /api/projects/:id/verify` (multipart), `GET /api/projects/:id/verifications`
`GET/POST/DELETE /api/subscriptions`, `GET /api/disruptions` (roads affected in the next N days, powers "Avoid this road")
`GET /api/notifications`, `POST /api/notifications/:id/read`
`GET /api/analytics/heatmap|scorecards|hotspots|delays|budget`, `GET /api/conflicts`
`GET/PATCH /api/admin/settings`, `POST /api/admin/time-travel`, `POST /api/admin/reset-demo`
`GET /api/health`

Consistent error shape: `{ error: { code, message, fields? } }`. Pagination on lists. Correct status codes.

---

## 7. Citizen View (public site) pages

1. **Home**: bold hero stating the mission, live stats (active projects, open problems, total budget tracked, delayed count) with count-up animation, a map preview and clear calls to action.
2. **Explore map and list**: full map with severity- and status-coloured markers, a list that stays in sync, filters (area, department, status, severity), search, "near me".
3. **Project page**: purpose, **department**, **contractor**, dates, status badge, **timeline**, **delay history with reasons**, **budget panel** (sanctioned, spent, remaining, variance, **maintenance budget and maintenance spent**), the **work-order sequence** (who goes first, who follows and when), "Coordinated with ..." conflicts, citizen reports on it, and the **verification panel** (see 7.4).
4. **Budget transparency page ("Where the money goes")**: charts by department, contractor and ward; sanctioned vs spent; maintenance costs; highlight over-budget and delayed projects. Make this page beautiful and easy to read.
5. **Report an issue** (stepper): choose category, describe, add up to 3 photos (client-side compress and HEIC convert, with progress and error states), confirm location (EXIF / device GPS / manual pin on a map with the source and trust shown), review, submit. Show the resulting group and its department.
6. **My reports**: status, department replies, "Confirm resolved" or "Reopen".
7. **Verify progress**: a clear, guided flow with live GPS check, distance to site, photo, and plain-language errors if rejected (too far, already verified, low accuracy). Show the quorum progress ("2 of 3 neighbours confirmed") and a **Citizen-confirmed** or **Disputed** badge.
8. **Alerts**: subscribe by ward, by drawn circle on the map (radius slider), or by road; notification center with unread count.
9. **Avoid this road / Disruption planner**: map and list of roads with closures or work in the next 7, 14 or 30 days.
10. **About this demo / How it works**: explains simulated data, the sequencing logic and the trust rules.

**Demo mode for location:** judges use desktops with no GPS. Add an admin setting `demo_location_mode` (**ON** in the deployed demo, with a visible "Demo mode" ribbon) that lets a user **pick a simulated device location on the map** for reporting and verification. It must still run all the same distance, accuracy and trust checks, just with the simulated coordinates. Document it in the README and the About page.

## 8. Department View (officer and admin) pages

1. **Command dashboard**: priority queue of problem groups sorted by severity, KPI tiles (open, major, overdue, avg response time), and alerts (early warnings, escalations, conflicts).
2. **Problem group detail**: all merged reports with photos, location-source badges, report count, severity and its reason, replies, and actions (acknowledge, reply, set in-progress, resolve).
3. **Work-order board**: for each spot with 2 or more departments, show the **sequence timeline** (primary then secondary, with the 1-hour gap countdown), tie-break reason, expected completion, escalation level, and actions (accept with ETA, start, complete, enter delay reason). Completing the primary visibly triggers the secondary's notification and schedule.
4. **Projects management**: create/edit projects with budget fields, contractor, dates. The conflict warning appears **before** save. Changing a deadline forces a reason.
5. **Conflicts**: dig-once list with merge or sequence actions.
6. **Analytics**: heatmap, hotspots, department and contractor scorecards, delay and budget charts.
7. **Notifications**.
8. **Admin only**: settings (every configurable number from this document), tie-break overrides (parallel), release or reassign stalled items, disputed verifications review, time-travel control, reset demo data.

---

## 9. Seed data (rich enough to demo everything)

Use an invented locality ("Lakeview Nagar, Ward 7") around IIITDM Kancheepuram's area (roughly 12.83 N, 80.14 E, spread over about 2 km). Seed:
- the 5 departments, 8 invented contractors, all demo users, 3 wards
- **14 to 18 projects** across all statuses, including: one delayed with a delay history, one over budget, one disputed, one completed with maintenance cost, one planned that **triggers a dig-once conflict**
- **40 to 60 reports** across categories, trust levels and photos (generate simple placeholder images with sharp), producing: a spot with **sewage leak + pothole** (the hero demo), a spot with **electricity + telecom at the same level** (tie-break demo), a Major cluster (10+ reports), a Minor one, an overdue work item close to escalation, and a manual-pin report flagged low trust
- subscriptions, notifications and audit entries so every page has content from the first load

Provide `POST /api/admin/reset-demo` to restore the seed.

---

## 10. Hero demo flow (must work end to end; record the video from this)

1. Citizen opens the site (no login), explores the map and opens a project with budget, contractor and department.
2. Citizen logs in, reports a pothole at a spot that already has a sewage leak (photo with EXIF location). The group count rises and the spot becomes a work order.
3. Officer (Sewage) sees the Major group, accepts with an ETA, starts, completes. The **Roads** officer is notified instantly and sees "scheduled to start in 1 hour" with a countdown.
4. Admin time-travels +1 hour. Roads starts and completes. The citizen sees the update.
5. Admin creates a Roads project on a segment dug by Drainage 2 months earlier. The **dig-once warning** appears.
6. Three citizens verify progress (the first two within radius, one rejected for being too far). The project shows **Citizen-confirmed**.
7. Time-travel past a grace period. Escalation Level 1 then Level 2 fire. Show the delay log.
8. Show the analytics heatmap and scorecards.

---

## 11. UI and visual design brief (make it genuinely different from the default look)

**Concept: "The City Ledger."** An editorial, trustworthy, slightly warm civic publication feel for citizens, and a calm, dense "control room" for departments. It should feel like a well-designed newspaper data desk, not a SaaS template.

**Hard "don'ts":** no default Tailwind blue or indigo, no purple-to-blue gradient hero, no stock Bootstrap or Material look, no emoji as icons, no generic gray cards on white, no centered-stack-of-cards landing page, no lorem ipsum, no default browser form controls.

**Palette (define as CSS variables and in the Tailwind theme, no default colors):**
- Citizen (light) surfaces: paper `#F4EFE6`, paper-2 `#EBE4D4`, ink `#12211D`, ink-soft `#4B5B55`, hairline `#D9D0BC`
- Brand: deep moss `#1F4D3F`, moss-light `#3E7A66`
- Severity (must be distinguishable without colour via icon and text): **Minor** lagoon `#2A8C82`, **Moderate** saffron `#E9A23B`, **Major** brick `#C8412B`
- Status accents: verified `#2E7D5B`, disputed `#B4308B`, delayed `#C8412B`
- Department (dark) surfaces: night `#0D1513`, panel `#15201D`, panel-2 `#1C2A26`, line `#2A3A35`, text `#E8EFEA`, muted `#8FA39B`, signal `#F2B14B`
- Provide a **dark mode** toggle for the citizen site and default the department view to dark. All colours must pass WCAG AA contrast.

**Typography (Google Fonts):** headings in **Fraunces** (variable, optical size, expressive but readable), body in **Instrument Sans** (or DM Sans), numbers, IDs and budgets in **JetBrains Mono** with tabular figures. Large editorial numerals for stats. Fluid type scale.

**Layout and components:**
- Asymmetric editorial grid, big confident headings, generous whitespace, 1 px hairline borders, 14 to 18 px rounded corners, subtle paper-grain background texture (inline SVG noise at very low opacity), soft layered shadows.
- Severity chips with icon + label; status badges; budget bars with a "sanctioned vs spent" marker and variance colouring; a signature **sequence timeline component** (vertical rail with nodes for primary, 1-hour gap countdown, secondary) used on project and work-order pages.
- Custom SVG map markers (pin shapes by severity, a pulsing ring on Major), clustered when zoomed out. Style the base map to match the palette (desaturate and tint the tiles with a CSS filter; keep attribution visible).
- Icons: lucide-react only, consistent stroke width.
- Charts: Recharts with palette colours, direct labels over legends where possible, accessible tooltips.
- Motion with framer-motion: staggered page-load reveals, count-up numbers, smooth map-to-list focus, animated progress rings for quorum and countdowns. Respect `prefers-reduced-motion`.
- States everywhere: skeleton loaders, friendly empty states with illustration-style SVGs, clear error states, toasts for actions, form validation messages inline.
- **Fully responsive** (320 px up). Citizen pages must be excellent on phones (bottom navigation, large tap targets, the report flow usable one-handed). The department view is optimised for desktop and still usable on tablet.
- Accessibility: semantic HTML, focus rings, keyboard navigation, aria labels on map controls, alt text, no information conveyed by colour alone.
- Lighthouse targets: Performance >= 85, Accessibility >= 95 on the citizen home page. Lazy-load maps, charts and heic2any; code-split by route.

A distinctive logo and wordmark for "CivicTrack" (simple SVG, a road-meets-eye mark nodding to "4 Eyes"), favicon, and open-graph image.

---

## 12. Quality, security and robustness

- TypeScript strict mode on both sides, ESLint and Prettier, no `any` in engines.
- Security: helmet, strict CORS (same origin in production), rate limits on auth and uploads, bcrypt, parameterised SQL only (no string-built queries), file type validation by content, path-safe filenames (UUIDs), body size limits, escape user text on render, no secrets in the repo, `.env.example` complete.
- Handle edge cases from README section 4 explicitly, and add unit tests for each:
  - cluster merge/split and idempotency
  - severity thresholds, including weighted manual-pin reports
  - tie-break order (including the parallel fallback and deterministic final tie)
  - the 1-hour gap computation and chained secondaries, including a work order that gains a third department
  - escalation firing exactly once per level; overdue then recovered
  - verification: duplicate, too far, low accuracy, no location, quorum, dispute, own-department block
  - photo: wrong type, renamed file, oversize, 4th photo, duplicate hash, EXIF stripped from the stored file
  - EXIF vs device mismatch above 200 m; manual pin outside the city; deadline change without a reason is rejected
- Integration tests (supertest) for auth/RBAC and the full hero flow.
- A Playwright smoke test that opens the deployed or local app and walks the citizen and officer journeys.
- Database writes that span several tables must run in **transactions**.
- The scheduler must survive restarts (state lives in the DB, not in memory).

---

## 13. Build order (phases; keep the app runnable after each)

1. **Foundation**: repo, tooling, schema, migrations, seed, auth, RBAC, clock, health, design tokens and fonts, app shell.
2. **Citizen read-only**: home, map, project page, budget page, delay history, timeline.
3. **Reporting pipeline**: upload pipeline, location trust, report flow, my reports, replies, confirm/reopen.
4. **Engines**: clustering, severity, sequencing, tie-break, escalation scheduler, conflicts, early warning (each with unit tests).
5. **Department view**: dashboard, group detail, work-order board, projects management, conflicts, admin settings, time-travel.
6. **Verification, alerts and planner**: verify flow with quorum and disputes, subscriptions, notifications, disruption planner, analytics and heatmap.
7. **Polish**: full responsive pass, motion, empty and error states, accessibility, performance, About page.
8. **Ship**: Dockerfile, render.yaml, deploy to a public URL, run the Playwright smoke test against it, update README (stack, setup, repo structure, live URL, demo accounts, library disclosure), add `demo/README.md` explaining that the video must be recorded from section 10.

---

## 14. Definition of Done (tick every box before you finish)

- [ ] `npm install && npm run dev` works on a clean machine; `npm run build && npm start` serves the full app; `npm test` passes.
- [ ] Deployed to a **public URL**; the app opens with seeded data and demo logins, no setup; `/api/health` is OK.
- [ ] Every feature in `README.md` sections 2.1, 2.2, 2.3 and 3 is implemented and reachable from the UI.
- [ ] Citizen view and Department view are both complete, with correct role-based access.
- [ ] Problems are grouped by location and type, rated Minor/Moderate/Major with reasons, and sorted into an officer queue.
- [ ] Multi-department spots produce a work order with a primary department, chained secondaries, tie-break reasons, and the **1-hour-after-completion** schedule with an instant notification.
- [ ] Escalation ladder works (Level 1 and Level 2, once each) and is demonstrable via time travel.
- [ ] Dig-once conflict warning appears before saving a conflicting project.
- [ ] Budget transparency shows sanctioned, spent, maintenance, department, contractor and variance on project pages and the budget page.
- [ ] Delay reasons are mandatory; delay history is public; Delayed badge appears automatically.
- [ ] Verification rules (login, one per user, 200 m, accuracy, photo, quorum of 3, dispute, own-department block) are enforced server-side with friendly errors.
- [ ] Photo rules (types, magic-byte check, 5 MB, 3 per report, duplicate hash, EXIF stripped) and the location-source/trust logic work and are shown in the UI.
- [ ] Alerts, notification center, area subscriptions and the "avoid this road" planner work.
- [ ] Analytics: heatmap, hotspots, scorecards, early-warning alerts.
- [ ] Demo location mode works for judges without GPS and is clearly labelled.
- [ ] No console errors, no failed network calls, no broken layouts at 360 px, 768 px and 1440 px, in light and dark mode.
- [ ] UI follows section 11 and is clearly not a default template.
- [ ] README updated with the real stack, setup steps, live URL, demo accounts, library disclosure and repo structure; `LICENSE` added.
- [ ] A short **final report** listing what was built, how to run it, the public URL, the demo accounts, and anything that could not be completed (be honest; do not claim features that do not work).
