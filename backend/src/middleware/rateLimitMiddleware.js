const rateLimit = require('express-rate-limit');

const API_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const API_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX || 300);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX || 8);

const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  max: API_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please try again later.'
  }
});

const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.DISABLE_AUTH === 'true',
  skipSuccessfulRequests: true,
  message: {
    message: 'Too many login attempts. Please wait before retrying.'
  }
});

module.exports = {
  apiLimiter,
  loginLimiter
};
