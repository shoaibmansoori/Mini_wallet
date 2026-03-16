const logger = require('../config/logger');

/**
 * Centralized error-handling middleware.
 * Express identifies this as an error handler because it has 4 params (err, req, res, next).
 */
function errorHandler(err, req, res, next) {
  // Log unexpected errors (not client errors like 404/422)
  if (!err.statusCode || err.statusCode >= 500) {
    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  const statusCode = err.statusCode || 500;

  const body = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  };

  // For insufficient balance, include transaction and balance in the response
  // so callers can inspect the failed transaction record
  if (err.code === 'INSUFFICIENT_BALANCE') {
    body.data = {
      transaction: err.transaction,
      balance: err.balance,
    };
  }

  return res.status(statusCode).json(body);
}

/**
 * 404 handler — must be registered after all routes.
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

module.exports = { errorHandler, notFoundHandler };