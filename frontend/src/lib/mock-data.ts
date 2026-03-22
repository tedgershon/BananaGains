import type { Market, UserProfile } from "./types";

export const DEMO_USER: UserProfile = {
  id: "user-1",
  andrew_id: "at2",
  display_name: "Aaron Tang",
  banana_balance: 1000,
  created_at: "2026-03-17T00:00:00Z",
};

export const MOCK_MARKETS: Market[] = [
  {
    id: "market-1",
    title: "Will CMU's CS program be ranked #1 again this year?",
    description:
      "Resolves YES if CMU's CS program is ranked #1 in the next US News ranking release.",
    creator_id: "user-2",
    created_at: "2026-03-18T10:00:00Z",
    close_at: "2026-04-10T23:59:00Z",
    status: "open",
    resolution_criteria:
      "Based on the official US News & World Report ranking.",
    yes_pool_total: 3200,
    no_pool_total: 800,
    resolved_outcome: null,
    resolved_at: null,
    category: "Academics",
  },
  {
    id: "market-2",
    title: "Will Carnival have over 10,000 attendees?",
    description:
      "Resolves YES if official CMU Spring Carnival attendance exceeds 10,000 people.",
    creator_id: "user-3",
    created_at: "2026-03-19T14:30:00Z",
    close_at: "2026-04-08T12:00:00Z",
    status: "open",
    resolution_criteria: "Based on official CMU event attendance numbers.",
    yes_pool_total: 1500,
    no_pool_total: 2100,
    resolved_outcome: null,
    resolved_at: null,
    category: "Campus Life",
  },
  {
    id: "market-3",
    title: "Will the Gates Hillman escalator break down before finals?",
    description:
      "Resolves YES if any GHC escalator is out of service for 24+ hours before finals week.",
    creator_id: "user-1",
    created_at: "2026-03-17T09:00:00Z",
    close_at: "2026-04-12T23:59:00Z",
    status: "open",
    resolution_criteria:
      "Photographic evidence or official maintenance notice.",
    yes_pool_total: 4100,
    no_pool_total: 500,
    resolved_outcome: null,
    resolved_at: null,
    category: "Campus Life",
  },
  {
    id: "market-4",
    title: "Will 67-250 curve the final exam?",
    description:
      "Resolves YES if the Information Systems course 67-250 applies a curve to the final exam.",
    creator_id: "user-2",
    created_at: "2026-03-18T16:00:00Z",
    close_at: "2026-04-11T23:59:00Z",
    status: "open",
    resolution_criteria:
      "Confirmed by professor announcement or syllabus update.",
    yes_pool_total: 900,
    no_pool_total: 1100,
    resolved_outcome: null,
    resolved_at: null,
    category: "Academics",
  },
  {
    id: "market-5",
    title: "Will Tartan Racing win the next AV competition?",
    description:
      "Resolves YES if CMU's Tartan Racing team places 1st in their next autonomous vehicle competition.",
    creator_id: "user-3",
    created_at: "2026-03-20T08:00:00Z",
    close_at: "2026-04-05T23:59:00Z",
    status: "open",
    resolution_criteria: "Based on official competition results.",
    yes_pool_total: 2000,
    no_pool_total: 1800,
    resolved_outcome: null,
    resolved_at: null,
    category: "Sports & Clubs",
  },
  {
    id: "market-6",
    title: "Will the Fence be painted more than 3 times this week?",
    description:
      "Resolves YES if the Fence on campus is repainted more than 3 times in the current week.",
    creator_id: "user-1",
    created_at: "2026-03-17T12:00:00Z",
    close_at: "2026-03-23T23:59:00Z",
    status: "closed",
    resolution_criteria: "Community photo log or campus newspaper report.",
    yes_pool_total: 600,
    no_pool_total: 400,
    resolved_outcome: null,
    resolved_at: null,
    category: "Campus Life",
  },
];
