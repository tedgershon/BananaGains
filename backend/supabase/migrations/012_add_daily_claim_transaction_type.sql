-- 012: add daily_claim to transaction types

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check
    CHECK (transaction_type IN (
        'initial_grant', 'bet_placement', 'payout',
        'voter_stake', 'voter_reward', 'daily_claim'
    ));
