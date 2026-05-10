# Feature 15: Playwright UI Tests — Page Gating, Control Visibility, Toast Allow-list

**Status:** Design ratified
**Phase:** Hardening verification
**Depends on:** `features/13-backend-hardening.md` (relies on the structured envelope + canonical message catalog), `features/14-api-contract-tests.md` (overlapping fixtures conceptually; Playwright runs its own browser-side fixtures)
**Reads from:** `project-specs/AUTHZ_MATRIX.md` §5 (page redirects), §6 (UI control visibility), `features/13-backend-hardening.md` §4 (toast allow-list)
**Branch:** `feature/playwright-ui-tests` → multiple sub-PRs (see `issues/15.*.md`)
**Execution items:** `issues/15.1-playwright-setup.md`, `issues/15.2-page-redirect-tests.md`, `issues/15.3-control-visibility-tests.md`, `issues/15.4-error-toast-allow-list.md`

---

## Summary

Doc 14 verifies the API contract; doc 15 verifies the **UI contract** — the layer the user actually sees. Three categories of assertion, each tied to a different matrix section:

1. **Page redirects (matrix §5).** For every `(role, route)` cell, sign in as the role and navigate to the route. Assert the page either renders the expected content or redirects to the documented destination — and that there is **no flash** of the protected content before redirect.
2. **UI control visibility (matrix §6).** For each mutating control listed in §6a–§6c, in each role context, assert it's visible / disabled / hidden per the matrix cell.
3. **Error toast allow-list (doc 13 §4).** Force a backend error from the UI, capture the visible toast text, and assert it matches one of the allow-listed user-facing messages from the canonical catalog. **Catches raw `err.message` regressions** that would otherwise leak schema/SQL hints into the UI.

Plus the smaller hygiene checks: every redirect is server-side (no client-side `useEffect` redirects), every link to a protected route is also gated, no JWT or `andrew_id` ever appears in the rendered DOM.

---

## Why Playwright (not Cypress / unit tests)

- **Playwright runs the real browser.** Important because some matrix §5 assertions hinge on Next.js's server-side rendering vs client-side redirect behavior — only a real browser sees the network sequence and DOM correctly.
- **Auth state is straightforward.** Playwright fixtures can carry the Supabase session in `localStorage` + cookies and re-use it across tests in a worker. No re-signing-in for every test.
- **Trace files are gold for debugging** — when a test fails, Playwright saves a full DOM snapshot + network log + screenshot. Reviewer can replay the failure without re-running.

We don't use unit tests for these assertions because the failure mode they catch (a `useEffect` redirect, a forgotten `hidden` className, a leaked `err.message`) often only manifests with full client-side hydration and real network responses.

---

## Test Categories

### 15a. Page redirect tests (matrix §5)

For each row in §5, one test per role:

```ts
test.describe("page gating: /markets/create", () => {
  test("anon → redirects to /auth (no flash of form)", async ({ page }) => {
    await page.goto("/markets/create");
    await expect(page).toHaveURL(/\/auth/);
    // The form must NOT have rendered, even briefly.
    // Assert against the trace, not against an awaited locator.
  });

  test("user → renders the form", async ({ page, signInAs }) => {
    await signInAs("user");
    await page.goto("/markets/create");
    await expect(page).toHaveURL("/markets/create");
    await expect(page.getByLabel("Title")).toBeVisible();
  });
});
```

**No-flash assertion:** the test fails if the protected component appeared at any point in the navigation timeline. This catches client-side `useEffect` redirects (which always flash) but accepts server-side redirects (which navigate before any HTML reaches the browser).

### 15b. UI control visibility tests (matrix §6)

For each control row in §6a/§6b/§6c, parameterized by `role` and any context overlay:

```ts
test("Place Bet button on /markets/[id]", async ({ page, signInAs, seedMarket }) => {
  const m = await seedMarket({ status: "open" });

  await page.goto(`/markets/${m.id}`);
  await expect(page.getByRole("button", { name: "Place Bet" })).not.toBeVisible(); // anon

  await signInAs("user");
  await page.goto(`/markets/${m.id}`);
  await expect(page.getByRole("button", { name: "Place Bet" })).toBeEnabled();

  await signInAs("user", { creatorOf: m.id });
  await page.goto(`/markets/${m.id}`);
  await expect(page.getByRole("button", { name: "Place Bet" })).not.toBeVisible();
});
```

**Test data note:** the `seedMarket` fixture should create rows directly via the test DB connection (or an admin-bypass API), not through the UI. The UI flow itself is what's being tested; setup goes around it.

### 15c. Error toast allow-list tests (doc 13 §4)

For each `ErrorCode` in the catalog that has a user-visible toast path:

```ts
test("BET_INSUFFICIENT_BALANCE toast says 'Not enough bananas.'", async ({ page, signInAs, seedMarket, setBalance }) => {
  await signInAs("user");
  await setBalance(0);
  const m = await seedMarket({ status: "open" });

  await page.goto(`/markets/${m.id}`);
  await page.getByLabel("Amount").fill("10");
  await page.getByRole("button", { name: "Place Bet" }).click();

  await expect(page.getByRole("status")).toHaveText("Not enough bananas.");
  // Negative assertion: no raw schema text leaked
  await expect(page.getByRole("status")).not.toContainText(/SQL|insufficient_balance|HTTPException|Traceback/i);
});
```

The negative assertion is the regression guard — even if a future change accidentally surfaces raw exception text via a missed `parseApiError` call site, this test fails.

### 15d. Hygiene checks

Lightweight cross-cutting assertions:

- **No client-side `useEffect` redirects on protected routes.** Inspect the response HTML for the protected route — if it contains the protected content even once before the redirect, fail.
- **No JWT in DOM.** After signing in, `await page.content()` must not contain a substring matching `/eyJ[a-zA-Z0-9_-]{10,}/` (rough JWT shape). This catches cases where a token gets accidentally serialized into a data attribute or `<script>` payload.
- **No `andrew_id` in error toasts or page content** for non-owner contexts. Catches leaks where a backend response includes another user's `andrew_id` in metadata.

---

## Test Infrastructure

### Setup overview

- **`playwright.config.ts`** at `frontend/` root. Configures: `baseURL` from `PLAYWRIGHT_BASE_URL` env (defaults to `http://localhost:3000`), three projects (`chromium`, `firefox`, `webkit` — start with `chromium` only for speed), `trace: "on-first-retry"`, retry once in CI.
- **`frontend/e2e/`** directory holding the test files. Mirrors the matrix structure: `e2e/page-gating/`, `e2e/controls/`, `e2e/error-toasts/`, `e2e/hygiene/`.
- **`frontend/e2e/fixtures.ts`** defines custom fixtures: `signInAs(role, opts?)`, `seedMarket(opts)`, `seedBet(market, opts)`, `setBalance(amount)`. These call backend test endpoints **or** directly operate on the same test DB used by doc 14's fixtures.

### Auth fixture

`signInAs(role)` does **not** go through the UI sign-in flow (slow, brittle, not what's being tested). Instead, it mints a JWT with the test secret + role's UUID and writes it to the Supabase session in `localStorage` before navigation. Same approach as doc 14's `as_role`, just on the browser side.

For tests that *do* need to verify the sign-in flow itself, mark them explicitly and use the real auth path.

### Test environment

Two environments:

- **Local:** `pnpm playwright test` against `http://localhost:3000` running the dev server. Backend at `http://localhost:8001` with test DB.
- **CI:** docker-compose or equivalent brings up frontend + backend + test DB. Run `pnpm playwright test --reporter=html`. HTML report uploaded as artifact.

**Production runs are not in scope.** This test suite is a CI gate, not a synthetic monitor.

---

## Files Affected

| Area | File | Status |
|---|---|---|
| Frontend | `frontend/playwright.config.ts` | NEW |
| Frontend | `frontend/e2e/fixtures.ts` | NEW |
| Frontend | `frontend/e2e/page-gating/*.spec.ts` | NEW (one file per matrix §5 group) |
| Frontend | `frontend/e2e/controls/*.spec.ts` | NEW (one file per matrix §6 surface) |
| Frontend | `frontend/e2e/error-toasts/*.spec.ts` | NEW (one file per `ErrorCode` cluster) |
| Frontend | `frontend/e2e/hygiene/*.spec.ts` | NEW |
| Frontend | `frontend/package.json` | MODIFY — add `@playwright/test`, scripts (`pnpm e2e`, `pnpm e2e:ui`) |
| Backend | `backend/tests/_test_seed_api.py` (optional) | NEW — admin-only HTTP endpoints used by Playwright fixtures to seed/inspect (alternative to direct DB access from Node) |
| CI | GitHub Actions workflow | MODIFY — add `e2e` job that boots services and runs Playwright |

---

## Execution

| Issue | Title | Depends on |
|---|---|---|
| `issues/15.1-playwright-setup.md` | Install Playwright, `playwright.config.ts`, fixtures (`signInAs`, `seedMarket`, `seedBet`, `setBalance`), one smoke test per fixture. | doc 14.1 (test users) |
| `issues/15.2-page-redirect-tests.md` | Matrix §5 sweep: one test per `(role, route)` cell. | 15.1 |
| `issues/15.3-control-visibility-tests.md` | Matrix §6 sweep: visibility / disabled / hidden assertions. | 15.1, doc 13 fully landed |
| `issues/15.4-error-toast-allow-list.md` | Doc 13 §4 catalog: one test per visible-toast `ErrorCode`. Hygiene checks. | 15.1, doc 13 fully landed |

15.2 and 15.3 can run in parallel after 15.1. 15.4 depends on doc 13 being fully migrated (otherwise some toasts still surface raw text).

---

## Cross-References

| Doc | Relationship |
|---|---|
| `project-specs/AUTHZ_MATRIX.md` | §5 → 15.2 page tests; §6 → 15.3 control tests. The matrix's §9 maintenance protocol is enforced here too: a new page or control must come with a test row in this suite. |
| `features/13-backend-hardening.md` | §4 catalog → 15.4 toast allow-list. `parseApiError` integration → 15.4 negative assertions. Server-side gate (Gap B-1) verified by 15.2. Portfolio leak (Gap B-2) verified by 15.3 (control should not even render the leaked content). |
| `features/14-api-contract-tests.md` | Doc 14 asserts the API contract; doc 15 asserts the UI honors it. Same matrix, different layer. The `signInAs` fixture mirrors `as_role` from doc 14 — same UUIDs so logs cross-reference cleanly. |
| `features/16-home-vs-markets-split.md` | Adds two new page-shape tests (root vs `/markets`) — listed in 15.2's acceptance criteria once 16 lands. |
| `features/17-market-creation-validation.md` | Adds form validation tests (`fieldErrors` rendering per §1e of doc 13) — listed in 15.4 once 17 lands. |
