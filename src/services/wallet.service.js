const pool = require('../config/database');
const WalletModel = require('../models/wallet.model');
const logger = require('../config/logger');


async function createWallet(userId) {
  // Trim and validate userId is a non-empty string
  const sanitizedUserId = String(userId).trim();

  const wallet = await WalletModel.createWallet(sanitizedUserId);

  if (!wallet) {
    // ON CONFLICT DO NOTHING returned 0 rows → wallet already exists
    const error = new Error(`Wallet already exists for userId: ${sanitizedUserId}`);
    error.statusCode = 409;
    error.code = 'WALLET_ALREADY_EXISTS';
    throw error;
  }

  logger.info('Wallet created', { userId: sanitizedUserId, walletId: wallet.id });
  return formatWallet(wallet);
}

// Credit Wallet 
async function creditWallet(userId, amount, referenceId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the wallet row to prevent concurrent balance corruption
    const wallet = await WalletModel.findWalletByUserIdForUpdate(userId, client);
    if (!wallet) {
      await client.query('ROLLBACK');
      const error = new Error(`Wallet not found for userId: ${userId}`);
      error.statusCode = 404;
      error.code = 'WALLET_NOT_FOUND';
      throw error;
    }

    // 2. Idempotency check — if this referenceId was already processed, return it
    const existingTx = await WalletModel.findTransactionByReference(referenceId, 'CREDIT', client);
    if (existingTx) {
      await client.query('ROLLBACK');
      logger.info('Duplicate credit referenceId — returning existing result', {
        referenceId,
        userId,
      });
      return {
        idempotent: true,
        transaction: formatTransaction(existingTx),
        balance: parseFloat(wallet.balance),
      };
    }

    // 3. Increment balance
    const updatedWallet = await WalletModel.incrementBalance(wallet.id, amount, client);

    // 4. Record successful transaction
    const transaction = await WalletModel.createTransaction(
      {
        walletId: wallet.id,
        userId,
        type: 'CREDIT',
        amount,
        status: 'SUCCESS',
        referenceId,
        failureReason: null,
      },
      client
    );

    await client.query('COMMIT');

    logger.info('Credit successful', { userId, amount, referenceId, newBalance: updatedWallet.balance });

    return {
      idempotent: false,
      transaction: formatTransaction(transaction),
      balance: parseFloat(updatedWallet.balance),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    // Re-throw known app errors, wrap unknown ones
    if (err.statusCode) throw err;
    logger.error('Credit transaction failed', { userId, amount, referenceId, error: err.message });
    throw new Error('Internal error during credit operation');
  } finally {
    client.release();
  }
}

//Debit Wallet

async function debitWallet(userId, amount, referenceId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock wallet row — serializes all concurrent debits for this user
    const wallet = await WalletModel.findWalletByUserIdForUpdate(userId, client);
    if (!wallet) {
      await client.query('ROLLBACK');
      const error = new Error(`Wallet not found for userId: ${userId}`);
      error.statusCode = 404;
      error.code = 'WALLET_NOT_FOUND';
      throw error;
    }

    // 2. Idempotency check
    const existingTx = await WalletModel.findTransactionByReference(referenceId, 'DEBIT', client);
    if (existingTx) {
      await client.query('ROLLBACK');
      logger.info('Duplicate debit referenceId — returning existing result', {
        referenceId,
        userId,
      });
      return {
        idempotent: true,
        transaction: formatTransaction(existingTx),
        balance: parseFloat(wallet.balance),
      };
    }

    // 3. Attempt atomic balance decrement
    //    decrementBalance uses WHERE balance >= amount, so this is safe even
    //    if two transactions reach this point simultaneously (one will get null back)
    const currentBalance = parseFloat(wallet.balance);
    const updatedWallet = await WalletModel.decrementBalance(wallet.id, amount, client);

    let transaction;

    if (!updatedWallet) {
      // Insufficient funds — still record a FAILED transaction as required
      transaction = await WalletModel.createTransaction(
        {
          walletId: wallet.id,
          userId,
          type: 'DEBIT',
          amount,
          status: 'FAILED',
          referenceId,
          failureReason: `Insufficient balance. Current: ${currentBalance}, Requested: ${amount}`,
        },
        client
      );

      await client.query('COMMIT');

      logger.warn('Debit failed — insufficient balance', {
        userId,
        amount,
        referenceId,
        currentBalance,
      });

      const error = new Error('Insufficient balance');
      error.statusCode = 422;
      error.code = 'INSUFFICIENT_BALANCE';
      error.transaction = formatTransaction(transaction);
      error.balance = currentBalance;
      throw error;
    }

    // 4. Record successful debit transaction
    transaction = await WalletModel.createTransaction(
      {
        walletId: wallet.id,
        userId,
        type: 'DEBIT',
        amount,
        status: 'SUCCESS',
        referenceId,
        failureReason: null,
      },
      client
    );

    await client.query('COMMIT');

    logger.info('Debit successful', {
      userId,
      amount,
      referenceId,
      newBalance: updatedWallet.balance,
    });

    return {
      idempotent: false,
      transaction: formatTransaction(transaction),
      balance: parseFloat(updatedWallet.balance),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.statusCode) throw err;
    logger.error('Debit transaction failed', { userId, amount, referenceId, error: err.message });
    throw new Error('Internal error during debit operation');
  } finally {
    client.release();
  }
}

// Get Wallet Details

async function getWalletDetails(userId) {
  const wallet = await WalletModel.findWalletByUserId(userId);
  if (!wallet) {
    const error = new Error(`Wallet not found for userId: ${userId}`);
    error.statusCode = 404;
    error.code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const transactions = await WalletModel.getRecentTransactions(wallet.id, 10);

  return {
    wallet: formatWallet(wallet),
    transactions: transactions.map(formatTransaction),
  };
}

// Formatters

function formatWallet(wallet) {
  return {
    id: wallet.id,
    userId: wallet.user_id,
    balance: parseFloat(wallet.balance),
    createdAt: wallet.created_at,
    updatedAt: wallet.updated_at,
  };
}

function formatTransaction(tx) {
  return {
    id: tx.id,
    type: tx.type,
    amount: parseFloat(tx.amount),
    status: tx.status,
    referenceId: tx.reference_id,
    failureReason: tx.failure_reason || null,
    createdAt: tx.created_at,
  };
}

module.exports = {
  createWallet,
  creditWallet,
  debitWallet,
  getWalletDetails,
};