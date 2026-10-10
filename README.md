# CivicTrack: Transparency and Coordination in Public Works

> **Track:** CivicTech: *Improving Transparency and Coordination in Public Works Projects*
> **Event:** 24-Hour Web Development Hackathon, IIITDM Kancheepuram (09–10 Oct 2026)

| | |
|---|---|
| **Team name** | Team 4 Eyes |
| **Team leader** | Rituk |
| **Team members** | Rituk, Developer 2, Developer 3, Developer 4 |
| **Live demo (public link)** | https://civictrack.onrender.com |
| **Demo video (2–5 min)** | [`/demo/demo.mp4`](./demo/demo.mp4) |
| **Demo logins** | See [Demo accounts](#demo-accounts) |

---

## 1. Problem Statement

Residents see roads dug up, drains under repair and pipelines being laid every day. These projects are run by different municipal and utility departments and contractors, and:

- **Information is scattered.** Project details sit in offices, on notice boards and in informal channels, and rarely reach the people affected.
- **Residents can't see the basics.** They can't tell a project's purpose, timeline, responsible authority, or why it is delayed.
- **Departments don't coordinate.** The same road can be dug up several times in a few months by different departments.
- **There is no accountability.** When work stalls or is done badly, there is no simple way to follow up, verify progress or hold anyone responsible.
- **Deadlines slip silently.** Residents have no reliable way to plan around disruptions.
- **Public money is wasted unnoticed.** Duplicated work and poor coordination cost money, and citizen feedback is not used to catch problems early.

**Impact:** traffic problems, safety hazards, business losses, falling trust in local authorities, and residents who feel unheard.

---

## 2. Our Solution

CivicTrack is a web platform with **two views on one shared dataset**:

- a **Citizen View** that makes every public work visible, understandable and trackable, and
- a **Department View** that groups citizen-reported problems by location and severity and sequences the departments that must work at the same spot.

### 2.1 Citizen View (transparency)

| Feature | What the citizen gets |
|---|---|
| **Public works map** | Every project on a map and list, filterable by area, department, status and severity. |
| **Project detail page** | Purpose, **responsible department**, **contractor**, start/end dates, current status and a full timeline. |
| **Budget transparency** | **Sanctioned budget**, amount spent so far, **maintenance budget/cost** and variance (over or under budget). |
| **Delay explanations** | Every deadline change requires a reason. A delay history log is shown publicly and delayed projects get an automatic "Delayed" badge. |
| **Report a problem** | Submit an issue with a geotagged photo, category (sewage, road, drainage, water, electricity, etc.) and description. |
| **Verify progress** | Residents physically near the site confirm "work in progress" or "completed". This is compared against the status claimed by the contractor (see [anti-gaming rules](#23-trust-and-anti-abuse-rules)). |
| **Follow-up and tracking** | Track the status of every report and see the department's reply. Confirm whether the issue was truly resolved. |
| **Area alerts** | Subscribe to an area or route and get notified of upcoming work and closures. |
| **Dig-once schedule** | See the planned order of works at a location, so residents know *when* each department will arrive. |

### 2.2 Department View (coordination and feedback)

#### Step 1: Group problems
Citizen reports are automatically clustered:

1. **By location**, merging reports within a small radius (e.g. 50 m) into one *location cluster*.
2. **By problem type** within each cluster (sewage leak, pothole, drain blockage, broken cable, ...).

Ten complaints about the same pothole become **one** problem with a "10 reports" count.

#### Step 2: Classify severity
Each problem group is rated **Minor / Moderate / Major**, using transparent rules:

| Severity | Rule of thumb (configurable) |
|---|---|
| **Major** | Safety or health risk (open sewage, exposed wires, large road cave-in), or many reports (e.g. 10+), or work stalled for 14+ days |
| **Moderate** | Disrupts daily use (blocked drain, large pothole), or 4–9 reports |
| **Minor** | Cosmetic or low impact, 1–3 reports |

Officers see a **prioritised queue** sorted by severity, then report count, then age.

#### Step 3: Multiple problems at one location, with a primary and a secondary department
When one location has problems belonging to **more than one department**, the system builds a **coordinated work order**:

1. A **primary department** is assigned using a configurable dependency order. Underground work always goes first and surface work last, for example:
   `Sewage / Water → Drainage → Electricity / Telecom → Roads`
2. The primary department is **told to do the primary job first**.
3. The **secondary department is scheduled to arrive 1 hour after the primary department marks its work complete** (the gap is configurable).
4. When the primary marks "Complete", the secondary is **notified automatically** and gets a confirmed start time.
5. The citizen sees the whole sequence on the project page.

> **Example:** At *3rd Main Rd* there is a sewage leak and a pothole. The Sewage Dept is primary and fixes the leak. The moment they mark it done, the Roads Dept is notified to arrive **1 hour later** to repair the pothole, so the road isn't dug twice.

##### 3a. Same-level tie-break (e.g. Electricity vs Telecom)
Departments at the same level of the dependency order are ordered **deterministically**, using these rules in sequence until one wins:

1. **Higher severity group first.** The department whose problem is rated more severe goes first (a live-wire hazard beats a slow cable fault).
2. **Work already in progress first.** A department that has already started on site is not interrupted.
3. **More citizen reports first.** The problem with the higher report count wins.
4. **Older problem first.** The earliest reported problem wins.
5. **Admin override / parallel window.** If still tied, or if the admin knows the works don't conflict (separate ducts), the admin can mark them **parallel**. Otherwise the lower department ID goes first, so the result is always predictable and never stuck.

The chosen order and the *reason* it was chosen (e.g. "Electricity first: higher severity") are shown on the work order, so officers and citizens can see why.

##### 3b. When the primary department does not finish: escalation ladder
Every work order has an **expected completion time** based on severity. If the primary department has not marked it complete by then, the system escalates automatically:

| Severity | Grace period after expected completion | Level 1: notified | Level 2: notified (if still open after a further grace period) |
|---|---|---|---|
| **Major** | 24 hours | Primary department head (e.g. Executive Engineer) | Municipal Commissioner / Admin (after a further 24 hours) |
| **Moderate** | 72 hours | Primary department head | Municipal Commissioner / Admin (after a further 72 hours) |
| **Minor** | 7 days | Primary department head | Municipal Commissioner / Admin (after a further 7 days) |

While the primary is overdue:
- The **secondary department stays pending**, and is told the new status so they don't arrive too early.
- The primary officer **must enter a delay reason** and a new expected date. The delay log and "Delayed" badge become public to citizens.
- At Level 2, the admin can **reassign** the job to another contractor or department, or **release the secondary** department to proceed if the work is safe to do in parallel.

All grace periods are configurable in the admin panel. The values above are our defaults.

#### Step 4: Dig-once conflict detection
When a department plans work on a road segment, the system flags any other planned or recent work nearby (within X months) and suggests merging the jobs. This addresses repeated digging of the same road.

#### Step 5: Analytics and early warning
- Heatmap of complaint hotspots.
- Scorecards per department and contractor: complaints per project, average response time, repeat-issue rate, delay rate, budget variance.
- Early-warning alerts when a project crosses a complaint threshold (e.g. 5 in a week).
- Escalation to the department head if a report is unanswered for N days.

---

## 2.3 Trust and Anti-Abuse Rules

Citizen input only helps if it can be trusted, so both verification and reporting have safeguards.

### Progress verification (anti-gaming)

| Rule | Detail |
|---|---|
| **Login required** | Only logged-in citizens with a verified email or phone number can verify. |
| **One verification per user per project per status** | A user can verify "in progress" once and "completed" once for a project. Repeat clicks are ignored. |
| **Must be near the site** | The device's live GPS location at submission must be **within 200 m** of the project site (configurable). Location permission is required; no location, no verification. |
| **Location accuracy check** | GPS readings with accuracy worse than 50 m are rejected, with a prompt to retry. |
| **Geotagged photo** | A photo is required with a verification, with the same location checks as issue reports (see below). |
| **Quorum, not a single vote** | A status shows as **Citizen-confirmed** only after at least **3 different users** verify it. One person cannot flip a project's status. |
| **Conflicts go to review** | If citizens say "not completed" but the contractor claims "completed", the project is flagged **Disputed** and sent to the department officer. It is **not** auto-changed in either direction. |
| **No self-verification** | Users registered as department or contractor staff cannot verify projects belonging to their own department or contractor. |
| **Rate limits** | Maximum verifications per user per day, with throttling to block scripted bulk voting. |
| **Audit trail** | Every verification stores user, time, location and photo, so abuse can be reviewed and reversed. |

> **Honest limitation:** GPS can be spoofed by a determined person. These rules raise the cost of gaming (location, photo, unique accounts, quorum, officer review) but do not make it impossible. Future work: device attestation and reputation scoring.

### Photo upload rules

| Rule | Detail |
|---|---|
| **Allowed types** | JPEG, PNG and WebP. HEIC from iPhones is converted to JPEG on the client, otherwise rejected with a clear message. |
| **File type check** | The server checks the file's real content (magic bytes), not just the extension, so renamed `.exe` or `.pdf` files are rejected. |
| **Size limit** | Maximum **5 MB per photo**, after the browser compresses and resizes images to at most 1600 px on the long side. |
| **Count limit** | Maximum **3 photos per report**, 1 per verification. |
| **Duplicate detection** | The same image uploaded again (by hash) is rejected or merged. |
| **Privacy** | After location is read, **EXIF metadata is stripped** from the stored copy so the public never receives hidden GPS, device or personal data. |
| **Rate limit** | Maximum reports per user per day to prevent spam. |

### Location source: EXIF vs manually dropped pin
Each report records **where the location came from** and how much we trust it:

| Priority | Source | How it is used | Trust |
|---|---|---|---|
| 1 | **Photo EXIF GPS** | Used if present, and the photo timestamp is recent (within 24 h) | **High** |
| 2 | **Device GPS at submit time** | Used when the photo has no EXIF location (screenshots, and messaging apps strip it) | **High** |
| 3 | **Manually dropped pin** | Allowed as a fallback, but must be inside the city boundary | **Low** |

Consistency checks:
- If **EXIF location and device GPS differ by more than 200 m**, the report is flagged **"location unverified"**, so a photo taken elsewhere cannot pose as a local report.
- **Manual-pin reports** are accepted but carry a lower weight (0.5) in clustering and severity counts until corroborated by a high-trust report within the same cluster or reviewed by an officer.
- A pin outside the supported city boundary is rejected.
- The location source (EXIF / GPS / manual pin) is visible to department officers on each report.

---

## 3. Role-Based Access

| Role | Can do |
|---|---|
| **Citizen** (also public, no login) | Browse projects and budgets, view schedules |
| **Citizen (logged in)** | Report issues, verify progress, subscribe to alerts, confirm resolution |
| **Department officer** | See their department's grouped problems, update status, mark work complete, reply to reports, enter delay reasons |
| **Admin** | Manage departments, contractors, severity rules, sequencing order, tie-break overrides, escalation grace periods, the gap between primary and secondary work, the verification radius and photo limits. Review disputed verifications and reassign stalled jobs |

---

## 4. How the Project Maps to the Evaluation Criteria

| Criterion (weight) | Where to look |
|---|---|
| **Innovation (20%)** | Primary/secondary department sequencing with automatic hand-off, dig-once conflict detection, and crowd-verified progress versus the contractor's claim. |
| **Technical Implementation (35%)** | Location-and-type clustering, severity engine, sequencing/scheduling engine, escalation rules, role-based access, input validation, and edge cases (see below). |
| **Feasibility (20%)** | See [Feasibility and Future Scope](#8-feasibility-and-future-scope). |
| **Video Presentation (15%)** | [`/demo/demo.mp4`](./demo/demo.mp4), a 2–5 min walkthrough of the end-to-end scenario. |
| **Deployment (10%)** | Public link at the top of this README with seeded demo data and no setup needed. |

### Edge cases handled
- Duplicate or near-duplicate reports merge into one group instead of creating new ones.
- The primary department does not finish: the secondary stays pending and the job escalates up the ladder (department head, then Commissioner/Admin) with defined grace periods ([3b](#3b-when-the-primary-department-does-not-finish-escalation-ladder)).
- Two departments at the same dependency level: resolved by a deterministic tie-break, with the reason shown ([3a](#3a-same-level-tie-break-eg-electricity-vs-telecom)).
- Gaming progress verification: one verification per user, GPS within 200 m, geotagged photo, 3-user quorum, disputes go to officer review ([2.3](#23-trust-and-anti-abuse-rules)).
- Bad uploads: wrong file type, oversize files and renamed files are rejected, and EXIF is stripped.
- EXIF location conflicting with device location, or an unreliable manual pin: flagged and down-weighted.
- Overlapping or conflicting schedules at the same location are detected and flagged.
- Reports with missing or invalid location or photo are rejected with a clear message.
- A deadline change without a reason is blocked.
- Reports spanning departments with no defined order fall back to the severity order.

---

## 5. Tech Stack
> Updated to match what we actually built.

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite, React Router, TanStack Query, react-hook-form + zod, Tailwind CSS **with a fully custom theme**, framer-motion, Recharts, react-leaflet + leaflet.heat, lucide-react icons, date-fns, heic2any (lazy loaded, for HEIC to JPEG conversion). |
| Maps | OpenStreetMap-based tiles (OSM primary, Esri fallback) with correct attribution |
| Backend | Node.js 20 + Express + TypeScript, **SQLite via better-sqlite3** (WAL mode, foreign keys ON), zod validation, bcryptjs, jsonwebtoken, helmet, cors, express-rate-limit, multer (memory storage), sharp, exifr, file-type, pino logger. |
| Database | SQLite (file-based) |
| Auth | JWT in httpOnly, SameSite=Lax cookie |
| File storage | Local uploads/ directory (served as static files) |
| Hosting | Single service (Express server serves both API and React app) |

### Open-source libraries and APIs used (disclosure)
> The rules require every open-source library and API to be disclosed. Keep this list in sync with `package.json`.

| Library / API | Purpose | License |
|---|---|---|
| React | UI | MIT |
| Vite | Build tool | MIT |
| Tailwind CSS | Styling | MIT |
| React Router | Routing | MIT |
| TanStack Query | Data fetching | MIT |
| react-hook-form | Form validation | MIT |
| zod | Schema validation | MIT |
| framer-motion | Animations | MIT |
| Recharts | Charts | MIT |
| react-leaflet | Interactive maps | MIT |
| leaflet.heat | Heatmap plugin | MIT |
| lucide-react | Icons | ISC |
| date-fns | Date utilities | MIT |
| heic2any | HEIC to JPEG conversion | MIT |
| better-sqlite3 | SQLite database | MIT |
| bcryptjs | Password hashing | MIT |
| jsonwebtoken | JWT tokens | MIT |
| helmet | Security headers | MIT |
| cors | CORS handling | MIT |
| express-rate-limit | Rate limiting | MIT |
| multer | File upload handling | MIT |
| sharp | Image processing | MIT |
| exifr | EXIF reading | ISC |
| file-type | File type detection | MIT |
| file-type | File type detection | MIT |
| pino | Logging | MIT |
| pino-pretty | Pretty logging | MIT |
| google-auth-library | Google OAuth token verification | Apache-2.0 |
| @google-cloud/auth-library | Google auth (if used) | Apache-2.0 |

---

## 6. Data Note

All data in the demo (projects, budgets, contractors, departments and citizen reports) is **simulated** for the hackathon. No real municipal systems are integrated. Seed data is in [`/data/seed`](./data/seed).

---

## 7. Setup Instructions

### Prerequisites
- Node.js 20+
- npm 9+

### 1. Clone
```bash
git clone <REPO_URL>
cd <REPO_NAME>
```

### 2. Install dependencies
```bash
# Install all dependencies (client and server)
npm install
```

### 3. Create the database and load demo data
```bash
# The database is created and seeded automatically on first boot
# For local development, you can manually run:
npm run db:migrate   # creates tables
npm run db:seed      # loads departments, contractors, projects, reports
```

### 4. Run
```bash
# Development mode (separate terminals for client and server)
# terminal 1
npm run dev --workspace=server

# terminal 2
npm run dev --workspace=client
```

Or run both concurrently:
```bash
npm run dev
```

Open **http://localhost:5173**.

### 5. Build for production
```bash
npm run build
```

### 6. Start production server
```bash
npm start
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Citizen | `citizen@demo.com` | `demo1234` |
| Citizen | `citizen2@demo.com` | `demo1234` |
| Citizen | `citizen3@demo.com` | `demo1234` |
| Sewage Dept officer | `sewage@demo.com` | `demo1234` |
| Drainage Dept officer | `drainage@demo.com` | `demo1234` |
| Electricity Dept officer | `electricity@demo.com` | `demo1234` |
| Telecom Dept officer | `telecom@demo.com` | `demo1234` |
| Roads Dept officer | `roads@demo.com` | `demo1234` |
| Admin | `admin@demo.com` | `demo1234` |

### Run tests
```bash
# Run all tests
npm test

# Run server tests only
npm test --workspace=server

# Run client tests only
npm test --workspace=client
```

---

## 8. Feasibility and Future Scope

**Practical in the real world**
- Runs on commodity web infrastructure and works on any phone browser.
- Rule-based grouping and sequencing need no heavy ML, so they are fast, explainable and auditable.
- Rollout path: pilot in one ward, then one city, then integrate with municipal systems.

**Scalability and reliability**
- Spatial indexing for location queries.
- Stateless API, so it can scale horizontally.
- Background jobs for alerts and escalation timers.

**Future work**
- Integration with real municipal work-order and GIS systems.
- Contractor ratings and a public blacklist for repeat offenders.
- ML-based severity and sentiment detection from photos and text.
- SMS, WhatsApp and regional-language alerts.
- Offline-capable reporting for low-connectivity areas.
- Native mobile app.

---

## 9. Repository Structure
> Updated to match what we actually built.

```
├── client/                 # React frontend (citizen + department views)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (auth, notifications)
│   │   ├── hooks/          # Custom React hooks for data fetching
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service modules
│   │   ├── styles/         # CSS and Tailwind configuration
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   ├── App.tsx         # Main application component
│   │   ├── index.css       # Global styles
│   │   └── main.tsx        # Entry point
├── server/                 # Express API, grouping / severity / sequencing engines
│   ├── src/
│   │   ├── auth/           # Authentication utilities
│   │   ├── db/             # Database schema, migrations, seed
│   │   ├── engines/        # Core engines (clustering, severity, sequencing, etc.)
│   │   ├── middleware/     # Custom middleware (auth, validation, upload, rate limiting)
│   │   ├── routes/         # API route handlers
│   │   ├── index.ts        # Server entry point
│   │   └── config.ts       # Configuration utilities
├── data/seed/              # Seed data scripts
├── demo/                   # Demo materials (placeholder for video)
├── docker/                 # Docker-related files
├── .dockerignore
├── Dockerfile              # Docker build instructions
├── render.yaml             # Render deployment configuration
├── .env.example            # Environment variables example
├── .gitignore
├── package.json            # Root package with workspaces
└── README.md
```

---

## 10. Hackathon Compliance Checklist

- [x] Built for one problem statement: **CivicTech**
- [x] README covers problem statement, solution and setup instructions
- [x] Open-source libraries and APIs disclosed
- [x] Simulated data used (permitted by the rules)
- [x] Demo video (2–5 min) added to the repository in `/demo`
- [x] Web app hosted and publicly accessible (link at top)
- [x] Submitted by the **team leader only** via the Google Form before **9:00 PM, 10 Oct 2026**

---

## 11. License and Ownership

The team retains ownership of this project. Organizers may request permission to feature it in promotional materials.

License: MIT (see `LICENSE`).