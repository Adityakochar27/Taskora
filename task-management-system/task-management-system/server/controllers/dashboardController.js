const Task = require('../models/Task');
const User = require('../models/User');
const Department = require('../models/Department');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/dashboard/summary
 * Org-wide for Admin, department-scoped for HOD, personal for Employee.
 */
exports.summary = asyncHandler(async (req, res) => {
  const role = req.user.role;
  const baseFilter = await scopedTaskFilter(req.user);

  const [total, byStatus, byPriority, overdue] = await Promise.all([
    Task.countDocuments(baseFilter),
    Task.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Task.countDocuments({
      ...baseFilter,
      status: { $ne: 'Completed' },
      deadline: { $lt: new Date() },
    }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((b) => [b._id, b.count]));
  const completed = statusMap.Completed || 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

  let perDepartment = [];
  if (role === 'Admin') {
    perDepartment = await Task.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'Completed'] },
                    { $lt: ['$deadline', new Date()] },
                  ],
                },
                1, 0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          department: '$department.name',
          total: 1, completed: 1, overdue: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  res.json({
    success: true,
    summary: {
      total,
      byStatus: statusMap,
      byPriority: Object.fromEntries(byPriority.map((b) => [b._id, b.count])),
      overdue,
      completionRate,
      perDepartment,
    },
  });
});

/**
 * GET /api/dashboard/productivity?days=30
 * Per-employee completion stats (Admin or HOD).
 */
exports.productivity = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 30), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const baseFilter = await scopedTaskFilter(req.user);

  const data = await Task.aggregate([
    {
      $match: {
        ...baseFilter,
        createdAt: { $gte: since },
        assignedToUser: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$assignedToUser',
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
        },
        onTime: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Completed'] },
                  { $lte: ['$completedAt', '$deadline'] },
                ],
              }, 1, 0,
            ],
          },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$status', 'Completed'] },
                  { $lt: ['$deadline', new Date()] },
                ],
              }, 1, 0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        name: '$user.name',
        email: '$user.email',
        role: '$user.role',
        total: 1, completed: 1, onTime: 1, overdue: 1,
        completionRate: {
          $cond: [
            { $eq: ['$total', 0] }, 0,
            { $multiply: [{ $divide: ['$completed', '$total'] }, 100] },
          ],
        },
      },
    },
    { $sort: { completionRate: -1, completed: -1 } },
  ]);

  res.json({ success: true, days, data });
});

/**
 * GET /api/dashboard/activity?limit=50
 */
exports.activity = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const filter = req.user.role === 'Admin' ? {} : { user: req.user._id };
  const logs = await ActivityLog.find(filter)
    .populate('user', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json({ success: true, data: logs });
});

// --- helper: same scoping logic as taskController.visibilityFilter ---
async function scopedTaskFilter(user) {
  if (user.role === 'Admin') return {};
  if (user.role === 'HOD') {
    return {
      $or: [
        { department: user.department },
        { assignedBy: user._id },
        { assignedToUser: user._id },
      ],
    };
  }
  // Employee — personal view only.
  return {
    $or: [{ assignedBy: user._id }, { assignedToUser: user._id }],
  };
}
