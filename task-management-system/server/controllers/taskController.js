const Task = require('../models/Task');
const Team = require('../models/Team');
const User = require('../models/User');
const Department = require('../models/Department');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');
const { publicUrlFor } = require('../middlewares/uploadMiddleware');

/**
 * Visibility filter for the current user. Admin sees everything; HOD sees
 * tasks in their department or assigned to/by themselves; Employees see tasks
 * they assigned, are assigned to, or belong to a team that's assigned to.
 */
async function visibilityFilter(user) {
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

  // Employee
  const teams = await Team.find({ members: user._id }).select('_id');
  return {
    $or: [
      { assignedBy: user._id },
      { assignedToUser: user._id },
      { assignedToTeam: { $in: teams.map((t) => t._id) } },
    ],
  };
}

/**
 * GET /api/tasks
 * Filters: status, priority, department, assignedToUser, assignedToTeam, q,
 * overdue=true, page, limit, sort.
 */
exports.listTasks = asyncHandler(async (req, res) => {
  const {
    status, priority, department, assignedToUser, assignedToTeam, q,
    overdue, page = 1, limit = 20, sort = '-createdAt',
  } = req.query;

  const baseVisibility = await visibilityFilter(req.user);
  const filter = { ...baseVisibility };

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (department) filter.department = department;
  if (assignedToUser) filter.assignedToUser = assignedToUser;
  if (assignedToTeam) filter.assignedToTeam = assignedToTeam;
  if (q) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ],
      },
    ];
  }
  if (overdue === 'true') {
    filter.deadline = { $lt: new Date() };
    filter.status = { $ne: 'Completed' };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Task.find(filter)
      .populate('assignedBy', 'name email')
      .populate('assignedToUser', 'name email')
      .populate('assignedToTeam', 'name')
      .populate('department', 'name')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Task.countDocuments(filter),
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
 * POST /api/tasks
 * Admin or HOD only.
 */
exports.createTask = asyncHandler(async (req, res) => {
  const {
    title, description, assignedToUser, assignedToTeam, department,
    priority, deadline,
  } = req.body;

  if (!title) throw new AppError('title is required', 400);
  if (!assignedToUser && !assignedToTeam) {
    throw new AppError('assignedToUser or assignedToTeam is required', 400);
  }

  // HOD scoping: assignee must be in HOD's department.
  if (req.user.role === 'HOD') {
    if (assignedToUser) {
      const u = await User.findById(assignedToUser);
      if (!u || String(u.department) !== String(req.user.department)) {
        throw new AppError('HOD can only assign within own department', 403);
      }
    }
    if (assignedToTeam) {
      const t = await Team.findById(assignedToTeam);
      if (!t || String(t.department) !== String(req.user.department)) {
        throw new AppError('HOD can only assign within own department', 403);
      }
    }
  }

  // Resolve department if not given.
  let dept = department || null;
  if (!dept) {
    if (assignedToUser) {
      const u = await User.findById(assignedToUser).select('department');
      dept = u?.department || null;
    } else if (assignedToTeam) {
      const t = await Team.findById(assignedToTeam).select('department');
      dept = t?.department || null;
    }
  }

  const task = await Task.create({
    title,
    description: description || '',
    assignedBy: req.user._id,
    assignedToUser: assignedToUser || null,
    assignedToTeam: assignedToTeam || null,
    department: dept,
    priority: priority || 'Medium',
    deadline: deadline || null,
  });

  // Notify assignee(s).
  const targets = [];
  if (task.assignedToUser) targets.push(String(task.assignedToUser));
  if (task.assignedToTeam) {
    const team = await Team.findById(task.assignedToTeam).select('members');
    if (team) targets.push(...team.members.map(String));
  }

  await notificationService.notifyMany(targets, {
    type: 'task_assigned',
    title: 'New task assigned',
    message: `${req.user.name} assigned you "${task.title}"`,
    taskId: task._id,
    channels: { inApp: true, push: true, whatsapp: true },
  });

  await ActivityLog.create({
    user: req.user._id,
    action: 'task.create',
    entity: 'Task',
    entityId: task._id,
    details: { title, priority, deadline },
  });

  res.status(201).json({ success: true, task });
});

/**
 * GET /api/tasks/:id
 */
exports.getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('assignedBy', 'name email')
    .populate('assignedToUser', 'name email')
    .populate('assignedToTeam', 'name members')
    .populate('department', 'name')
    .populate('comments.user', 'name email role');
  if (!task) throw new AppError('Task not found', 404);

  // Visibility check.
  if (!(await canAccessTask(req.user, task))) {
    throw new AppError('Not authorised', 403);
  }

  res.json({ success: true, task });
});

/**
 * PUT /api/tasks/:id
 * Assigner or admin can edit any field; assignee can update status only.
 */
exports.updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  if (!(await canAccessTask(req.user, task))) {
    throw new AppError('Not authorised', 403);
  }

  const isAdmin = req.user.role === 'Admin';
  const isAssigner = String(task.assignedBy) === String(req.user._id);
  const isHODOfDept =
    req.user.role === 'HOD' &&
    String(task.department) === String(req.user.department);

  const canEditAll = isAdmin || isAssigner || isHODOfDept;

  if (canEditAll) {
    const fields = [
      'title', 'description', 'assignedToUser', 'assignedToTeam',
      'department', 'priority', 'deadline', 'status',
    ];
    for (const k of fields) if (req.body[k] !== undefined) task[k] = req.body[k];
  } else {
    // Assignee — can only update status.
    if (req.body.status === undefined) {
      throw new AppError('Only status can be updated by assignee', 403);
    }
    task.status = req.body.status;
  }

  if (task.status === 'Completed' && !task.completedAt) {
    task.completedAt = new Date();
  }
  if (task.status !== 'Completed') task.completedAt = null;

  await task.save();

  // Notify assigner on status change.
  if (req.body.status !== undefined) {
    await notificationService.notify({
      userId: task.assignedBy,
      type: task.status === 'Completed' ? 'task_completed' : 'task_updated',
      title: `Task ${task.status.toLowerCase()}`,
      message: `${req.user.name} marked "${task.title}" as ${task.status}`,
      taskId: task._id,
    });
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'task.update',
    entity: 'Task',
    entityId: task._id,
    details: req.body,
  });

  res.json({ success: true, task });
});

/**
 * DELETE /api/tasks/:id (Admin or assigner)
 */
exports.deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  const isAdmin = req.user.role === 'Admin';
  const isAssigner = String(task.assignedBy) === String(req.user._id);
  if (!isAdmin && !isAssigner) throw new AppError('Not authorised', 403);

  await task.deleteOne();
  await ActivityLog.create({
    user: req.user._id,
    action: 'task.delete',
    entity: 'Task',
    entityId: task._id,
  });
  res.json({ success: true });
});

/**
 * POST /api/tasks/:id/comments  { text }
 */
exports.addComment = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) throw new AppError('text is required', 400);

  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);
  if (!(await canAccessTask(req.user, task))) {
    throw new AppError('Not authorised', 403);
  }

  task.comments.push({ user: req.user._id, text: text.trim() });
  await task.save();

  // Notify assigner if commenter isn't the assigner.
  if (String(task.assignedBy) !== String(req.user._id)) {
    await notificationService.notify({
      userId: task.assignedBy,
      type: 'comment_added',
      title: 'New comment',
      message: `${req.user.name}: ${text.slice(0, 100)}`,
      taskId: task._id,
    });
  }

  res.status(201).json({ success: true, task });
});

/**
 * POST /api/tasks/:id/attachments  multipart/form-data (file)
 */
exports.uploadAttachment = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);
  if (!(await canAccessTask(req.user, task))) {
    throw new AppError('Not authorised', 403);
  }
  if (!req.file) throw new AppError('No file uploaded', 400);

  task.attachments.push({
    filename: req.file.originalname,
    url: publicUrlFor(req, req.file.filename),
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user._id,
  });
  await task.save();
  res.status(201).json({ success: true, task });
});

// --- helpers ---
async function canAccessTask(user, task) {
  if (user.role === 'Admin') return true;
  if (String(task.assignedBy) === String(user._id)) return true;
  if (String(task.assignedToUser) === String(user._id)) return true;
  if (
    user.role === 'HOD' &&
    String(task.department) === String(user.department)
  )
    return true;

  if (task.assignedToTeam) {
    const team = await Team.findById(task.assignedToTeam).select('members');
    if (team?.members?.map(String).includes(String(user._id))) return true;
  }
  return false;
}
