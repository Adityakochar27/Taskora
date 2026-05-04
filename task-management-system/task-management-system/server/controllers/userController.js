const User = require('../models/User');
const Department = require('../models/Department');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/users?role=&department=&q=&page=&limit=
 * Admin: org-wide. HOD: scoped to own department. Employee: not allowed.
 */
exports.listUsers = asyncHandler(async (req, res) => {
  const { role, department, q, page = 1, limit = 25 } = req.query;
  const filter = { isActive: true };

  if (role) filter.role = role;
  if (department) filter.department = department;

  if (req.user.role === 'HOD') {
    if (!req.user.department) {
      throw new AppError('HOD has no department assigned', 400);
    }
    filter.department = req.user.department;
  }

  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    User.find(filter)
      .select('-password -fcmTokens')
      .populate('department', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

/**
 * POST /api/users  (Admin only) — create HOD or Employee accounts.
 */
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, phone } = req.body;
  if (!name || !email || !password || !role) {
    throw new AppError('name, email, password, role are required', 400);
  }
  if (!['HOD', 'Employee', 'Admin'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }
  if (await User.findOne({ email: email.toLowerCase() })) {
    throw new AppError('Email already registered', 409);
  }
  let dept = null;
  if (department) {
    dept = await Department.findById(department);
    if (!dept) throw new AppError('Department not found', 400);
  }
  const user = await User.create({
    name, email, password, role,
    department: dept?._id || null,
    phone: phone || '',
  });
  await ActivityLog.create({
    user: req.user._id,
    action: 'user.create',
    entity: 'User',
    entityId: user._id,
    details: { role, department: dept?._id },
  });
  res.status(201).json({ success: true, user: user.toSafeJSON() });
});

/**
 * GET /api/users/:id
 */
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -fcmTokens')
    .populate('department', 'name');
  if (!user) throw new AppError('User not found', 404);

  // HODs limited to own department; employees can only see themselves.
  if (req.user.role === 'HOD') {
    if (String(user.department?._id) !== String(req.user.department)) {
      throw new AppError('Not authorised', 403);
    }
  } else if (req.user.role === 'Employee') {
    if (String(user._id) !== String(req.user._id)) {
      throw new AppError('Not authorised', 403);
    }
  }

  res.json({ success: true, user });
});

/**
 * PUT /api/users/:id
 * Admin: any user. HOD: employees in their dept. Employee: self (limited fields).
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) throw new AppError('User not found', 404);

  const isSelf = String(target._id) === String(req.user._id);
  const isAdmin = req.user.role === 'Admin';
  const isHODScope =
    req.user.role === 'HOD' &&
    String(target.department) === String(req.user.department);

  if (!isAdmin && !isHODScope && !isSelf) {
    throw new AppError('Not authorised', 403);
  }

  const allowed = isAdmin
    ? ['name', 'email', 'role', 'department', 'phone', 'isActive', 'password']
    : isHODScope
      ? ['name', 'phone', 'isActive']
      : ['name', 'phone', 'password'];

  for (const k of allowed) {
    if (req.body[k] !== undefined) target[k] = req.body[k];
  }

  await target.save();

  await ActivityLog.create({
    user: req.user._id,
    action: 'user.update',
    entity: 'User',
    entityId: target._id,
    details: Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, k === 'password' ? '***' : req.body[k]])),
  });

  res.json({ success: true, user: target.toSafeJSON() });
});

/**
 * DELETE /api/users/:id (soft) — Admin only
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new AppError('User not found', 404);
  u.isActive = false;
  await u.save();

  await ActivityLog.create({
    user: req.user._id,
    action: 'user.delete',
    entity: 'User',
    entityId: u._id,
  });

  res.json({ success: true });
});
