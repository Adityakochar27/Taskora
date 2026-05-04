const User = require('../models/User');
const Department = require('../models/Department');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { generateToken } = require('../utils/generateToken');

/**
 * POST /api/auth/signup
 * Public signup. The first Admin can be created if ADMIN_SIGNUP_KEY matches;
 * after that, admin/HOD creation should go through the user management API.
 */
exports.signup = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, phone, adminKey } = req.body;

  if (!name || !email || !password) {
    throw new AppError('name, email and password are required', 400);
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  let finalRole = 'Employee';
  if (role && role !== 'Employee') {
    if (role === 'Admin') {
      const anyAdmin = await User.findOne({ role: 'Admin' });
      if (anyAdmin) {
        // After the first admin, only an existing admin can mint admins —
        // use POST /api/users with an admin token instead.
        throw new AppError('Admin signup is closed; ask an existing admin', 403);
      }
      if (process.env.ADMIN_SIGNUP_KEY && adminKey !== process.env.ADMIN_SIGNUP_KEY) {
        throw new AppError('Invalid admin signup key', 403);
      }
      finalRole = 'Admin';
    } else {
      // HOD signup is intentionally locked to admin-issued accounts.
      throw new AppError(
        'HOD accounts are created by an Admin. Please request access.',
        403
      );
    }
  }

  if (await User.findOne({ email: email.toLowerCase() })) {
    throw new AppError('Email is already registered', 409);
  }

  let dept = null;
  if (department) {
    dept = await Department.findById(department);
    if (!dept) throw new AppError('Department not found', 400);
  }

  const user = await User.create({
    name,
    email,
    password,
    role: finalRole,
    department: dept?._id || null,
    phone: phone || '',
  });

  await ActivityLog.create({
    user: user._id,
    action: 'auth.signup',
    entity: 'User',
    entityId: user._id,
    ip: req.ip,
  });

  const token = generateToken({ id: user._id, role: user.role });
  res.status(201).json({
    success: true,
    token,
    user: user.toSafeJSON(),
  });
});

/**
 * POST /api/auth/login
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required', 400);

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !user.isActive) throw new AppError('Invalid credentials', 401);

  const ok = await user.comparePassword(password);
  if (!ok) throw new AppError('Invalid credentials', 401);

  user.lastLoginAt = new Date();
  await user.save();

  await ActivityLog.create({
    user: user._id,
    action: 'auth.login',
    entity: 'User',
    entityId: user._id,
    ip: req.ip,
  });

  const token = generateToken({ id: user._id, role: user.role });
  res.json({ success: true, token, user: user.toSafeJSON() });
});

/**
 * GET /api/auth/me
 */
exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('department', 'name');
  res.json({ success: true, user });
});

/**
 * POST /api/auth/fcm-token   { token }
 * Persists a device token for push notifications.
 */
exports.registerFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new AppError('token is required', 400);
  await User.updateOne(
    { _id: req.user._id },
    { $addToSet: { fcmTokens: token } }
  );
  res.json({ success: true });
});

/**
 * POST /api/auth/fcm-token/remove   { token }
 */
exports.removeFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new AppError('token is required', 400);
  await User.updateOne(
    { _id: req.user._id },
    { $pull: { fcmTokens: token } }
  );
  res.json({ success: true });
});
