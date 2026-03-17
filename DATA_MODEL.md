# BananaGains Data Model

### UserProfile
- `id`
- `andrew_id`
- `display_name`
- `banana_balance`
- `created_at`

Purpose:
Stores the identity and wallet state of each user

### Market
- `id`
- `title`
- `description`
- `creator_id`
- `created_at`
- `close_at`
- `status`
- `resolution_criteria`
- `yes_pool_total`
- `no_pool_total`
- `resolved_outcome`
- `resolved_at`

Purpose:
Stores the market question, timing, pool totals, and settlement state

### Bet
- `id`
- `user_id`
- `market_id`
- `side`
- `amount`
- `created_at`

Purpose:
Represents a single user trade on the YES or NO side of a market

### ResolutionVote
- `id`
- `market_id`
- `voter_id`
- `selected_outcome`
- `staked_amount`
- `created_at`

Purpose:
Represents a neutral voter participation record for disputed markets

### Transaction
- `id`
- `user_id`
- `market_id`
- `transaction_type`
- `amount`
- `created_at`

Purpose:
Tracks wallet-affecting events such as initial allocation, bet placement, voter stake, reward, and payout

## Relationship Summary
- A `UserProfile` can create many `Market` records
- A `UserProfile` can place many `Bet` records
- A `Market` can have many `Bet` records
- A disputed `Market` can have many `ResolutionVote` records
- A `UserProfile` can have many `Transaction` records tied to market and wallet events

## Modeling Notes
- `Market.status` should capture values such as `open`, `closed`, `resolved`, and `disputed`
- `Bet.side` should capture `YES` or `NO`
- `Transaction.transaction_type` should distinguish wallet events such as initial grant, bet placement, payout, voter stake, and voter reward
- Portfolio state can be derived from `Bet` and `Transaction` records rather than stored separately unless performance or reporting needs justify a dedicated model later
