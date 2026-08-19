# iam-service — flat, TMF-API-name-per-folder structure

Rebuilt per feedback: **no more grouping by the old monolith's Postman
folders, and no shared `core/` reused between endpoints.** Every API from
the "Identity and Access Management" sheet in
`Omni-Channel-API-Mapping-By-Service.xlsx` now gets its own **standalone**
folder directly under `src/`, named after its **Proposed TMF-Aligned Method
Name**:

```
src/<tmfApiName>/
    controller.js   # thin HTTP adapter (req/res only)
    service.js       # business logic for THIS api only, self-contained
    routes.js        # express.Router() for just this one endpoint
```

Example: row #1 `createRegister` → `src/createRegister/{controller.js, service.js, routes.js}`.

`src/routes/index.js` scans `src/*/routes.js` (skipping the infra folders
`config`, `middleware`, `models`, `routes`, `utils`) and auto-mounts every
API it finds under `/internal-api/iam/v1` in `src/app.js`. Adding a new API
is just adding a new `src/<tmfApiName>/` folder — nothing to register by
hand.

## What changed from the previous version

- Removed `src/modules/<postman-folder>/<api>/` nesting entirely.
- Removed `src/core/authCore.js` and `src/core/userCore.js`. The 10 APIs
  that had real production logic now have that logic written **directly and
  independently inside their own `service.js`** — nothing is imported from a
  shared "old monolith" module anymore.
- Kept `src/config`, `src/middleware`, `src/models`, `src/utils` as-is —
  these are genuine shared infrastructure (DB connection, JWT/OTP helpers,
  the response envelope, the Mongoose models), not business-logic modules,
  so they stay shared rather than being duplicated 69 times.

## Folder naming (TMF name is not always unique)

69 rows map to only 55 unique TMF names — 9 names repeat across 2–4 legacy
endpoints (e.g. `createLogin` covers Account/VAS/ISP SOA/ISP Direct's login
endpoints). Since folder names must be unique, a duplicated TMF name is
suffixed with its legacy controller (and, where even that repeats, the
legacy API name too) — e.g. `createLogin-account`, `createLogin-vas`,
`createOTPRequest-verify-sendotprequest`. The TMF name itself is never
altered — only the folder path gets the disambiguating suffix, and it's
recorded in a header comment on all 3 files.

## Real logic vs. scaffolds

**10 endpoints** (`createRegister`, `createLogin-account`, `deleteUser`,
`createRefresh`, `createOTPVerification`, `patchPassword`,
`createOTP-account`, `createProtectedResource-account`,
`createForgotPassword`, `createLoginExternalFBGoogle`) carry the real,
working logic ported from the uploaded codebase, written inline in each
one's own `service.js`.

**The other 59 are scaffolds** — controller/service/routes all correctly
wired and mounted, `service.js` throws a clear `501` with a `// TODO`
marking exactly where to add real logic. The sheet gives no request/response
schema for these, so implementing them for real needs that spec.

## Assumptions (please confirm)

- **Route paths**: the sheet has no path column. The 10 real endpoints keep
  their actual current production paths (e.g. `/auth/login`). All 59
  scaffolds use `/<folderName>` as a placeholder (e.g.
  `/createOTPRequest-verify-sendotprequest`) — replace with the real path
  before use.
- **Auth guard**: `identify` middleware applied when the TMF name contains
  `terminate`, `change`, `protected`, `update`, or `delete` (plus the 3
  known-real protected ones). Adjust per-route as needed.
- Rows #200/#253 had a raw URL as their "API name" — folder names use
  `createHttp17225371148085Authenticate-isp-soa` / `-isp-direct`.

## Verified

- `node --check` passes on every generated file.
- The app boots (without a live DB) and mounts **all 69 API routes + /health**
  with **zero path collisions**.
