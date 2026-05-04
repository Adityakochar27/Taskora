const Task = require('../models/Task');
const Team = require('../models/Team');
const User = require('../models/User');
const Department = require('../models/Department');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');
const storageService = require('../services/storageService');

/**
 * Visibility filter — what tasks the current user is allowed to see.
 * Admin sees all; HOD sees their dept + own; Employee sees what they
 * assigned, were assigned, or are team-members of.
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
      { originalAssignedTo: user._id },           // see tasks they delegated away
      { assignedToTeam: { $in: teams.map((t) => t._id) } },
    ],
  };
}

async function canAccessTask(user, task) {
  if (user.role === 'Admin') return true;
  if (String(task.assignedBy) === String(user._id)) return true;
  if (String(task.assignedToUser) === String(user._id)) return true;
  if (String(task.originalAssignedTo) === String(user._id)) return true;
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

/**
 * Returns the user IDs that should be notified about a state change on this
 * task (any change other than the actor themselves). Includes:
 *   - Original assigner (assignedBy)
 *   - Original assignee (originalAssignedTo) — for delegated tasks
 *   - Current assignee (assignedToUser)
 *   - All admins (so they're always in the loop, per user request)
 *   - Team members if it's a team task
 *
 * Caller passes `excludeUserId` to skip the actor.
 */
async function fanoutAudience(task, excludeUserId) {
  const ids = new Set();
  if (task.assignedBy) ids.add(String(task.assignedBy));
  if (task.originalAssignedTo) ids.add(String(task.originalAssignedTo));
  if (task.assignedToUser) ids.add(String(task.assignedToUser));

  if (task.assignedToTeam) {
    const team = await Team.findById(task.assignedToTeam).select('members');
    if (team) team.members.forEach((m) => ids.add(String(m)));
  }

  // All admins.
  const admins = await User.find({ role: 'Admin', isActive: true }).select('_id');
  admins.forEach((a) => ids.add(String(a._id)));

  if (excludeUserId) ids.delete(String(excludeUserId));
  return Array.from(ids);
}

// ─────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────

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
      .populate('originalAssignedTo', 'name email')
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
 * POST /api/tasks  (Admin / HOD)
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

  // HOD scoping
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

  // Notify assignee(s)
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
    .populate('assignedToUser', 'name email role')
    .populate('originalAssignedTo', 'name email')
    .populate('assignedToTeam', 'name members')
    .populate('department', 'name')
    .populate('comments.user', 'name email role')
    .populate('delegationHistory.fromUser', 'name email')
    .populate('delegationHistory.toUser', 'name email');
  if (!task) throw new AppError('Task not found', 404);

  if (!(await canAccessTask(req.user, task))) {
    throw new AppError('Not authorised', 403);
  }

  res.json({ success: true, task });
});

/**
 * PUT /api/tasks/:id
 *
 * Permission tiers:
 *   - Status field: only the current assignee can move it FORWARD
 *     (Pending → In Progress → Completed). Admin can override (logged).
 *     The assigner can move it BACKWARD (Completed → In Progress) if work
 *     is sub-par.
 *   - Other fields (title, description, priority, deadline, assignment):
 *     Admin / assigner / HOD-of-dept only.
 */
exports.updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);
  if (!(await canAccessTask(req.user, task))) {
    throw new AppError('Not authorised', 403);
  }

  const isAdmin = req.user.role === 'Admin';
  const isAssigner = String(task.assignedBy) === String(req.user._id);
  const isAssignee = String(task.assignedToUser) === String(req.user._id);
  const isHODOfDept =
    req.user.role === 'HOD' &&
    String(task.department) === String(req.user.department);

  const canEditMetadata = isAdmin || isAssigner || isHODOfDept;
  const onlyStatusUpdate =
    Object.keys(req.body).length === 1 && req.body.status !== undefined;

  // ──────────── STATUS-ONLY PATH ────────────
  if (onlyStatusUpdate) {
    const newStatus = req.body.status;
    const oldStatus = task.status;

    if (!Task.STATUS.includes(newStatus)) {
      throw new AppError(`Invalid status: ${newStatus}`, 400);
    }

    const STATUS_ORDER = ['Pending', 'In Progress', 'Completed'];
    const oldIdx = STATUS_ORDER.indexOf(oldStatus);
    const newIdx = STATUS_ORDER.indexOf(newStatus);
    const movingForward = newIdx > oldIdx;
    const movingBackward = newIdx < oldIdx;

    let allowed = false;
    let viaOverride = false;

    if (movingForward) {
      // Forward: assignee only, admin override allowed.
      if (isAssignee) allowed = true;
      else if (isAdmin) { allowed = true; viaOverride = true; }
    } else if (movingBackward) {
      // Backward: assigner or admin (assigner reverting their own task).
      if (isAssigner || isAdmin) {
        allowed = true;
        viaOverride = isAdmin && !isAssigner;
      }
    } else {
      // No-op.
      return res.json({ success: true, task });
    }

    if (!allowed) {
      throw new AppError(
        movingForward
          ? 'Only the assigned employee can advance the task. Admin can override.'
          : 'Only the assigner can revert task status.',
        403
      );
    }

    task.status = newStatus;
    if (newStatus === 'Completed') task.completedAt = new Date();
    else task.completedAt = null;
    await task.save();

    // Notify everyone except the actor.
    const audience = await fanoutAudience(task, req.user._id);
    const overrideTag = viaOverride ? ' (Admin override)' : '';
    await notificationService.notifyMany(audience, {
      type: newStatus === 'Completed' ? 'task_completed' : 'task_updated',
      title: `Task ${newStatus.toLowerCase()}`,
      message: `${req.user.name} marked "${task.title}" as ${newStatus}${overrideTag}`,
      taskId: task._id,
    });

    await ActivityLog.create({
      user: req.user._id,
      action: viaOverride ? 'task.status.override' : 'task.status',
      entity: 'Task',
      entityId: task._id,
      details: { from: oldStatus, to: newStatus, override: viaOverride },
    });

    return res.json({ success: true, task });
  }

  // ──────────── METADATA PATH ────────────
  if (!canEditMetadata) {
    throw new AppError(
      'Only the assigner, an Admin, or department HOD can edit task details',
      403
    );
  }

  const fields = [
    'title', 'description', 'assignedToUser', 'assignedToTeam',
    'department', 'priority', 'deadline', 'status',
  ];
  for (const k of fields) if (req.body[k] !== undefined) task[k] = req.body[k];

  if (task.status === 'Completed' && !task.completedAt) task.completedAt = new Date();
  if (task.status !== 'Completed') task.completedAt = null;

  await task.save();

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

  // Best-effort: clean up attachment storage so we don't leave orphans.
  for (const a of task.attachments || []) {
    if (a.publicId) {
      // eslint-disable-next-line no-await-in-loop
      await storageService.deleteFile({
        publicId: a.publicId,
        storage: a.storage,
        resourceType: a.mimeType?.startsWith('image/') ? 'image' : 'raw',
      });
    }
  }

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

  // Notify everyone except the commenter.
  const audience = await fanoutAudience(task, req.user._id);
  await notificationService.notifyMany(audience, {
    type: 'comment_added',
    title: 'New comment',
    message: `${req.user.name}: ${text.slice(0, 100)}`,
    taskId: task._id,
  });

  res.status(201).json({ success: true, task });
});

/**
 * POST /api/tasks/:id/attachments  multipart/form-data (file or files[])
 * Supports single or multiple files via the same endpoint — multer is
 * configured at the route layer with `array('files', 10)`.
 */
exports.uploadAttachment = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);
  if (!(await canAccessTask(req.user, task))) {
    throw new AppError('Not authorised', 403);
  }

  const files = req.files?.length ? req.files : (req.file ? [req.file] : []);
  if (!files.length) throw new AppError('No file uploaded', 400);

  const newAttachments = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    const stored = await storageService.uploadFile({
      localPath: f.path,
      originalName: f.originalname,
      taskId: String(task._id),
      mimeType: f.mimetype,
    });

    newAttachments.push({
      filename: f.originalname,
      url: stored.url,
      storage: stored.storage,
      publicId: stored.publicId,
      mimeType: f.mimetype,
      size: f.size,
      uploadedBy: req.user._id,
    });
  }

  task.attachments.push(...newAttachments);
  await task.save();

  // Notify the rest of the audience.
  const audience = await fanoutAudience(task, req.user._id);
  if (audience.length) {
    notificationService.notifyMany(audience, {
      type: 'comment_added',
      title: `New attachment${newAttachments.length > 1 ? 's' : ''}`,
      message: `${req.user.name} uploaded ${newAttachments.length} file${newAttachments.length > 1 ? 's' : ''} to "${task.title}"`,
      taskId: task._id,
    }).catch(() => {});
  }

  res.status(201).json({ success: true, task, added: newAttachments.length });
});

/**
 * DELETE /api/tasks/:id/attachments/:attachmentId
 * Permitted to the uploader, the task assigner, or an Admin.
 */
exports.deleteAttachment = asyncHandler(async (req, res) => {
  const { id, attachmentId } = req.params;
  const task = await Task.findById(id);
  if (!task) throw new AppError('Task not found', 404);

  const att = task.attachments.id(attachmentId);
  if (!att) throw new AppError('Attachment not found', 404);

  const isAdmin = req.user.role === 'Admin';
  const isAssigner = String(task.assignedBy) === String(req.user._id);
  const isUploader = String(att.uploadedBy) === String(req.user._id);
  if (!isAdmin && !isAssigner && !isUploader) {
    throw new AppError('Not authorised to remove this attachment', 403);
  }

  await storageService.deleteFile({
    publicId: att.publicId,
    storage: att.storage,
    resourceType: att.mimeType?.startsWith('image/') ? 'image' : 'raw',
  });

  att.deleteOne();
  await task.save();

  res.json({ success: true });
});

/**
 * POST /api/tasks/:id/delegate  { toUserId, reason }
 * Reassigns the task to another user. Anyone in the current visibility chain
 * can do it (current assignee, original assignee, or admin/HOD/assigner).
 *
 * After delegation:
 *   - assignedToUser becomes toUserId
 *   - delegationHistory[] gets a new entry
 *   - Original assigner + original assignee + admins + previous assignee + new
 *     assignee all get notified
 */
exports.delegateTask = asyncHandler(async (req, res) => {
  const { toUserId, reason } = req.body;
  if (!toUserId || !reason?.trim()) {
    throw new AppError('toUserId and reason are required', 400);
  }

  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  // Only user-assigned tasks can be delegated for now (team→user delegation
  // would need different semantics).
  if (!task.assignedToUser) {
    throw new AppError('Only individually-assigned tasks can be delegated', 400);
  }

  // Permission to delegate: current assignee, original assignee, the
  // assigner, an Admin, or HOD of dept.
  const isAdmin = req.user.role === 'Admin';
  const isAssigner = String(task.assignedBy) === String(req.user._id);
  const isCurrentAssignee = String(task.assignedToUser) === String(req.user._id);
  const isOriginalAssignee = String(task.originalAssignedTo) === String(req.user._id);
  const isHODOfDept =
    req.user.role === 'HOD' &&
    String(task.department) === String(req.user.department);
  if (!(isAdmin || isAssigner || isCurrentAssignee || isOriginalAssignee || isHODOfDept)) {
    throw new AppError('Not authorised to delegate this task', 403);
  }

  if (String(toUserId) === String(task.assignedToUser)) {
    throw new AppError('Task is already assigned to that user', 400);
  }

  const toUser = await User.findById(toUserId);
  if (!toUser || !toUser.isActive) {
    throw new AppError('Target user not found or inactive', 400);
  }

  // HOD scope check.
  if (req.user.role === 'HOD' &&
      String(toUser.department) !== String(req.user.department)) {
    throw new AppError('HOD can only delegate within own department', 403);
  }

  const previousAssignee = task.assignedToUser;

  task.delegationHistory.push({
    fromUser: previousAssignee,
    toUser: toUser._id,
    reason: reason.trim(),
  });
  task.assignedToUser = toUser._id;

  // Add a comment so the change is visible in the unified timeline.
  task.comments.push({
    user: req.user._id,
    text: `🔀 Reassigned to ${toUser.name}. Reason: ${reason.trim()}`,
  });

  // Reset reminder bookkeeping so the new assignee gets fresh reminders.
  task.reminderSent = false;

  await task.save();

  // Build notification audience. Everyone except the actor.
  const audience = await fanoutAudience(task, req.user._id);
  // Make sure the new assignee is in there explicitly.
  if (!audience.includes(String(toUser._id))) {
    audience.push(String(toUser._id));
  }

  // Two flavours of message: the new assignee gets "received", everyone else
  // gets "delegated".
  await Promise.all(audience.map((userId) => {
    const isNewAssignee = String(userId) === String(toUser._id);
    return notificationService.notify({
      userId,
      type: isNewAssignee ? 'task_received' : 'task_delegated',
      title: isNewAssignee ? 'Task delegated to you' : 'Task delegated',
      message: isNewAssignee
        ? `${req.user.name} delegated "${task.title}" to you. Reason: ${reason.trim()}`
        : `${req.user.name} reassigned "${task.title}" to ${toUser.name}.`,
      taskId: task._id,
      channels: { inApp: true, push: true, whatsapp: isNewAssignee },
    });
  }));

  await ActivityLog.create({
    user: req.user._id,
    action: 'task.delegate',
    entity: 'Task',
    entityId: task._id,
    details: {
      from: String(previousAssignee),
      to: String(toUser._id),
      reason: reason.trim(),
    },
  });

  res.json({ success: true, task });
});
