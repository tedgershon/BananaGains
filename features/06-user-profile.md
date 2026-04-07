# Feature 06: User Profile Dropdown

**Phase:** 1 (Foundation — no dependencies)
**Dependencies:** None
**Parallelizable with:** `01-admin-system`, `05-coin-claiming`

---

## Summary

Replace the current "Sign In" / "Sign Out" button in the navbar with a **circular avatar** showing the user's initials. On click, display a dropdown card styled like GitHub's user menu (see `github-icon.png` reference). The dropdown includes navigation items and a sign-out action. Show a "Sign In" button when the user is not logged in.

---

## Current State

- The navbar (`frontend/src/components/navbar.tsx`) shows:
  - For authenticated users: balance link, "Create Market" button, "Sign Out" button
  - For demo/unauthenticated users: "Sign In" button
- No dropdown menu exists.

---

## Database Changes

No database changes needed. The avatar is rendered purely from the user's `display_name` initials on the frontend.

---

## Backend Changes

No backend changes needed — the existing `/api/auth/me` already returns the full profile including `display_name`, which is used to derive the initials avatar.

---

## Frontend Changes

### New Component: `frontend/src/components/user-menu.tsx`

Create a new component that replaces the current sign-in/sign-out button:

```tsx
"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionProvider";

const MENU_ITEMS = [
  { href: "/portfolio", label: "Portfolio", icon: "wallet" },
  { href: "/portfolio#positions", label: "Positions", icon: "bar-chart" },
  { href: "/portfolio#transactions", label: "Transaction History", icon: "list" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];

export function UserMenu() {
  const { user, isDemo, signOut } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isDemo) {
    return (
      <Link href="/auth" className="...sign-in-button-styles...">
        Sign In
      </Link>
    );
  }

  const initials = user.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={menuRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center"
      >
        <div className="size-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground border-2 border-border">
          {initials}
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card shadow-lg z-50">
          {/* Profile header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold">{user.display_name}</p>
              <p className="text-xs text-muted-foreground">{user.andrew_id}</p>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                {/* Icon would go here — use lucide-react icons */}
                <span>{item.label}</span>
                {/* Notification count badge goes here for "Notifications" item */}
              </Link>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-border py-1">
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.push("/");
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-accent transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Update: `frontend/src/components/navbar.tsx`

Replace the sign-in/sign-out section with the `UserMenu` component:

**Before (current):**
```tsx
{isDemo ? (
  <Link href="/auth" ...>Sign In</Link>
) : (
  <Button onClick={signOut}>Sign Out</Button>
)}
```

**After:**
```tsx
import { UserMenu } from "@/components/user-menu";

// In the navbar's right section:
<div className="flex items-center gap-4">
  {!isDemo && (
    <>
      <Link href="/portfolio" className={cn(buttonVariants({...}), "gap-1.5")}>
        <BananaCoin size={16} />
        <span>{user.banana_balance.toLocaleString()}</span>
      </Link>
      <Link href="/markets/create" className={cn(buttonVariants({...}), "px-4")}>
        Create Market
      </Link>
    </>
  )}
  <UserMenu />
</div>
```

### Avatar Design

**Default (all users):**
- Display a **gray circle** with the user's initials (first letter of first and last name).
- Background: `bg-muted` (light gray)
- Text: `text-muted-foreground`
- Size: `size-9` (36px) in navbar, `size-10` (40px) in dropdown header
- Border: `border-2 border-border` for definition

**When user is not logged in:**
- Display a "Sign In" button in place of the avatar (same position, same styling as current).
- Use `buttonVariants({ variant: "outline", size: "sm" })` for the sign-in button.

### Dropdown Styling (GitHub-style)

Reference: `github-icon.png` shows GitHub's dropdown:
- Avatar + username + handle at top
- Menu items with icons
- Section dividers
- Sign out at bottom separated by a divider

**Our implementation should match this structure:**
1. **Header section:** Initials avatar + display name + andrew_id (separated by bottom border)
2. **Navigation section:** Portfolio, Positions, Transaction History, Notifications
3. **Divider**
4. **Sign Out** (in danger/red color)

**Icons for each menu item** (use lucide-react, already a dependency):
- Portfolio: `Wallet` or `PieChart`
- Positions: `BarChart3`
- Transaction History: `List`
- Notifications: `Bell`

### Notification Badge in Dropdown

The "Notifications" menu item should show a small badge with the unread count (implemented in Feature 07). For now, just set up the slot:

```tsx
<Link href="/notifications" className="...">
  <Bell size={16} />
  <span>Notifications</span>
  {/* Feature 07 will add: */}
  {/* {unreadCount > 0 && <span className="...">{unreadCount}</span>} */}
</Link>
```

### Notification Indicator on Avatar

Feature 07 will add a small dot/badge on the avatar circle when there are unread notifications. Leave a slot for this:

```tsx
<button onClick={() => setOpen(!open)} className="relative">
  {/* Avatar circle */}
  {/* Feature 07 will add an indicator dot here */}
</button>
```

---

## Responsive Design Notes

- On mobile (< sm breakpoint), the dropdown should take up more width (possibly full width minus some padding).
- The avatar button should always be visible (no hide on mobile).
- Menu items should have adequate touch targets (min 44px height).

---

## Testing Checklist

- [ ] Authenticated user sees circular initials avatar in navbar
- [ ] Clicking avatar opens dropdown with profile info
- [ ] Dropdown shows display name and andrew_id
- [ ] All menu items navigate correctly (Portfolio, Positions, Transaction History, Notifications)
- [ ] Sign Out button works and redirects to home
- [ ] Clicking outside the dropdown closes it
- [ ] Unauthenticated user sees "Sign In" button instead of avatar
- [ ] Default gray avatar shows correct initials
- [ ] Dropdown is positioned correctly (doesn't overflow viewport)
- [ ] Balance link and Create Market button remain visible alongside the avatar
