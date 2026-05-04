const { verifyToken } = require('../utils/generateToken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verifies the Bearer JWT and attaches a fresh User doc to req.user.
 */
const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw new AppError('Not authenticated', 401);

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user || !user.isActive) {
    throw new AppError('User no longer exists or is disabled', 401);
  }

  req.user = user;
  next();
});

module.exports = { protect };
