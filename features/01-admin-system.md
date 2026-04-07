# Feature 01: Admin & Super Admin System

**Phase:** 1 (Foundation — no dependencies)
**Dependencies:** None
**Parallelizable with:** `05-coin-claiming`, `06-user-profile`

---

## Summary

Establish a robust role-based access control (RBAC) system with three roles: **user**, **admin**, and **super_admin**. Build the admin review infrastructure, super admin user management, role preview toggle, and a cumulative statistics dashboard.

---

## Current State

- `profiles` table has `is_admin BOOLEAN NOT NULL DEFAULT FALSE` (migration `009`).
- No concept of "super admin" exists.
- No admin UI pages exist.
- No mechanism to promote users to admin.
- No admin statistics dashboard.

---

## Database Changes

### Migration 021: Role System

**File:** `backend/supabase/migrations/021_role_system.sql`

Replace the boolean `is_admin` with a proper role column:

```sql
-- Add role column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'super_admin'));

-- Migrate existing admin flags
UPDATE profiles SET role = 'admin' WHERE is_admin = TRUE;

-- Seed the super admin account (tgershon)
UPDATE profiles SET role = 'super_admin' WHERE andrew_id = 'tgershon';

-- Keep is_admin as a computed convenience for backward compatibility
-- but new code should use the role column
CREATE OR REPLACE FUNCTION profiles_is_admin_sync()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.is_admin := NEW.role IN ('admin', 'super_admin');
    RETURN NEW;
END;
$$;

CREATE TRIGGER sync_is_admin
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION profiles_is_admin_sync();
```

### Migration 022: Admin RLS Policies

**File:** `backend/supabase/migrations/022_admin_rls_policies.sql`

```sql
-- Admins can update any market (needed for review workflow)
CREATE POLICY "Admins can update any market"
    ON markets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- Admins can view all transactions (for statistics)
CREATE POLICY "Admins can view all transactions"
    ON transactions FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- Super admin can update any profile's role
CREATE POLICY "Super admin can update any profile"
    ON profiles FOR UPDATE
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );
```

---

## Backend Changes

### New File: `backend/routers/admin.py`

Create a new admin router with the following endpoints:

#### `GET /api/admin/stats`
- **Auth:** Admin or Super Admin only
- **Returns:** Cumulative statistics object:
  ```json
  {
    "total_users": 42,
    "users_by_role": { "user": 38, "admin": 3, "super_admin": 1 },
    "total_markets": 15,
    "markets_by_status": { "open": 5, "closed": 2, "pending_review": 3, "resolved": 5 },
    "total_banana_traded": 125000,
    "total_active_bets": 87
  }
  ```
- **Implementation:**
  - Query `profiles` table grouped by `role` for user counts.
  - Query `markets` table grouped by `status` for market counts.
  - Sum `amount` from `transactions` where `transaction_type = 'bet_placement'` for total traded (use absolute values).
  - Count rows in `bets` joined with `markets` where `markets.status IN ('open', 'closed', 'pending_resolution', 'disputed')` for active bets.

#### `GET /api/admin/users/search?q={andrew_id}`
- **Auth:** Super Admin only
- **Params:** `q` — partial or full `andrew_id` to search for
- **Returns:** List of matching profiles (id, andrew_id, display_name, role, created_at)
- **Implementation:**
  - Query `profiles` where `andrew_id ILIKE '%' || q || '%'`.
  - Only execute search and return results after the full query string is received (the frontend will only send after Enter is pressed).

#### `PUT /api/admin/users/{user_id}/role`
- **Auth:** Super Admin only
- **Body:** `{ "role": "admin" }` — valid values: `"user"`, `"admin"`
- **Validation:**
  - Cannot change own role.
  - Cannot set role to `"super_admin"` (super admin is only seeded, never granted via API).
  - Target user must exist.
- **Implementation:**
  - Update `profiles.role` for the given user ID.
  - Return the updated profile.

### New File: `backend/schemas/admin.py`

```python
from pydantic import BaseModel

class StatsResponse(BaseModel):
    total_users: int
    users_by_role: dict[str, int]
    total_markets: int
    markets_by_status: dict[str, int]
    total_banana_traded: float
    total_active_bets: int

class UserSearchResult(BaseModel):
    id: str
    andrew_id: str
    display_name: str
    role: str
    created_at: str

class UpdateRoleRequest(BaseModel):
    role: str  # "user" or "admin"

class UpdateRoleResponse(BaseModel):
    id: str
    andrew_id: str
    display_name: str
    role: str
```

### Modify: `backend/dependencies.py`

Add a new dependency for requiring admin access:

```python
async def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Require the user to be an admin or super_admin."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user

async def require_super_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Require the user to be a super_admin."""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required.")
    return current_user
```

### Modify: `backend/schemas/user.py`

Add `role` field to `UserProfileResponse`:

```python
class UserProfileResponse(BaseModel):
    id: str
    andrew_id: str
    display_name: str
    banana_balance: float
    created_at: datetime
    claimed_today: bool = False
    role: str = "user"  # "user", "admin", or "super_admin"
    is_admin: bool = False  # backward compat
```

### Modify: `backend/main.py`

Register the new admin router:
```python
from routers import admin
app.include_router(admin.router)
```

---

## Frontend Changes

### Update: `frontend/src/lib/types.ts`

Add `role` to the `UserProfile` interface:

```typescript
export interface UserProfile {
  id: string;
  andrew_id: string;
  display_name: string;
  banana_balance: number;
  created_at: string;
  claimed_today: boolean;
  role: "user" | "admin" | "super_admin";  // NEW
  is_admin: boolean;  // backward compat
}
```

### Update: `frontend/src/lib/api.ts`

Add admin API functions:

```typescript
// Admin endpoints
export function getAdminStats(): Promise<AdminStats> {
  return apiFetch("/api/admin/stats");
}

export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return apiFetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
}

export function updateUserRole(userId: string, role: string): Promise<UserSearchResult> {
  return apiFetch(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}
```

### New Page: `frontend/src/app/admin/page.tsx`

The admin landing page that is only accessible to admin/super_admin users. Redirect non-admins to `/`.

Contains a navigation sidebar or tabs with:
- **Review Markets** (link to `/admin/review`)
- **Statistics** (link to `/admin/stats`)
- **Manage Users** (only visible to super_admin, link to `/admin/users`)

### New Page: `frontend/src/app/admin/review/page.tsx`

**This page is described fully in `02-market-creation-review.md`.** This file only establishes the route and access control.

### New Page: `frontend/src/app/admin/stats/page.tsx`

**Cumulative Statistics Dashboard:**

- Display in a grid of stat cards (similar to portfolio page style):
  - **Total Users** — large number with breakdown by role below (e.g., "38 users, 3 admins, 1 super admin")
  - **Total Markets** — large number with breakdown by status (use color-coded badges for each status)
  - **Total Banana Currency Traded** — large number with BananaCoin icon
- Use the existing Card/CardHeader/CardContent components from shadcn.
- Fetch data from `GET /api/admin/stats` on mount.
- Show a `Spinner` while loading.

### New Page: `frontend/src/app/admin/users/page.tsx`

**Super Admin User Management:**

- Only accessible to `super_admin` role. Redirect others to `/admin`.
- Contains a search input field with:
  - Placeholder text: "Search by Andrew ID..."
  - A "Search" button (or Enter key to trigger)
  - **Do not perform live search** — only search when Enter is pressed or the button is clicked
- Below the search, display results in a simple table:
  - Columns: Andrew ID, Display Name, Current Role, Actions
  - "Actions" column contains a dropdown or button:
    - If role is `user`: show "Promote to Admin" button
    - If role is `admin`: show "Demote to User" button
    - If role is `super_admin`: no action (grayed out, show "Super Admin" text)
- After promotion/demotion, show a success toast or inline message and refresh the row.
- If no results found, display "No user found with that Andrew ID."

### New Component: `frontend/src/components/role-toggle.tsx`

**Role Preview Toggle** (only visible to admins/super admins):

- A segmented control or toggle group in the navbar or admin area that shows available roles:
  - For admin: shows "Admin" | "User" toggle
  - For super_admin: shows "Super Admin" | "Admin" | "User" toggle
- When toggled, it sets a context value (e.g., `viewAsRole`) that the rest of the app reads to show/hide admin-specific UI.
- **This does not change the actual role in the database.** It only changes the UI preview.
- Useful for admins to see what regular users experience.
- Store the preview role in React context (add to `SessionProvider` or create a new `AdminContext`).

### Update: `frontend/src/components/navbar.tsx`

- Add "Admin" link to `NAV_LINKS` array, but only render it if `user.role` is `"admin"` or `"super_admin"`:
  ```typescript
  { href: "/admin", label: "Admin", adminOnly: true }
  ```
- Add the role toggle component to the navbar (next to the user menu), only visible to admin/super_admin.

---

## Super Admin Credentials

The super admin account is the user with `andrew_id = 'tgershon'`. This is seeded in migration `021`. No separate credentials file is needed since authentication is via Google OAuth through `@andrew.cmu.edu`. The super admin is identified by their `andrew_id`, not by a separate login.

However, create a gitignored file for documentation purposes:

**File:** `backend/.super_admin` (add to `.gitignore`)
```
# Super admin account
# This account has elevated privileges for user management
andrew_id: tgershon
```

Add `*.super_admin` or `.super_admin` to both root `.gitignore` and `backend/.gitignore`.

---

## Access Control Summary

| Action | User | Admin | Super Admin |
|--------|------|-------|-------------|
| Browse/bet on markets | Yes | Yes | Yes |
| Create markets | Yes | Yes | Yes |
| Review proposed markets | No | Yes | Yes |
| View admin stats | No | Yes | Yes |
| Preview as other roles | No | Yes (user) | Yes (user, admin) |
| Search users | No | No | Yes |
| Change user roles | No | No | Yes (user↔admin only) |

---

## Testing Checklist

- [ ] New user signs up → role defaults to `user`
- [ ] Super admin (tgershon) can access `/admin/users`
- [ ] Super admin can search for a user by andrew_id
- [ ] Super admin can promote user to admin
- [ ] Super admin can demote admin to user
- [ ] Super admin cannot change own role
- [ ] Admin can access `/admin/stats` but not `/admin/users`
- [ ] User cannot access any `/admin` routes (redirect to `/`)
- [ ] Role toggle preview works without changing DB role
- [ ] Admin stats show correct counts
- [ ] `is_admin` stays in sync with `role` column via trigger
