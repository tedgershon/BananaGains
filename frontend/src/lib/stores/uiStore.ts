import { create } from "zustand";
import type { UserRole } from "@/lib/types";

// purely client-owned UI state, never mirrors server data
// add fields here when they're genuinely local (filters, toggles, modals)
interface UiState {
  // admin role-toggle for the "view as X" dropdown in the navbar
  viewAsRole: UserRole;
  setViewAsRole: (role: UserRole) => void;
}

export const useUiStore = create<UiState>((set) => ({
  viewAsRole: "user",
  setViewAsRole: (viewAsRole) => set({ viewAsRole }),
}));
