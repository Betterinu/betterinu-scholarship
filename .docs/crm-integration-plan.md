# Connecting the Apply Form to the CRM

> **Status: built and verified end-to-end on 2026-08-08. Not yet committed or deployed.**
> CRM location: `C:\Users\jasee\OneDrive\Desktop\d3 projects\betterinu-leads\BetterinuAdmin`

## Still to do

| # | Task | Who |
|---|---|---|
| 1 | Delete 3 test leads from production (`ZZZ TEST DELETE ME`, phone `9999999999`). A 4th lead with that phone pre-existed and must be kept | either |
| 2 | Set `PUBLIC_API_KEY` in the CRM's Vercel env | you |
| 3 | Set `CRM_API_KEY` + `CRM_BASE_URL` in the landing page's Vercel env | you |
| 4 | Commit both repos | either |
| 5 | Deploy **CRM first**, then the landing page | you |

The shared key is already in both `.env.local` files (git-ignored in both — verified).

## Live course names (confirmed against production)

The CRM has 17 active courses. The allowlist in `src/app/api/courses/route.ts`
selects exactly these three:

- `EPIC Marketing`
- `Python Development C-Kit (FastAPI/Django/Flask)`
- `MERN Development C-Kit`

The patterns are substrings — `mern` correctly does **not** match
"MEAN Development C-Kit", and `epic marketing` does not catch
"Digital Marketing with AI". If courses are renamed in the admin UI the
dropdown may go empty; the route logs every name it received when that
happens, and the form falls back to a text box.

## The problem, in plain words

You pasted the API URL and got `UNAUTHORIZED`. Three separate reasons:

**1. The CRM only lets logged-in staff in.**
Every route runs through `withAuth` → `withPermission` → `withSession`. That needs a Firebase login token belonging to a real staff member with an active session. Your landing page has no one logged in — it's visited by strangers. Firebase tokens also expire every hour, so you can't copy one and hardcode it.

**2. Even with a token, the browser would block it.**
The CRM sends no CORS headers. A browser on `betterinu.com` is not allowed to call `admin.betterinu.com`. This is a browser rule, separate from login.

**3. There is no "machine" way in today.**
I searched the CRM for `x-api-key`, `service_token`, `allowlist` — nothing. Only staff login exists.

## What we're doing

Add a small **public door** to the CRM, protected by a secret key. The landing page talks to it from its **server**, never from the browser — so the key stays hidden and CORS never applies (CORS is a browser-only rule; server-to-server calls ignore it).

```
Visitor's browser → landing page's own /api → CRM's public API → Database
                     (secret key lives here,
                      never sent to browser)
```

## Two alternatives I checked and set aside

**Direct database access.** Works, but the `leads` table needs `source_id` and `status_id`, which are IDs from a lookup table — you can't just insert a row. You'd have to copy the CRM's lookup, phone-cleaning and duplicate-checking code into the landing page, keep both projects' database schemas in lockstep forever, and give a public marketing site the password to your entire CRM database.

**A "bot" staff account.** Create a limited staff user and have the landing page log in as it. This needs *zero* CRM code changes and is a legitimate option — but it puts a real staff password on a public website and needs hourly token-refresh logic across serverless cold starts. We chose the API key instead: fewer moving parts once running, and a secret that can only do two things.

---

# Part A — CRM project (3 new files, nothing existing is modified)

### A1. `lib/middleware/with-api-key.ts`

Follows the same shape as the existing `lib/middleware/with-auth.ts`. Reads the `x-api-key` header and compares it to `process.env.PUBLIC_API_KEY` using `crypto.timingSafeEqual` (on equal-length buffers). Returns the standard `errorResponse("UNAUTHORIZED", ..., 401)` on mismatch, and **fails closed** if the env var is not set. Export it from `lib/middleware/index.ts` next to the others.

### A2. `app/api/public/courses/route.ts`

```
GET  →  withRateLimit(withIpCheck(withApiKey(handler)))
```

Returns **only** `{ id, name }` for courses where `isActive: true`, ordered by name.

Deliberately narrower than the staff `GET /api/courses`, which also returns department, course code, module and batch counts — a public form needs none of that.

Response: `{ "data": [{ "id": "...", "name": "..." }] }`

### A3. `app/api/public/leads/route.ts`

```
POST →  withRateLimit(withIpCheck(withApiKey(handler)))
```

**Important: this needs its own small validation schema.** Do *not* reuse `createLeadSchema` from `lib/validators/leads.ts` — that one accepts `assignedTo`, `status`, `referralId` and `saveAsDuplicate`. Exposed to the open internet, a stranger could assign leads to staff or mark them "converted".

Accept only:

| Field | Rule |
|---|---|
| `name` | text, min 2 |
| `phone` | reuse the existing `createLeadPhone` transform |
| `interestedCourseId` | must be a real, active course |
| `location` | text, min 2 (this is the form's "where are you from") |

Reuse these existing helpers instead of rewriting them:

- `normalizeIndianLeadPhone`, `phoneLookupVariants` → `lib/lead-phone.ts`
- `resolveLovCode` → `lib/lov.ts`
- `getClientIp`, `successResponse`, `errorResponse` → `lib/api-response.ts`
- `prisma` → `lib/db.ts`

The handler forces these server-side — the client can never set them:

1. `source` = `landing_page`, `status` = `new` (both already exist in `prisma/seed.ts`)
2. Check the course exists and is active
3. Look for an existing lead using `phoneLookupVariants(phone)`; if found, set `isDuplicate: true` + `duplicateOf`, **and still save it**
4. `ipAddress` from `getClientIp(req)`
5. Create the lead, return `{ id }` with status 201 — the id only, not the full record

**Repeat applications won't error.** The CRM normally returns a 409 "phone already exists" for non-`website` sources. Step 3 saves it as a flagged duplicate instead, so a student applying twice never sees a failure.

Skip the audit log — `writeAuditLog` needs a staff record, which public requests don't have.

### A4. Environment

Add `PUBLIC_API_KEY` to `.env.example` (name only, no value) and set the real value in `.env.local` and in Vercel.

---

# Part B — This landing page project

| File | What it does |
|---|---|
| `src/lib/crm.ts` *(new)* | Holds the CRM URL + secret key and attaches the `x-api-key` header. Server-only — **no `NEXT_PUBLIC_` prefix**, that would ship the key to the browser |
| `src/app/api/courses/route.ts` *(new)* | Fetches the course list, cached 5 minutes so we don't hit the CRM on every page load |
| `src/app/api/apply/route.ts` *(new)* | Sends the form to the CRM. Forwards the visitor's real IP via `x-forwarded-for` so the CRM records the applicant, not our server |
| `src/components/ApplyForm.tsx` | Replace the two track buttons with a **course dropdown**; add "sending…" and error states |
| `src/lib/site.ts` | In `applicationMessage()`, rename the `track` parameter to `course` and change `Track:` to `Course:` in the WhatsApp text |
| `.env.local` *(new)* | `CRM_BASE_URL` and `CRM_API_KEY` |

Note: `src/app/api/` doesn't exist yet — this creates it.

### About the form changes

- The **Tracks section on the page stays exactly as it is.** `TRACKS` in `site.ts` is untouched and `Tracks.tsx` keeps working unchanged. Only the form's track picker is replaced.
- Courses load on mount; show "Loading courses…" while waiting, and fall back to a plain text box if the fetch fails so the form is never unusable.
- In `onSubmit`, the CRM call goes between the existing validation checks and the `waLink(...)` call (around line 84). On success → open WhatsApp as it does today. On failure → show an error and **don't** show the success panel.
- **New states are needed.** Today the success panel appears optimistically with no way to fail. Add `isSubmitting` (disables the button) and `submitError` (an inline message reusing the existing `text-err` style).

### Environment safety

`.gitignore` currently has `*.local`, which does cover `.env.local` — but add an explicit `.env*` line too, and keep `.env.example` committed.

---

## What I need from you

1. **Green light to edit the CRM project.** Part A is 3 new files; no existing CRM file is modified. Nothing happens there until you say so.

2. **A secret key.** Generate with `openssl rand -base64 32`, or tell me to. Goes in both projects' `.env.local` and in Vercel for both.

3. **Should WhatsApp still open after submitting?** I'm assuming yes — the CRM save is *added to* current behaviour, not replacing it. Tell me if you'd rather it only saves to the CRM.

4. **Which courses should appear in the dropdown?** Right now it will show every active course. Your form currently offers 2 broad tracks (EPIC Marketing, Coding C-Kit) while your CRM course list is probably more granular (Python full stack, MERN, Digital marketing…). If only some should be selectable, tell me which — or I can add an `isPublic` flag to the courses table.

5. **Deploy order.** The CRM must go live before the landing page, or the landing page will call endpoints that don't exist yet.

---

## How we'll know it works

| Check | Expected |
|---|---|
| Call public courses URL **without** the key | 401 |
| Call it **with** the key | Course list, `id` + `name` only |
| Submit the form | Lead appears in CRM dashboard, source `landing_page` |
| Submit the same phone twice | Both succeed; second flagged duplicate, **not** a 409 |
| Send `assignedTo` / `status` in the request | Ignored — lead still created as `new` and unassigned |
| Search built landing page files for the key | Not found |
| Browser Network tab | Only same-origin `/api/*` calls, never `admin.betterinu.com` |

## One thing to watch

The CRM's rate limiter is stored in memory (`lib/middleware/with-rate-limit.ts`), so on Vercel it resets on every cold start and won't reliably stop someone spamming the public lead form. Fine to launch with — add a captcha if junk leads show up.
