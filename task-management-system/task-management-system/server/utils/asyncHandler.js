/**
 * Wrap async route handlers so thrown errors hit the central error middleware
 * without needing try/catch in every controller.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
