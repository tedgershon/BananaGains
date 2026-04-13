import { create } from "zustand";

/**
 * Zustand store for purely client-owned UI state.
 *
 * Scope: UI toggles, filters, and view modes that do **not** originate from
 * the server. Server data (markets, bets, user profile, etc.) belongs in
 * React Query — never mirrored here.
 *
 * Populated in later PRs:
 *   - `viewAsRole` (admin role-toggle)
 *   - `selectedCategory` (markets page filter)
 *   - modal / drawer flags as they arise
 */
type UiState = Record<string, never>;

export const useUiStore = create<UiState>()(() => ({}));
