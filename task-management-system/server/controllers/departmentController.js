const Department = require('../models/Department');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/departments
 */
exports.listDepartments = asyncHandler(async (_req, res) => {
  const items = await Department.find({ isActive: true })
    .populate('hod', 'name email role')
    .sort({ name: 1 });
  res.json({ success: true, data: items });
});

/**
 * POST /api/departments  (Admin)
 */
exports.createDepartment = asyncHandler(async (req, res) => {
  const { name, description, hod } = req.body;
  if (!name) throw new AppError('name is required', 400);

  if (hod) {
    const hodUser = await User.findById(hod);
    if (!hodUser) throw new AppError('HOD user not found', 400);
    if (hodUser.role !== 'HOD' && hodUser.role !== 'Admin') {
      throw new AppError('Selected user is not a HOD', 400);
    }
  }

  const dept = await Department.create({ name, description, hod: hod || null });

  if (hod) {
    await User.updateOne({ _id: hod }, { department: dept._id });
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'department.create',
    entity: 'Department',
    entityId: dept._id,
  });

  res.status(201).json({ success: true, department: dept });
});

/**
 * GET /api/departments/:id
 */
exports.getDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id).populate(
    'hod', 'name email'
  );
  if (!dept) throw new AppError('Department not found', 404);
  const employees = await User.find({
    department: dept._id, isActive: true,
  }).select('name email role');
  res.json({ success: true, department: dept, employees });
});

/**
 * PUT /api/departments/:id  (Admin)
 */
exports.updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw new AppError('Department not found', 404);

  const { name, description, hod, isActive } = req.body;
  if (name !== undefined) dept.name = name;
  if (description !== undefined) dept.description = description;
  if (isActive !== undefined) dept.isActive = isActive;
  if (hod !== undefined) {
    if (hod) {
      const hodUser = await User.findById(hod);
      if (!hodUser) throw new AppError('HOD user not found', 400);
      await User.updateOne({ _id: hod }, { department: dept._id });
    }
    dept.hod = hod || null;
  }
  await dept.save();
  res.json({ success: true, department: dept });
});

/**
 * DELETE /api/departments/:id (soft) (Admin)
 */
exports.deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw new AppError('Department not found', 404);
  dept.isActive = false;
  await dept.save();
  res.json({ success: true });
});
