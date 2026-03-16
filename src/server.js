require('dotenv').config();
const app = require('./app');
const { initializeDatabase } = require('./models/schema');
const logger = require('./config/logger');

const PORT = parseInt(process.env.PORT) || 7201;

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      logger.info(`Mini Wallet Service running on port ${PORT}`, {
        env: process.env.NODE_ENV || 'development',
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  process.exit(0);
});

start();