const pool = require('../config/database');


/**
 * Create a wallet for a user.
 * Uses INSERT ... ON CONFLICT DO NOTHING to safely detect duplicate userId.
 * Returns the new wallet or null if userId already existed.
 */
async function createWallet(userId, client = pool) {
  const result = await client.query(
    `INSERT INTO wallets (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Find wallet by userId. Returns null if not found.
 */
async function findWalletByUserId(userId, client = pool) {
  const result = await client.query(
    `SELECT * FROM wallets WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Find wallet by userId with a row-level lock (FOR UPDATE).
 * Must be called inside an explicit transaction.
 * This prevents two concurrent debits from reading the same balance simultaneously.
 */
async function findWalletByUserIdForUpdate(userId, client) {
  const result = await client.query(
    `SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Atomically increment wallet balance.
 * Returns updated wallet row.
 */
async function incrementBalance(walletId, amount, client) {
  const result = await client.query(
    `UPDATE wallets
     SET balance    = balance + $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [walletId, amount]
  );
  return result.rows[0];
}

/**
 * Atomically decrement wallet balance only if sufficient funds exist.
 * The WHERE clause `balance >= amount` ensures we never go below 0.
 * Returns updated wallet row, or null if balance was insufficient.
 */
async function decrementBalance(walletId, amount, client) {
  const result = await client.query(
    `UPDATE wallets
     SET balance    = balance - $2,
         updated_at = NOW()
     WHERE id = $1
       AND balance >= $2
     RETURNING *`,
    [walletId, amount]
  );
  return result.rows[0] || null;
}

/**
 * Insert a transaction record.
 * Uses ON CONFLICT DO NOTHING so duplicate referenceId+type is silently ignored
 * (handled at service layer by checking rows affected).
 */
async function createTransaction(
  { walletId, userId, type, amount, status, referenceId, failureReason },
  client
) {
  const result = await client.query(
    `INSERT INTO transactions
       (wallet_id, user_id, type, amount, status, reference_id, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (reference_id, type) DO NOTHING
     RETURNING *`,
    [walletId, userId, type, amount, status, referenceId, failureReason || null]
  );
  return result.rows[0] || null;
}

/**
 * Find an existing transaction by referenceId + type (for idempotency check).
 */
async function findTransactionByReference(referenceId, type, client = pool) {
  const result = await client.query(
    `SELECT * FROM transactions
     WHERE reference_id = $1 AND type = $2`,
    [referenceId, type]
  );
  return result.rows[0] || null;
}

/**
 * Fetch last N transactions for a wallet, most recent first.
 */
async function getRecentTransactions(walletId, limit = 10, client = pool) {
  const result = await client.query(
    `SELECT * FROM transactions
     WHERE wallet_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [walletId, limit]
  );
  return result.rows;
}

module.exports = {
  createWallet,
  findWalletByUserId,
  findWalletByUserIdForUpdate,
  incrementBalance,
  decrementBalance,
  createTransaction,
  findTransactionByReference,
  getRecentTransactions,
};