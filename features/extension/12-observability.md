# Feature 12: Observability — Sentry SaaS + Structured Logging

**Status:** Design ratified
**Phase:** Hardening prerequisite — must ship before `features/extension/13-backend-hardening.md`
**Parallelizable with:** `features/extension/16-home-vs-markets-split.md`, `features/extension/17-market-creation-validation.md`, `features/extension/18-dummy-data-removal.md`
**Branch:** `feature/observability` → multiple sub-PRs (see `issues/12.*.md`)
**Execution items:** `issues/12.1-sentry-account-setup.md`, `issues/12.2-backend-observability-foundation.md`, `issues/12.3-backend-user-context.md`, `issues/12.4-frontend-observability-foundation.md`

---

## Summary

Stand up server-side error capture and correlation logging *before* sanitizing any user-facing error messages (doc 13). Sentry SaaS is the captured destination; structured JSON logging is the local/Vercel-native fallback. The two are joined by per-request context (`request_id`, `user_id`) propagated via FastAPI middleware and a Next.js `Sentry.setUser` hook on auth-state change.

This is design rationale only. Concrete code blocks, env-var values, and verification commands live in the four `issues/12.*.md` execution items.

---

## Why this ships before doc 13

Doc 13 will replace patterns like:

```python
raise HTTPException(status_code=500, detail=f"Failed to propose resolution: {e}")
```

with sanitized `AppError` raises that carry only a safe message to the user. **Once that lands, the only remaining place to read the raw exception is the server.** If Sentry isn't already capturing it, sanitization actively destroys debugging signal — production debugging becomes guessing. Order matters: **capture, then sanitize.**

This ordering is non-negotiable. Doc 13 imports the helpers defined here (`report_and_safe_message`, `RequestContextMiddleware`, the request/user `ContextVar`s).

---

## Architecture Overview

```
┌──────────────────┐        ┌─────────────────────┐
│  Next.js          │──────▶│ Sentry SaaS          │
│  (Vercel)         │ wss   │ org: bananagains     │
│                   │       │                      │
│  @sentry/nextjs   │       │ ┌──────────────────┐ │
│  - browser SDK    │       │ │ project:         │ │
│  - server SDK     │       │ │  bananagains-    │ │
│  - edge SDK       │       │ │  frontend        │ │
│  - source maps    │──────▶│ └──────────────────┘ │
└──────────────────┘ upload │                      │
                            │ ┌──────────────────┐ │
┌──────────────────┐        │ │ project:         │ │
│  FastAPI          │──────▶│ │  bananagains-    │ │
│  (Vercel today;   │ https │ │  backend         │ │
│   Fly.io after    │       │ └──────────────────┘ │
│   feature 11)     │       │                      │
│                   │       │ envs: production,    │
│  sentry-sdk[      │       │       development    │
│   fastapi]        │       │                      │
│  + JSON logger    │       │ release tag = git    │
│  + request ctx    │       │       short SHA      │
└──────────────────┘        └─────────────────────┘
```

### Key design decisions

- **One org, two projects.** Frontend and backend are separate projects so issue counts, alert routing, and quotas track independently. Cross-boundary errors (a 500 from the API surfaced in the UI) appear in *both* projects, linked by `request_id`.
- **Two environments to start: `production` and `development`.** Filter alerts on `production` only.
- **Release identifier = git short SHA**, set automatically from `VERCEL_GIT_COMMIT_SHA` (frontend; backend on Vercel today) and a `Dockerfile` `ARG GIT_SHA` (backend after feature 11). Source maps are uploaded against the same release ID so frontend stack traces deminify automatically.
- **Sample rates start conservative:** 100% errors (always capture), 10% performance traces. Raise traces sample once cost is known.
- **PII scrubbing is opt-in per route.** Defaults are aggressive (strip `Authorization` headers, JWTs, `andrew_id`s). Admin routes can capture more contextual extras (e.g., `market_id` of an admin-resolve action) without PII risk — see §"PII Scrubbing" below.
- **Sentry SDK no-ops when `SENTRY_DSN` is unset.** Local dev runs without Sentry by default — no events, no network calls.
- **Send `user.id` (UUID), never `andrew_id`.** UUID is internal and stable; `andrew_id` is a CMU-domain identifier that's borderline PII and harder to scrub from logs after the fact. Cross-referencing UUID → `andrew_id` stays in Supabase, accessible only to admins.

---

## Module Shape

### `backend/observability.py` (new)

Centralizes Sentry init, JSON logging, and the split-brain helper. Routers and tests must never import `sentry_sdk` directly — they go through this module.

Public surface (signatures only; full implementation in `issues/12.2`):

```python
def init_observability() -> None:
    """Initialize Sentry + structured logging. Call once at app startup.
    Safe to call when SENTRY_DSN is unset — Sentry SDK simply no-ops."""

def begin_request(request_id: str | None = None) -> str:
    """Set a fresh request_id for this request. Returns the id."""

def set_user_context(user_id: str | None) -> None:
    """Tag the current request with an authenticated user UUID."""

def clear_user_context() -> None: ...

def report_and_safe_message(
    exc: BaseException,
    user_message: str,
    *,
    level: str = "error",
    extras: dict[str, Any] | None = None,
) -> str:
    """Capture exc to Sentry with full context, return only the safe user_message.

    Use in routers' except blocks:

        except SomeError as exc:
            raise HTTPException(
                500,
                detail=report_and_safe_message(exc, "Failed to do thing"),
            ) from exc

    Replaces the f"Failed: {exc}" pattern that leaks SQL/RPC text.
    """
```

Two private `ContextVar`s — `_request_id` and `_user_id` — are populated by the middleware and consumed by the JSON log formatter and Sentry's `before_send` hook.

The module is the **single point of import** for Sentry concerns. Doc 13 builds `AppError` on top of this module's `report_and_safe_message`.

### `backend/middleware/request_context.py` (new)

A Starlette `BaseHTTPMiddleware` that:

1. Reads or generates a `request_id` (header `x-request-id` if present, else `uuid.uuid4().hex`).
2. Sets it in the `_request_id` `ContextVar` via `begin_request`.
3. Returns the response with `x-request-id` echoed in the response header (so the frontend can attach it to its own Sentry events).
4. In `finally`, clears the `_user_id` context to avoid leakage across requests.

**Mounted outermost** in `backend/main.py` so it wraps CORS and all routers.

### `backend/dependencies.py` (modified)

Two-line addition: after `_resolve_user` returns a profile in `get_current_user` and `get_current_user_optional`, call `set_user_context(profile["id"])`. This is what populates Sentry's `user.id` field for every authenticated request.

### Frontend — three SDK config files + instrumentation

Generated by `npx @sentry/wizard@latest -i nextjs` (run once, then committed):

- `sentry.client.config.ts` — browser SDK init.
- `sentry.server.config.ts` — Next.js server runtime (Server Components, route handlers).
- `sentry.edge.config.ts` — Edge runtime (some middleware).
- `instrumentation.ts` — Next.js 16 hook that wires server/edge configs.

All three SDK configs share the same key choices: `sendDefaultPii: false`, `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0`, and a `beforeSend` that strips any leaked `andrew_id` from `event.user`.

### `frontend/src/lib/SessionProvider.tsx` (modified)

Inside the existing `onAuthStateChange` callback, call `Sentry.setUser({ id: session.user.id })` on sign-in and `Sentry.setUser(null)` on sign-out. UUID only — never `andrew_id` or email.

### `frontend/next.config.ts` (modified)

Wrap the existing default export with `withSentryConfig(nextConfig, { org, project, silent, widenClientFileUpload: true, hideSourceMaps: true, disableLogger: true })`. Source maps upload to Sentry on every Vercel build via the Sentry-Vercel integration installed in `issues/12.1`.

---

## The Split-Brain Rule (foundation for doc 13)

`report_and_safe_message` codifies a single pattern that doc 13 will mechanically apply to every router:

```python
except SomeError as exc:
    raise HTTPException(
        status_code=409,
        detail=report_and_safe_message(
            exc,
            "Bet failed.",
            extras={"market_id": market_id, "side": body.side},
        ),
    ) from exc
```

Net effect:

- **User sees:** `{"detail": "Bet failed."}` — no SQL, no RPC name, no schema hints.
- **Sentry sees:** Full traceback + `extras.market_id` + `extras.side` + the `user.id` from the request context.
- **Log line sees:** structured JSON with `request_id`, `user_id`, exception, route — searchable in Vercel/Fly logs by `request_id`.

The user can copy the `x-request-id` response header into a support ticket; you grep Sentry or logs by that ID and find the full context.

Doc 13 layers an `AppError` exception class on top of this primitive (adds a stable `code` field and an envelope shape), but the underlying capture mechanism is here.

---

## PII Scrubbing — Calibrated to the Auth Matrix

The matrix tells us which routes carry which kind of data; the scrubbers below are tuned accordingly.

### Always scrub (every project, every route)

| Field | Where it appears | How it's scrubbed |
|---|---|---|
| `Authorization: Bearer …` | Request headers | `_before_send` in `observability.py` (overrides Sentry's default); `sendDefaultPii: false` for cookies |
| Supabase service-role key | Backend env / RPC errors | Never logged; Pydantic settings already keep it out of `repr` |
| `andrew_id` | Profile rows; sometimes in error context | `_before_send` strips from `event.extra`; frontend `beforeSend` strips from `event.user` |
| Raw passwords / OTPs | n/a (Supabase Auth handles), sanity-checked | `sendDefaultPii: false` strips form bodies by default |

### Capture-by-default (useful for triage, low PII risk)

| Field | Why capture | Notes |
|---|---|---|
| `user.id` (UUID) | Required to ask "which user hit this?" without joining DB | Set via `set_user_context` (backend) and `Sentry.setUser` (frontend) |
| `request_id` (UUID) | Correlates frontend error → backend error → log line | Set via `RequestContextMiddleware` |
| Route / endpoint name | Required to group issues | Auto-populated by FastAPI/Next.js integrations |
| Market UUIDs in error metadata | Needed to reproduce `pending_resolution` / `disputed` state bugs | Pass via `extras={"market_id": …}` in `report_and_safe_message` |

### Scrub-when-uncertain (default off, opt in per route)

| Field | Default | Opt-in mechanism |
|---|---|---|
| Bet amounts | Off — not PII but team-sensitive in aggregate | `extras={"bet_amount": amount}` only on `bets.py` paths |
| Display names | Off — could be real names | Never auto-include; if needed for triage, look up from `user.id` |

The matrix's §10 cross-reference confirms: admin routes (where the user is staff) can capture more contextual extras without PII risk.

---

## Files Affected

| Area | File | Status |
|---|---|---|
| Backend | `backend/observability.py` | NEW |
| Backend | `backend/middleware/request_context.py` | NEW |
| Backend | `backend/middleware/__init__.py` | NEW (package marker) |
| Backend | `backend/main.py` | MODIFY — call `init_observability()`; mount `RequestContextMiddleware` outermost |
| Backend | `backend/config.py` | MODIFY — add `sentry_dsn`, `sentry_environment`, `sentry_release`, `sentry_traces_sample_rate` |
| Backend | `backend/dependencies.py` | MODIFY — `set_user_context(profile["id"])` after auth |
| Backend | `backend/requirements.txt` | MODIFY — add `sentry-sdk[fastapi]>=2.18.0`, `python-json-logger>=2.0.7` |
| Backend | `backend/.env.example` | MODIFY — add Sentry env var template |
| Frontend | `frontend/sentry.client.config.ts` | NEW |
| Frontend | `frontend/sentry.server.config.ts` | NEW |
| Frontend | `frontend/sentry.edge.config.ts` | NEW |
| Frontend | `frontend/instrumentation.ts` | NEW |
| Frontend | `frontend/next.config.ts` | MODIFY — wrap with `withSentryConfig` |
| Frontend | `frontend/src/lib/SessionProvider.tsx` | MODIFY — `Sentry.setUser({id})` on auth change |
| Frontend | `frontend/package.json` | MODIFY — add `@sentry/nextjs` |
| Docs | `README.md` | MODIFY — add Sentry section to setup + deployment notes |

---

## Execution

This design is implemented across four PRs. See the linked issues for scope, acceptance criteria, and verification steps:

| Issue | Title | Depends on |
|---|---|---|
| `issues/12.1-sentry-account-setup.md` | Sentry SaaS console: org, projects, environments, alerts, Vercel integration. | — |
| `issues/12.2-backend-observability-foundation.md` | `observability.py`, request-context middleware, `main.py` wiring, `requirements.txt`, `config.py` settings. | 12.1 (DSN required for smoke test) |
| `issues/12.3-backend-user-context.md` | `dependencies.py`: `set_user_context` after auth resolution. | 12.2 |
| `issues/12.4-frontend-observability-foundation.md` | `@sentry/nextjs` install + wizard config + `next.config.ts` wrap + `SessionProvider.tsx` user tag. | 12.1 (DSN required) |

12.2 and 12.4 can run in parallel after 12.1 lands. 12.3 must follow 12.2.

---

## Forward Compatibility with Feature 11

When the backend migrates from Vercel to Fly.io (`features/extension/11-redis-websockets.md`), the only change is where the env vars come from:

- `VERCEL_GIT_COMMIT_SHA` → Dockerfile `ARG GIT_SHA` + `fly deploy --build-arg GIT_SHA=$(git rev-parse --short HEAD)`.
- `vercel env` → `fly secrets set`.

No code changes at the SDK layer. The `RequestContextMiddleware`, `observability.py`, and all router-level Sentry usage are deployment-target-agnostic.

---

## Cross-References

| Doc | Reads from this doc to … |
|---|---|
| `project-specs/AUTHZ_MATRIX.md` | Cited in §"PII Scrubbing": admin routes can capture more extras safely; user routes scrub more. |
| `features/extension/13-backend-hardening.md` | Imports `report_and_safe_message`, `set_user_context`, `RequestContextMiddleware`, and the request/user `ContextVar`s. `AppError` is built on top of this module. **This doc is its rigid prerequisite.** |
| `features/extension/14-api-contract-tests.md` | Tests assert the safe user-facing message (e.g., `"Bet failed."`), independent of the Sentry-captured exception text. The split is what makes both layers testable. |
| `features/extension/15-playwright-ui-tests.md` | Asserts visible error toasts contain only allow-listed strings; pairs with Sentry capture to ensure the real error wasn't lost. |
| `features/extension/11-redis-websockets.md` | Backend deploy notes here will be repointed at Fly.io once feature 11 lands. SDK code is identical. |
