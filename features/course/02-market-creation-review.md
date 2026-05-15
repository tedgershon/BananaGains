# Feature 02: Market Creation & Admin Review Workflow

**Phase:** 2 (depends on Phase 1)
**Dependencies:** `01-admin-system` (admin roles, admin pages)
**Parallelizable with:** `04-market-resolution`, `10-safety-logic`

---

## Summary

Overhaul the market creation flow so that ALL newly created markets start in a `pending_review` state. Admins review, optionally edit, and approve or deny markets through an accordion-style admin panel. Add a link field with REGEX validation, distinguish between public-facing and internal fields, and implement automatic style linting before submission.

---

## Current State

- Markets are created via `POST /api/markets` and immediately get `status = 'open'`.
- The `CreateMarketRequest` schema requires: title, description, close_at, resolution_criteria, category, official_source, yes_criteria, no_criteria, ambiguity_criteria.
- No admin review step exists.
- No link field.
- No style linting.
- Market creation form is at `frontend/src/app/markets/create/page.tsx`.

---

## Database Changes

### Migration 025: Market Approval Workflow

**File:** `backend/supabase/migrations/025_market_approval_workflow.sql`

```sql
-- Expand market status to include pending_review, approved, denied
ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_status_check;
ALTER TABLE markets ADD CONSTRAINT markets_status_check
    CHECK (status IN (
        'pending_review', 'open', 'closed',
        'pending_resolution', 'disputed', 'admin_review', 'resolved',
        'denied'
    ));

-- Change default status to pending_review
ALTER TABLE markets ALTER COLUMN status SET DEFAULT 'pending_review';
```

### Migration 026: Market Review Columns

**File:** `backend/supabase/migrations/026_market_review_columns.sql`

```sql
-- Add review-related columns
ALTER TABLE markets ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id);
ALTER TABLE markets ADD COLUMN IF NOT EXISTS review_date TIMESTAMPTZ;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS link TEXT;

-- Index for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_markets_review_status ON markets (status)
    WHERE status IN ('pending_review', 'denied');
```

### Migration 027: Approve Market Function

**File:** `backend/supabase/migrations/027_fn_approve_market.sql`

```sql
CREATE OR REPLACE FUNCTION approve_market(
    p_market_id UUID,
    p_admin_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_status TEXT;
    v_is_admin BOOLEAN;
BEGIN
    SELECT role INTO v_is_admin FROM profiles WHERE id = p_admin_id;

    SELECT status INTO v_status FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_status != 'pending_review' THEN
        RAISE EXCEPTION 'Market is not pending review (current status: %)', v_status;
    END IF;

    UPDATE markets SET
        status = 'open',
        reviewed_by = p_admin_id,
        review_date = now(),
        review_notes = p_notes
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'open',
        'reviewed_by', p_admin_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 028: Deny Market Function

**File:** `backend/supabase/migrations/028_fn_deny_market.sql`

```sql
CREATE OR REPLACE FUNCTION deny_market(
    p_market_id UUID,
    p_admin_id UUID,
    p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_status != 'pending_review' THEN
        RAISE EXCEPTION 'Market is not pending review (current status: %)', v_status;
    END IF;

    IF p_notes IS NULL OR trim(p_notes) = '' THEN
        RAISE EXCEPTION 'Notes are required when denying a market';
    END IF;

    UPDATE markets SET
        status = 'denied',
        reviewed_by = p_admin_id,
        review_date = now(),
        review_notes = p_notes
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'denied',
        'reviewed_by', p_admin_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Backend Changes

### Modify: `backend/schemas/market.py`

**Update `MarketStatus` enum:**
```python
class MarketStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    OPEN = "open"
    CLOSED = "closed"
    PENDING_RESOLUTION = "pending_resolution"
    DISPUTED = "disputed"
    ADMIN_REVIEW = "admin_review"
    RESOLVED = "resolved"
    DENIED = "denied"
```

**Update `CreateMarketRequest`:**
```python
class CreateMarketRequest(BaseModel):
    title: str
    description: str
    close_at: datetime
    resolution_criteria: str
    category: str = "General"
    official_source: str
    yes_criteria: str
    no_criteria: str
    ambiguity_criteria: str
    link: str | None = None  # NEW: optional URL

    @field_validator("link")
    @classmethod
    def validate_link(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        url_pattern = r'^https?://[^\s/$.?#].[^\s]*$'
        import re
        if not re.match(url_pattern, v):
            raise ValueError("Invalid URL format. Must start with http:// or https://")
        return v
```

**Update `MarketResponse`:**
```python
class MarketResponse(BaseModel):
    # ... existing fields ...
    link: str | None = None  # NEW
    reviewed_by: str | None = None  # NEW
    review_date: datetime | None = None  # NEW
    review_notes: str | None = None  # NEW
```

**Add new schemas:**
```python
class ReviewMarketRequest(BaseModel):
    action: Literal["approve", "deny"]
    notes: str | None = None
    # Admin can edit these fields before approving:
    title: str | None = None
    description: str | None = None
    resolution_criteria: str | None = None
    close_at: datetime | None = None
    category: str | None = None
    link: str | None = None

    @field_validator("notes")
    @classmethod
    def notes_required_for_deny(cls, v, info):
        if info.data.get("action") == "deny" and (v is None or v.strip() == ""):
            raise ValueError("Notes are required when denying a market")
        return v
```

### Modify: `backend/routers/markets.py`

**Update `create_market` endpoint:**

1. Insert market with `status = 'pending_review'` instead of `'open'`.
2. Apply the style linting adapter before insertion (see Linting section below).
3. Include the `link` field in the insert.

```python
@router.post("", response_model=MarketResponse, status_code=status.HTTP_201_CREATED)
async def create_market(
    body: CreateMarketRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    # Apply style linting
    linted = lint_market_fields(body)

    with user_auth(supabase, token):
        result = (
            supabase.table("markets")
            .insert({
                "title": linted.title,
                "description": linted.description,
                "creator_id": current_user["id"],
                "close_at": linted.close_at.isoformat(),
                "resolution_criteria": linted.resolution_criteria,
                "category": linted.category,
                "official_source": linted.official_source,
                "yes_criteria": linted.yes_criteria,
                "no_criteria": linted.no_criteria,
                "ambiguity_criteria": linted.ambiguity_criteria,
                "link": linted.link,
                "status": "pending_review",  # Always start as pending
            })
            .execute()
        )
    # ... rest unchanged
```

**Update `_apply_lazy_transitions`:**
- Skip markets with status `pending_review` or `denied` — they should not undergo any automatic transitions.

### Add to `backend/routers/admin.py`

**Review Market Endpoint:**

```python
@router.post("/api/admin/markets/{market_id}/review")
async def review_market(
    market_id: str,
    body: ReviewMarketRequest,
    current_user: dict = Depends(require_admin),
    supabase: Client = Depends(get_supabase_client),
):
    """Admin reviews a proposed market — approve or deny."""

    # If admin edited fields, update them first
    updates = {}
    for field in ["title", "description", "resolution_criteria", "close_at", "category", "link"]:
        val = getattr(body, field, None)
        if val is not None:
            updates[field] = val.isoformat() if field == "close_at" else val

    if updates:
        supabase.table("markets").update(updates).eq("id", market_id).execute()

    # Then approve or deny
    if body.action == "approve":
        result = supabase.rpc("approve_market", {
            "p_market_id": market_id,
            "p_admin_id": current_user["id"],
            "p_notes": body.notes,
        }).execute()
    else:
        result = supabase.rpc("deny_market", {
            "p_market_id": market_id,
            "p_admin_id": current_user["id"],
            "p_notes": body.notes,
        }).execute()

    return result.data
```

**List Markets for Review:**

```python
@router.get("/api/admin/markets/review")
async def list_markets_for_review(
    current_user: dict = Depends(require_admin),
    supabase: Client = Depends(get_supabase_client),
):
    """List all markets organized by review status."""
    pending = (
        supabase.table("markets")
        .select("*, profiles!creator_id(andrew_id, display_name)")
        .eq("status", "pending_review")
        .order("created_at", desc=False)
        .execute()
    )

    approved = (
        supabase.table("markets")
        .select("*, profiles!creator_id(andrew_id, display_name), reviewer:profiles!reviewed_by(andrew_id, display_name)")
        .eq("status", "open")
        .not_.is_("reviewed_by", "null")
        .order("review_date", desc=True)
        .limit(50)
        .execute()
    )

    denied = (
        supabase.table("markets")
        .select("*, profiles!creator_id(andrew_id, display_name), reviewer:profiles!reviewed_by(andrew_id, display_name)")
        .eq("status", "denied")
        .order("review_date", desc=True)
        .limit(50)
        .execute()
    )

    return {
        "pending": pending.data or [],
        "approved": approved.data or [],
        "denied": denied.data or [],
    }
```

---

## Style Linting Adapter

### New File: `backend/market_linter.py`

Create a linting module that normalizes market text fields before submission:

```python
import re

def lint_market_fields(body: CreateMarketRequest) -> CreateMarketRequest:
    """Apply style conformity rules to market text fields."""
    return body.model_copy(update={
        "title": _lint_title(body.title),
        "description": _lint_body_text(body.description),
        "resolution_criteria": _lint_body_text(body.resolution_criteria),
        "yes_criteria": _lint_body_text(body.yes_criteria),
        "no_criteria": _lint_body_text(body.no_criteria),
        "ambiguity_criteria": _lint_body_text(body.ambiguity_criteria),
        "official_source": body.official_source.strip(),
    })

def _lint_title(text: str) -> str:
    """Lint a market title: remove extra whitespace, capitalize appropriately."""
    text = re.sub(r'\s+', ' ', text.strip())
    # Capitalize first letter if not already
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
    # Ensure title ends with '?' if it's a question, otherwise no trailing punctuation forced
    return text

def _lint_body_text(text: str) -> str:
    """Lint body text: remove redundant whitespace, ensure sentence capitalization and punctuation."""
    text = re.sub(r'\s+', ' ', text.strip())
    # Capitalize first letter of each sentence
    sentences = re.split(r'(?<=[.!?])\s+', text)
    linted_sentences = []
    for s in sentences:
        s = s.strip()
        if s and s[0].islower():
            s = s[0].upper() + s[1:]
        linted_sentences.append(s)
    text = ' '.join(linted_sentences)
    # Ensure ends with punctuation
    if text and text[-1] not in '.!?':
        text += '.'
    return text
```

---

## Frontend Changes

### Update: Market Creation Form (`frontend/src/app/markets/create/page.tsx`)

#### 1. Add Market Type Selector (Binary vs Multichoice)

At the top of the form, add a toggle/radio group:
- **Binary (Yes / No)** — default, current behavior
- **Multiple Choice** — handled in `03-multichoice-markets.md`

For this feature, only implement the binary path and the selector UI. The multichoice path will be completed in Feature 03.

#### 2. Add Link Field

After the "Official Source" input, add:

```tsx
<div className="space-y-1.5">
  <label htmlFor="link" className="text-sm font-medium text-foreground">
    Link (optional)
  </label>
  <input
    id="link"
    type="url"
    placeholder="https://example.com/relevant-article"
    value={link}
    onChange={(e) => {
      setLink(e.target.value);
      setLinkError(null);
    }}
    className={`${inputClass} ${linkError ? 'border-danger' : ''}`}
  />
  {linkError && (
    <p className="text-xs text-danger">{linkError}</p>
  )}
</div>
```

Validate on submit with the REGEX pattern:
```typescript
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

if (link && !URL_REGEX.test(link)) {
  setLinkError("Invalid URL. Must start with http:// or https://");
  return;
}
```

If validation fails, **prevent form submission** and display the error message.

#### 3. Visual Distinction: Public vs Internal Fields

Create two styled sections within the form:

**Section A: "Market Details (Public)"** — displayed to all users viewing the market:
- Title
- Description
- Link (optional)
- Resolution Criteria
- Category
- Close Date

Style this section with the standard card background.

**Section B: "Review Information (Admin Only)"** — passed to admin during review, NOT displayed publicly:
- Official Source
- Yes Criteria
- No Criteria
- Ambiguity Criteria

Style this section with a distinct visual treatment:
- Add a subtle muted background (e.g., `bg-muted/50`)
- Add an info banner at the top: "These fields will be reviewed by admins and are not publicly displayed."
- Use a different card border color (e.g., dashed border or a colored left border)

#### 4. Post-Submission Feedback

After successful submission, instead of redirecting to the market detail page (since the market is now `pending_review`), show:
- A success message: "Your market has been submitted for review! You'll be notified when an admin approves it."
- A link back to the home page.
- Do NOT redirect to `/markets/{id}` since the market isn't yet public.

#### 5. Indicate Pending Markets in Portfolio

In the portfolio page, add a section showing "Pending Markets" — markets created by the user that are still in `pending_review` status. Display the title and a "Pending Review" badge.

---

### New Page: `frontend/src/app/admin/review/page.tsx`

**Admin Market Review Page:**

The page layout uses an **accordion design** with three sections:

#### Accordion 1: "Pending Review" (open by default)
- Header shows count: "Pending Review (3)"
- Table columns:
  - **Title** — market title (truncated if long)
  - **Proposed By** — creator's andrew_id
  - **Proposed Date** — formatted date
  - **Reviewed By** — empty for pending
  - **Review Date** — empty for pending
- Each row is clickable → expands to show the full market details

#### Accordion 2: "Approved"
- Same table columns but "Reviewed By" and "Review Date" are populated
- Collapsed by default

#### Accordion 3: "Denied"
- Same table columns
- Collapsed by default

#### Row Expansion (Market Detail Panel)

When an admin clicks a row in the "Pending Review" table, it expands to show a panel with:

1. **All market fields displayed and editable:**
   - Title (editable input)
   - Description (editable textarea)
   - Resolution Criteria (editable textarea)
   - Close Date (editable datetime input)
   - Category (editable select)
   - Link (editable input, if present)
   - Official Source (read-only, shown for context)
   - Yes Criteria (read-only)
   - No Criteria (read-only)
   - Ambiguity Criteria (read-only)

2. **Notes field:**
   - Label: "Notes for Creator"
   - Placeholder: "Leave a note for the market creator with feedback or suggested changes..."
   - Textarea, required for deny, optional for approve
   - These notes will be sent to the creator via notification (Feature 07)

3. **Action buttons at the bottom:**
   - **"Approve Market"** — green button, calls `POST /api/admin/markets/{id}/review` with `action: "approve"` plus any edited fields and notes
   - Above the approve button: the Notes textarea

4. **Deny button:**
   - Below notes but above approve, add a secondary danger-styled "Deny Market" button
   - On click, requires notes to be filled in (show validation error if empty)

#### Shared Admin View

All admin accounts see the same tables. The tables reflect real-time DB state:
- When one admin approves a market, it moves from "Pending Review" to "Approved" for all admins
- Implement this by re-fetching the review list after any action
- Optionally add a "Refresh" button at the top of the page

#### Review Count in Navigation

In the admin dropdown or navbar admin link, display a badge with the count of pending reviews:
- Query: `GET /api/admin/markets/review` → count of `pending` array
- Display as a small red/primary-colored badge next to "Review Markets" text
- Also display this count next to the "Admin" nav link in the navbar

---

### Update: Market Detail Page (`frontend/src/app/markets/[id]/page.tsx`)

If the market has a `link` field:
- Display a clickable link icon/button in the Market Info card
- Label: "Source Link" with an external link icon
- Opens in a new tab (`target="_blank" rel="noopener noreferrer"`)

---

### Update: Market Card (`frontend/src/components/market-card.tsx`)

- Add a visual indicator for `pending_review` status (e.g., yellow/amber badge that says "Under Review")
- These cards should only be visible to the creator in their portfolio, NOT on the public market list
- On the public market list, filter out `pending_review` and `denied` markets

---

## Market Visibility Rules

| Status | Public Market List | Creator's Portfolio | Admin Review Page |
|--------|-------------------|-------------------|-------------------|
| `pending_review` | Hidden | Visible (with badge) | Visible |
| `open` | Visible | Visible | Visible in "Approved" |
| `denied` | Hidden | Visible (with badge) | Visible in "Denied" |
| Other statuses | Visible | Visible | — |

Update the `list_markets` endpoint in `backend/routers/markets.py` to exclude `pending_review` and `denied` markets from the default public listing (unless the caller is admin).

---

## Testing Checklist

- [ ] Creating a market sets status to `pending_review`
- [ ] Pending markets do NOT appear on the public market list
- [ ] Pending markets appear in creator's portfolio with "Under Review" badge
- [ ] Admin can see all pending markets on review page
- [ ] Admin can edit market fields before approving
- [ ] Admin can approve a market → status becomes `open`
- [ ] Admin can deny a market with required notes → status becomes `denied`
- [ ] Denied markets show in creator's portfolio with "Denied" badge and review notes
- [ ] Link field accepts valid URLs and rejects invalid ones
- [ ] Link is displayed on market detail page when present
- [ ] Style linting removes extra whitespace, capitalizes sentences, adds punctuation
- [ ] All admins see the same review table state
- [ ] Pending review count badge shows correct number in admin nav
