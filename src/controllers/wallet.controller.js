const WalletService = require('../services/wallet.service');


async function createWallet(req, res, next) {
  try {
    const { userId } = req.body;
    const wallet = await WalletService.createWallet(userId);
    return res.status(201).json({
      success: true,
      message: 'Wallet created successfully',
      data: { wallet },
    });
  } catch (err) {
    next(err);
  }
}

async function creditWallet(req, res, next) {
  try {
    const { userId } = req.params;
    const { amount, referenceId } = req.body;

    const result = await WalletService.creditWallet(userId, parseFloat(amount), referenceId.trim());

    // 200 for idempotent replay, 201 for new credit
    const statusCode = result.idempotent ? 200 : 201;

    return res.status(statusCode).json({
      success: true,
      message: result.idempotent ? 'Duplicate request — returning existing result' : 'Wallet credited successfully',
      data: {
        transaction: result.transaction,
        balance: result.balance,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function debitWallet(req, res, next) {
  try {
    const { userId } = req.params;
    const { amount, referenceId } = req.body;

    const result = await WalletService.debitWallet(userId, parseFloat(amount), referenceId.trim());

    const statusCode = result.idempotent ? 200 : 201;

    return res.status(statusCode).json({
      success: true,
      message: result.idempotent ? 'Duplicate request — returning existing result' : 'Wallet debited successfully',
      data: {
        transaction: result.transaction,
        balance: result.balance,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getWallet(req, res, next) {
  try {
    const { userId } = req.params;
    const result = await WalletService.getWalletDetails(userId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createWallet, creditWallet, debitWallet, getWallet };