const AppError = require('../utils/AppError');

/**
 * Restrict a route to one or more roles.
 * Usage: router.post('/...', protect, restrictTo('Admin', 'HOD'), handler)
 */
const restrictTo = (...allowed) => (req, _res, next) => {
  if (!req.user) return next(new AppError('Not authenticated', 401));
  if (!allowed.includes(req.user.role)) {
    return next(
      new AppError(
        `Role '${req.user.role}' is not authorised for this action`,
        403
      )
    );
  }
  next();
};

module.exports = { restrictTo };
