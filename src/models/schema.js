const pool = require('../config/database');
const logger = require('../config/logger');

const SCHEMA_SQL = `
  -- Enable UUID generation
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Wallets table
  -- userId is UNIQUE to enforce one-wallet-per-user at the DB level (not just app level)
  CREATE TABLE IF NOT EXISTS wallets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      VARCHAR(255) NOT NULL UNIQUE,
    balance      NUMERIC(18, 2) NOT NULL DEFAULT 0.00
                   CHECK (balance >= 0),          -- DB-level guard: balance never goes negative
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Transactions table
  -- reference_id + type has a UNIQUE constraint so the same referenceId
  -- cannot be used for two different operations (idempotency enforced at DB level)
  CREATE TABLE IF NOT EXISTS transactions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id      UUID NOT NULL REFERENCES wallets(id),
    user_id        VARCHAR(255) NOT NULL,
    type           VARCHAR(10) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    amount         NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    status         VARCHAR(10) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    reference_id   VARCHAR(255) NOT NULL,
    failure_reason TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Idempotency: same referenceId + type combination must be unique
    CONSTRAINT uq_reference_type UNIQUE (reference_id, type)
  );

  -- Index for fast transaction lookups per wallet
  CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id
    ON transactions(wallet_id, created_at DESC);

  -- Index for idempotency checks
  CREATE INDEX IF NOT EXISTS idx_transactions_reference
    ON transactions(reference_id, type);
`;

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(SCHEMA_SQL);
    logger.info('Database schema initialized successfully');
  } catch (err) {
    logger.error('Failed to initialize database schema', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initializeDatabase };