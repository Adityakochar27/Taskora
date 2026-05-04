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
      .populate('department
