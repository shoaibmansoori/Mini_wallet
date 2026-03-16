const { Router } = require('express');
const WalletController = require('../controllers/wallet.controller');
const {
  validateCreateWallet,
  validateCredit,
  validateDebit,
  validateGetWallet,
} = require('../middleware/validation');
const { writeLimiter } = require('../middleware/rateLimiter');
4
const router = Router();

// add wallet
router.post('/', validateCreateWallet, WalletController.createWallet);

// get latest transaction
router.get('/:userId', validateGetWallet, WalletController.getWallet);

// credit 
router.post('/:userId/credit', writeLimiter, validateCredit, WalletController.creditWallet);

// debit
router.post('/:userId/debit', writeLimiter, validateDebit, WalletController.debitWallet);

module.exports = router;