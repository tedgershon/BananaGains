# BananaGains Product Backlog

Linear tag: `product-backlog`
Linear link: https://linear.app/banangains/team/BAN/all
Due date: April 13, 2026

## 1. Market Discovery and Market Detail Experience
Users can browse active and resolved markets, open a market detail page, and understand the market question, resolution criteria, displayed probability, pool totals, close time, and current status.

Includes:
- home or market feed
- market cards and status badges
- market detail page
- filtering or grouping by status or category
- clear presentation of probability and pool data

## 2. Market Creation and Lifecycle Management
Users can create markets with a title, description, close time, and explicit resolution criteria. Market creators and admins can manage market states such as open, closed, resolved, and disputed.

Includes:
- create market form
- validation for required fields
- market status transitions
- creator-facing management actions
- rules around when a market can still be edited or closed

## 3. Trading Engine and Pool Accounting
Users can buy YES and NO positions using banana currency. The backend records each trade transactionally, updates pool totals safely, and exposes a probability display derived from the parimutuel pool distribution.

Includes:
- YES or NO trade placement
- pool updates and transactional balance deduction
- displayed probability calculation
- closed-market restrictions
- invalid trade amount validation

## 4. User Identity and KYC
The application tracks who a user is, what their banana balance is, and how their state persists across requests. Sprint 1 may use a demo-user shortcut, but the final product still needs explicit user identity and wallet state.

Includes:
- user profile or account record tied to an andrew ID
- banana balance and initial allocation
- session or login strategy appropriate for the final demo
- wallet state retrieval
- user-specific data access rules

## 5. Portfolio, Positions, and Trade History
Users can inspect the markets they have participated in, their current YES and NO positions, and the outcome of resolved markets.

Includes:
- portfolio page
- active positions by market
- resolved positions and payouts
- trade history or transaction history
- clear balance changes after settlement

## 6. Leaderboard
The application ranks users by banana holdings and makes competitive progress visible.

Includes:
- leaderboard page
- ranking by current banana total
- tie-breaking or ordering rules
- visibility into who is leading the game
- optional supporting stats such as recent movement or gain-or-loss summaries

## 7. Resolution and Settlement
Markets can be resolved after they close, and winning positions receive their share of the pool according to BananaGains settlement rules

Includes:
- creator resolution action
- resolved outcome recording
- settlement calculation
- payout distribution
- frozen settlement window where needed before payout is finalized

## 8. Disputes, Voting, and Governance
If a market resolution is contested, participants can trigger a dispute workflow and neutral voters can vote on the outcome with a small stake. Majority voters receive a reward from the pool.

Includes:
- dispute flagging
- bettor versus voter distinction
- voter staking flow
- majority vote reward logic
- escalation path to admin review when consensus is unclear

## 9. Admin Control
The team needs a moderation surface for invalid markets, abuse handling, and resolution conflicts so the application can be demonstrated safely

Includes:
- admin review tools
- moderation of bad or duplicate markets
- override path for broken or disputed resolutions
- visibility into user, market, and settlement state
- protective rules around misuse and bad data

## 10. Live Updates, Deployment and Demo
The application should feel responsive during demos and must be accessible to course staff remotely by the final review

Includes:
- live or polled probability refresh
- deployment to a remotely accessible environment
- seed data for demo accounts and markets
- presentation and demo script readiness
- final verification that the system is usable from a clean browser session
