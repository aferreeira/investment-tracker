// rateLimitMiddleware.js - Rate limiting middleware for API protection
const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => req.ip
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => req.ip
});

/**
 * Strict rate limiter for API token requests
 * 10 requests per 5 minutes per user
 */
const apiTokenLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many token requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => req.userId || req.ip
});

/**
 * Custom rate limiter for data fetch requests
 * Limits by user ID to prevent abuse of data endpoints
 */
const dataFetchLimiter = (maxRequests = 50, windowMs = 60 * 1000) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: 'Too many data requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => req.userId || req.ip
  });
};

/**
 * Rate limiter for quote fetch requests
 * Limit external API calls to prevent excessive billing
 */
const quoteFetchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Quote fetch rate limit exceeded. Please wait before fetching more quotes.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => `quotes:${req.userId || req.ip}`
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiTokenLimiter,
  dataFetchLimiter,
  quoteFetchLimiter
};
