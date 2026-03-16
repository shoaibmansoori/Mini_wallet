const { body, param, validationResult } = require('express-validator');

/**
 * Centralized validation error handler.
 * Always called after a validation chain.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: errors.array().map((e) => ({
          field: e.path,
          message: e.msg,
        })),
      },
    });
  }
  next();
}

// ─── Validation Chains ────────────────────────────────────────────────────────

const validateCreateWallet = [
  body('userId')
    .trim()
    .notEmpty().withMessage('userId is required')
    .isString().withMessage('userId must be a string')
    .isLength({ min: 1, max: 255 }).withMessage('userId must be 1–255 characters'),
  handleValidationErrors,
];

const validateCredit = [
  param('userId')
    .trim()
    .notEmpty().withMessage('userId param is required'),
  body('amount')
    .notEmpty().withMessage('amount is required')
    .isFloat({ gt: 0 }).withMessage('amount must be a number greater than 0')
    .custom((val) => {
      // Guard against floating-point precision abuse (max 2 decimal places)
      if (!/^\d+(\.\d{1,2})?$/.test(String(val))) {
        throw new Error('amount must have at most 2 decimal places');
      }
      return true;
    }),
  body('referenceId')
    .trim()
    .notEmpty().withMessage('referenceId is required')
    .isString().withMessage('referenceId must be a string')
    .isLength({ min: 1, max: 255 }).withMessage('referenceId must be 1–255 characters'),
  handleValidationErrors,
];

const validateDebit = [
  param('userId')
    .trim()
    .notEmpty().withMessage('userId param is required'),
  body('amount')
    .notEmpty().withMessage('amount is required')
    .isFloat({ gt: 0 }).withMessage('amount must be a number greater than 0')
    .custom((val) => {
      if (!/^\d+(\.\d{1,2})?$/.test(String(val))) {
        throw new Error('amount must have at most 2 decimal places');
      }
      return true;
    }),
  body('referenceId')
    .trim()
    .notEmpty().withMessage('referenceId is required')
    .isString().withMessage('referenceId must be a string')
    .isLength({ min: 1, max: 255 }).withMessage('referenceId must be 1–255 characters'),
  handleValidationErrors,
];

const validateGetWallet = [
  param('userId')
    .trim()
    .notEmpty().withMessage('userId param is required'),
  handleValidationErrors,
];

module.exports = {
  validateCreateWallet,
  validateCredit,
  validateDebit,
  validateGetWallet,
};