# FIX: MAP TILES, DROPDOWN STYLING, AND REAL GOOGLE SIGN-IN

Follow the same rules as ANTIGRAVITY_FIX_ALL.md: do NOT change the port (5000) or server binding, do NOT test through a second terminal from your shell tool, fix real causes (no stubs, no fake data), keep `npm run build` at exit 0 and `npm test` passing, and verify in a real browser. At the end, give me a table: Item | Fixed? | How you verified it, and say honestly what you could not verify.

---

## 1. MAP TILES SHOW "API KEY REQUIRED" (highest priority)
Every map tile shows a watermark "API KEY REQUIRED carto.com/basemaps/apikey". CARTO's free raster tiles now need a key. Replace the tile source everywhere with something that needs no key:

- Create ONE shared map config (`client/src/lib/mapConfig.ts`) used by every map in the app (Explore, heatmap, report location picker, verification map, "Avoid this road" planner, subscription area drawing, project page mini map).
- Primary tile layer: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom: 19`, attribution `© OpenStreetMap contributors` (visible link to https://www.openstreetmap.org/copyright).
- Fallback: if tiles error repeatedly (`tileerror` events), switch automatically to Esri World Street Map `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}` with attribution `Tiles © Esri`.
- Allow an optional override via `VITE_MAP_TILE_URL` and `VITE_MAP_TILE_ATTRIBUTION`.
- Search the whole repo for `cartocdn`, `basemaps.cartocdn.com` and `carto.com` and remove every reference, including CSP entries.
- Update the helmet CSP so `img-src` allows `https://tile.openstreetmap.org`, `https://*.tile.openstreetmap.org`, `https://server.arcgisonline.com`, `data:` and `blob:`.
- Optionally tint the tiles to match the palette with a subtle CSS filter on the tile pane (for example `sepia(0.15) saturate(0.85)`); keep labels readable.
- Verify: tiles actually load (no watermark), markers sit correctly on the map, zoom and pan work, and the OSM attribution is shown. Check every page that has a map.
- Add a short "Map data and tiles" line to the README library disclosure table (OpenStreetMap, ODbL; Esri fallback).

## 2. DROPDOWNS (SELECT) AND OTHER FORM CONTROLS STILL BLACK
On Explore the filter dropdowns (Status, Department, Severity) have a black background with dark, unreadable text. The earlier text-input fix did not cover `select`. Also on the login page the email box was black. Find the real cause (look for `bg-black`, `color-scheme: dark`, `@media (prefers-color-scheme: dark)`, Tailwind `dark:` variants triggered by the OS dark mode, or a global `appearance` reset) and fix it for ALL controls:
- `input` (every type), `textarea`, `select`, `option`, date pickers, file inputs, range sliders, checkboxes and radios, autofill state (`:-webkit-autofill`).
- Light (citizen) theme: white background `#FFFFFF`, text `#0B1512`, 1px border `#D9D0BC`, placeholder `#6B7A74`, visible focus ring, `color-scheme: light`. Style `option` too (white background, dark text).
- Dark (department) theme: panel background `#15201D`, text `#E8EFEA`, border `#2A3A35`, `color-scheme: dark`.
- The citizen site must NOT follow the OS dark-mode setting automatically; only follow an explicit toggle in the UI.
- Check every page and form as every role (login, register, filters on Explore and on department pages, report an issue, verify, replies, project create/edit, delay reason, admin settings).

## 3. REAL GOOGLE SIGN-IN ("Continue with Google")
Make accounts real. Citizens sign in with their own Google (Gmail) account with one click: no typing, no password, an account is created automatically the first time. Department officers sign in with Google too, but are recognised by their email domain and get the department view.

### 3a. Frontend
- Use Google Identity Services (`https://accounts.google.com/gsi/client`): the official **"Continue with Google"** button on the login page and on a register page (they can be the same page). Optionally enable One Tap. Load the script lazily.
- Client ID comes from `VITE_GOOGLE_CLIENT_ID` (Vite embeds it at build time).
- If `VITE_GOOGLE_CLIENT_ID` is missing, show a friendly message instead of a broken button, and keep the demo accounts working.
- After login, show the user's Google name and profile photo in the header user menu.
- Redirect by role: citizens to the citizen home, officers to their department dashboard, admins to the admin area. Role-based route guards on the client (the server remains the real authority).
- Keep a clearly separated **"Judges: try a demo account"** panel (email + password `demo1234`, one-click buttons for citizen, each department officer and admin), because judges will not have department-domain Google accounts.
- Logout must clear the cookie and call `google.accounts.id.disableAutoSelect()`.

### 3b. Backend
- New `POST /api/auth/google` that receives the Google ID token (`credential`) and verifies it on the server with the `google-auth-library` package: `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`. Reject if verification fails, the audience does not match, or `email_verified` is not true.
- Find or create the user by `google_sub` (stable Google ID), falling back to email. Store `google_sub`, name, email, picture. Link to an existing demo user with the same email.
- Issue the same httpOnly, SameSite=Lax session cookie/JWT the app already uses. Never trust a role sent from the client.
- Add DB tables and migrations: `department_domains(id, domain UNIQUE, department_id)` and `role_allowlist(id, email UNIQUE, role, department_id NULL, created_by, created_at)`. Add `google_sub`, `picture` columns on `users`.
- **Role resolution (a pure, unit-tested function):**
  1. If the email is in the env var `ADMIN_EMAILS` (comma-separated), role is `admin`.
  2. Else if the email is in `role_allowlist`, use that role and department.
  3. Else if the email's domain matches a row in `department_domains` AND Google's `hd` claim in the verified token equals that same domain (this proves it is a real Google Workspace account of that organisation), role is `officer` for that department.
  4. Otherwise role is `citizen`.
  - Re-evaluate the role on every login so changes take effect.
  - A normal `@gmail.com` user can never become an officer through the domain rule (no `hd` claim).
- Admin page: manage department email domains and the allowlist (add and remove), list users with roles.
- Seed example domain mappings for the demo departments (use clearly fictional domains) and document that real domain-based officer detection only works for Google Workspace domains. To test officer and admin views with ordinary Gmail accounts, use the allowlist and `ADMIN_EMAILS`.
- Update helmet CSP for Google sign-in: `script-src` https://accounts.google.com/gsi/client; `frame-src` https://accounts.google.com/gsi/; `connect-src` https://accounts.google.com/gsi/; `style-src` https://accounts.google.com/gsi/style; `img-src` https://lh3.googleusercontent.com and https://*.googleusercontent.com. Do not disable helmet. Set `Cross-Origin-Opener-Policy: same-origin-allow-popups` so the Google popup works.
- Rate-limit the auth endpoints and log failures.

### 3c. Config and docs
- Add to `.env.example` and the README setup section: `GOOGLE_CLIENT_ID=`, `VITE_GOOGLE_CLIENT_ID=`, `ADMIN_EMAILS=`. Explain that no client secret is needed for this flow, that Vite env vars are baked in at build time (rebuild after changing them), and that the deployed site URL must be added under "Authorized JavaScript origins" in Google Cloud.
- Document how to create the Google OAuth client (steps below in section 3d) in the README, and list `google-auth-library` and Google Identity Services in the open-source disclosure table.
- Never commit real IDs or secrets; `.env` stays in `.gitignore`.

### 3d. Tests
- Unit tests for role resolution: admin env, allowlist, domain + matching `hd`, domain without `hd` (must be citizen), `hd` mismatch, unverified email, unknown domain.
- Integration test for `/api/auth/google` with the Google verification mocked: first login creates a citizen, second login reuses it, an allowlisted email becomes an officer, a bad token is rejected.
- Make sure the existing demo email/password login still works and the app still works when `GOOGLE_CLIENT_ID` is not set.

## 4. KEEP EVERYTHING ELSE HEALTHY
- `npm run build` exits 0, `npm test` passes, the app still starts from a clean `dist` and database.
- Re-check that no console errors appear on the main pages (apart from browser-extension noise).
- Final report: the table from the top, plus a list of every page you opened.
