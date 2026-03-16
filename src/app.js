require('dotenv').config();
const express = require('express');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const walletRoutes = require('./routes/wallet.routes');
const logger = require('./config/logger');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

//Rate Limiting (global) 
app.use(apiLimiter);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { body: req.body, params: req.params });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/wallets', walletRoutes);

app.use(notFoundHandler);
app.use(errorHandler);


module.exports = app;