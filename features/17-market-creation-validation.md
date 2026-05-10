# Feature 17: Market Creation Validation — Stricter Limits + Field-Level Error Display

**Status:** Design ratified
**Phase:** UX hardening
**Depends on:** `features/13-backend-hardening.md` (uses the envelope's `errors[]` field for `VALIDATION_FAILED` cases — the `parseApiError` helper exposes them as `fieldErrors`)
**Parallelizable with:** `features/12-observability.md`, `features/16-home-vs-markets-split.md`, `features/18-dummy-data-removal.md`
**Reads from:** `project-specs/AUTHZ_MATRIX.md` §5 (`/markets/create`), §7b (`POST /api/markets`)
**Branch:** `feature/market-creation-validation` → 2 sub-PRs (see `issues/17.*.md`)
**Execution items:** `issues/17.1-backend-tightened-validators.md`, `issues/17.2-frontend-field-errors.md`

---

## Summary

The current market creation validators in `backend/schemas/market.py` are too permissive (description up to 2000 chars, resolution criteria up to 2000 chars, link up to 2048 chars, **no upper bound on `close_at`**). And the current frontend at `frontend/src/app/markets/create/page.tsx` shows a single error toast on validation failure rather than per-field guidance.

This feature tightens the limits to UX-appropriate values, **adds an upper bound on `close_at` (max 6 months in future)**, and wires the new envelope's `errors[]` field into the form so users see "Title is too long" next to the title input instead of a generic toast.

---

## Why tighten

### Current limits and their UX problems

| Field | Current limit | UX problem |
|---|---|---|
| Title | 160 chars | OK — but a 160-char title displays poorly in market cards and listings. |
| Description | 2000 chars | A 2000-char description is a small essay. Markets are at-a-glance; this invites walls of text that hurt comprehension. |
| Resolution criteria | 2000 chars | Same issue — resolution criteria should be **precise**, not exhaustive. |
| Official source | 300 chars | Mostly fine; tighten slightly. |
| Yes/No/Ambiguity criteria | 1000 chars each | If the resolution criteria is well-written, these add nuance — they shouldn't double the spec. |
| Link | 2048 chars | URLs that long are vanishingly rare and almost always indicate a tracking-blob abuse. |
| **`close_at`** | **No upper bound** | A user can create a market that resolves in 2099. The market becomes dead weight in listings. |
| **`close_at`** | **Lower bound: anything in the future** | A market closing in 5 minutes leaves no time for participants to bet meaningfully. |

### New limits

| Field | Old | New | Rationale |
|---|---|---|---|
| Title | 160 | **120** | Fits cleanly in 1 line of a card; still substantial. |
| Description | 2000 | **800** | Encourages tight writing; still room for a paragraph or two. |
| Resolution criteria | 2000 | **800** | Same — precision over verbosity. |
| Official source | 300 | **200** | URLs and short attributions; rarely longer. |
| Yes/No/Ambiguity criteria | 1000 each | **400 each** | Add nuance, don't re-spec the resolution. |
| Link | 2048 | **500** | Generous; catches almost all real URLs. |
| **`close_at`** lower | "future" only | **at least 1 hour from now** | Prevents drive-by markets that close before anyone notices. |
| **`close_at`** upper | (none) | **at most 6 months from now** | Keeps listings fresh; long-horizon questions can be re-listed if still relevant. |
| Multichoice options count | 2–10 (existing) | unchanged | Already correct. |
| Multichoice option label | 80 (existing) | unchanged | Already correct. |
| Review notes (admin-side, `ReviewMarketRequest.notes`) | 1000 (existing) | unchanged | Admin-facing; current limit is fine. |

All numeric tightenings are conservative — well within typical market-text patterns. The `close_at` bounds are the most consequential change because they're new behavior, not just a tightened number.

---

## The Envelope's `errors[]` Field — Frontend Integration

Doc 13 §1d defined the validation envelope shape:

```json
{
  "detail": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed.",
    "errors": [
      {"field": "title", "message": "Title must be 120 characters or fewer", "type": "value_error"},
      {"field": "close_at", "message": "close_at must be no more than 6 months in the future", "type": "value_error"}
    ]
  }
}
```

Doc 13's `parseApiError` already exposes this as `fieldErrors`:

```ts
const { code, message, fieldErrors } = parseApiError(err, "Failed to create market.");
if (code === "VALIDATION_FAILED") {
  // map fieldErrors[] to per-input error state
  const errorByField = Object.fromEntries(fieldErrors.map(e => [e.field, e.message]));
  setTitleError(errorByField.title);
  setDescriptionError(errorByField.description);
  // ... etc
}
```

The frontend work in 17.2 wires this through every input on the create-market form. If `errorByField[<input>]` is set, render it inline below the input (red text). Otherwise leave the input's error slot empty.

---

## Backend Changes (17.1)

### `backend/schemas/market.py`

Update the constants:

```python
MAX_MARKET_TITLE_LENGTH = 120                  # was 160
MAX_MARKET_DESCRIPTION_LENGTH = 800            # was 2000
MAX_MARKET_RESOLUTION_LENGTH = 800             # was 2000
MAX_MARKET_OFFICIAL_SOURCE_LENGTH = 200        # was 300
MAX_MARKET_CRITERIA_LENGTH = 400               # was 1000
MAX_MARKET_LINK_LENGTH = 500                   # was 2048
# unchanged:
MAX_MARKET_CATEGORY_LENGTH = 50
MAX_MARKET_OPTION_LENGTH = 80
MAX_MARKET_REVIEW_NOTES_LENGTH = 1000
```

Add `close_at` window:

```python
MIN_CLOSE_AT_DELTA = timedelta(hours=1)         # NEW
MAX_CLOSE_AT_DELTA = timedelta(days=180)        # NEW (~6 months)


@field_validator("close_at")
@classmethod
def close_at_in_window(cls, v: datetime) -> datetime:
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    else:
        v = v.astimezone(timezone.utc)
    now = datetime.now(timezone.utc)
    if v < now + MIN_CLOSE_AT_DELTA:
        raise ValueError("close_at must be at least 1 hour in the future")
    if v > now + MAX_CLOSE_AT_DELTA:
        raise ValueError("close_at must be no more than 6 months in the future")
    return v
```

Replace the existing `close_at_in_future` validator. The existing test `test_create_market_rejects_oversized_title` (and friends) will need value updates to reflect the new limits.

### Behavior

- The Pydantic validator raises `ValueError` per field. FastAPI converts to `RequestValidationError`. Doc 13's `validation_handler` packs them into the envelope `errors[]` array. **No new code in `routers/markets.py`** — the envelope plumbing already exists.

---

## Frontend Changes (17.2)

### `frontend/src/app/markets/create/page.tsx`

- Mirror the new constants at the top of the file (the file already has its own copies — update them to match the backend).
- Add the new `MAX_CLOSE_AT_DAYS = 180` and `MIN_CLOSE_AT_HOURS = 1` constants.
- Date picker: clamp the `max` and `min` attributes of the `<input type="datetime-local">` for `close_at` to the same window. Prevents the user from picking an invalid date in the picker UI itself.
- Add per-field error state and rendering:
  ```tsx
  const [errorsByField, setErrorsByField] = useState<Record<string, string>>({});
  // ... in submit handler catch block:
  const { code, message, fieldErrors } = parseApiError(err, "Failed to create market.");
  if (code === "VALIDATION_FAILED") {
    setErrorsByField(Object.fromEntries(fieldErrors.map(e => [e.field, e.message])));
  } else {
    setSubmitError(message);
  }
  ```
- Render `errorsByField.<fieldname>` (if present) below each input as small red text.

### Visual treatment

- Inline field errors take precedence over the top-of-form generic toast.
- If both a field error and a generic error exist (rare), show field errors per field plus the generic at the top.
- Maintain the existing `maxLength` attributes on inputs (purely cosmetic — server enforces).

---

## Files Affected

| Area | File | Status |
|---|---|---|
| Backend | `backend/schemas/market.py` | MODIFY — tighten `MAX_*` constants; replace `close_at_in_future` with `close_at_in_window`; add `MIN_CLOSE_AT_DELTA` / `MAX_CLOSE_AT_DELTA`. |
| Backend | `backend/tests/test_market_schema_validation.py` | MODIFY — update the limit-related tests to use the new numbers (e.g., 161-char title → 121-char title); add new tests for `close_at < +1h` and `close_at > +180d`. |
| Frontend | `frontend/src/app/markets/create/page.tsx` | MODIFY — update local `MAX_MARKET_*` constants; add `MAX_CLOSE_AT_DAYS` / `MIN_CLOSE_AT_HOURS`; clamp date picker; add per-field error rendering using `parseApiError(...).fieldErrors`. |
| Spec | `project-specs/AUTHZ_MATRIX.md` §7b | MODIFY — add a one-line note under the `POST /api/markets` row documenting the validation envelope shape (or reference doc 17 here). |
| Tests | `frontend/e2e/error-toasts/validation.spec.ts` | MODIFY — un-fixme any placeholder validation tests; add field-error rendering assertions per the new behavior. |

---

## Execution

| Issue | Title | Depends on |
|---|---|---|
| `issues/17.1-backend-tightened-validators.md` | Update Pydantic limits, replace `close_at` validator, add new `close_at` window tests. | doc 13.1 (envelope handler) |
| `issues/17.2-frontend-field-errors.md` | Mirror constants, clamp date picker, add per-field error rendering using `fieldErrors`. | 17.1, doc 13.2 (`parseApiError`), doc 13.6 (frontend error reader migration) |

---

## Cross-References

| Doc | Relationship |
|---|---|
| `features/13-backend-hardening.md` | Uses §1d `validation_handler` (drives the envelope shape) and §1e `parseApiError` (exposes `fieldErrors`). The validation tightening is a no-op on the envelope contract — it adds new `errors[]` entries; the shape is the same. |
| `project-specs/AUTHZ_MATRIX.md` | §7b `POST /api/markets` cell still says `201 / 422`. The 422 cases gain new validation reasons; the cell itself is unchanged. |
| `features/14-api-contract-tests.md` | Add `MATRIX_CELLS` rows for the new validation failures (e.g., a `MatrixCell` with body `{title: "T"*121}` expecting status 422 with `code = "VALIDATION_FAILED"`). |
| `features/15-playwright-ui-tests.md` | 15.4 has a `validation.spec.ts` placeholder; un-fixme and fill in real assertions once 17.2 lands. |
| `features/16-home-vs-markets-split.md` | Independent — touches different files. |
