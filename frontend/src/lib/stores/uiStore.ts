import { create } from "zustand";

// purely client-owned UI state, never mirrors server data
// add fields here when they're genuinely local (filters, toggles, modals)
type UiState = Record<string, never>;

export const useUiStore = create<UiState>()(() => ({}));
