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

// ─────────────────────────────────────────────────────────────────────────
// Contacts — per-user "people I work with" list. Used to filter the
// assignment / chat picker by default. Doesn't change RBAC (admins can still
// see everyone via the "Show all" toggle on the picker), it's a UI default.
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /api/users/:id/contacts
 * Returns the populated contact list for the user. Self-only unless Admin.
 */
exports.listContacts = asyncHandler(async (req, res) => {
  const isSelf = String(req.params.id) === String(req.user._id);
  if (!isSelf && req.user.role !== 'Admin') {
    throw new AppError('Not authorised', 403);
  }

  const u = await User.findById(req.params.id)
    .populate({
      path: 'contacts',
      match: { isActive: true },
      select: 'name email role department',
      populate: { path: 'department', select: 'name' },
    });

  if (!u) throw new AppError('User not found', 404);
  res.json({ success: true, data: u.contacts || [] });
});

/**
 * POST /api/users/:id/contacts  { contactId }   (or { contactIds: [] } for bulk)
 * Adds one or more users to this user's contact list.
 */
exports.addContacts = asyncHandler(async (req, res) => {
  const isSelf = String(req.params.id) === String(req.user._id);
  if (!isSelf && req.user.role !== 'Admin') {
    throw new AppError('Not authorised', 403);
  }

  const ids = req.body.contactIds || (req.body.contactId ? [req.body.contactId] : []);
  if (!ids.length) throw new AppError('contactId or contactIds is required', 400);

  // Validate the candidate users exist and are active.
  const candidates = await User.find({ _id: { $in: ids }, isActive: true }).select('_id');
  const validIds = candidates.map((c) => String(c._id));
  if (!validIds.length) throw new AppError('No valid users to add', 400);

  const u = await User.findById(req.params.id);
  if (!u) throw new AppError('User not found', 404);

  const existing = new Set(u.contacts.map(String));
  // Don't allow adding self.
  validIds.forEach((id) => {
    if (id !== String(u._id)) existing.add(id);
  });
  u.contacts = Array.from(existing);
  await u.save();

  res.json({ success: true, count: u.contacts.length });
});

/**
 * DELETE /api/users/:id/contacts/:contactId
 */
exports.removeContact = asyncHandler(async (req, res) => {
  const { id, contactId } = req.params;
  const isSelf = String(id) === String(req.user._id);
  if (!isSelf && req.user.role !== 'Admin') {
    throw new AppError('Not authorised', 403);
  }

  const u = await User.findById(id);
  if (!u) throw new AppError('User not found', 404);

  const before = u.contacts.length;
  u.contacts = u.contacts.filter((c) => String(c) !== String(contactId));
  if (u.contacts.length === before) {
    throw new AppError('Contact not found in list', 404);
  }
  await u.save();
  res.json({ success: true });
});

/**
 * GET /api/users/picker?all=false&q=&role=
 *
 * Returns the filtered list to populate assignment / chat dropdowns.
 *  - Default (all=false): just the requester's contacts (with self excluded).
 *  - all=true: full org (still filtered by role-based visibility — HOD only
 *    sees own dept, Employee sees own team + dept, Admin sees everyone).
 *
 * This is the canonical endpoint the frontend's <ContactPicker> hits — keeps
 * UI logic simple and prevents the client from having to reason about RBAC.
 */
exports.picker = asyncHandler(async (req, res) => {
  const all = req.query.all === 'true';
  const { q, role } = req.query;

  const me = await User.findById(req.user._id).populate('contacts', '_id');
  const baseSelect = '-password -fcmTokens -contacts';

  let filter;
  if (!all) {
    // Just contacts.
    const contactIds = (me.contacts || []).map((c) => c._id);
    filter = { _id: { $in: contactIds }, isActive: true };
  } else {
    // Full org, filtered by RBAC.
    filter = { isActive: true, _id: { $ne: req.user._id } };
    if (req.user.role === 'HOD') {
      filter.department = req.user.department;
    } else if (req.user.role === 'Employee') {
      // Employees see: their dept + team-mates.
      const teamMates = await require('../models/Team').find({ members: req.user._id })
        .distinct('members');
      filter.$or = [
        { department: req.user.department },
        { _id: { $in: teamMates } },
      ];
    }
  }

  if (role) filter.role = role;
  if (q) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      },
    ];
  }

  const users = await User.find(filter)
    .select(baseSelect)
    .populate('department', 'name')
    .sort({ name: 1 })
    .limit(100);

  res.json({
    success: true,
    data: users,
    scope: all ? 'all' : 'contacts',
  });
});
