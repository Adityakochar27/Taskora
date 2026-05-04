const Team = require('../models/Team');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Scope helper: HOD only sees teams in own dept; employee only sees teams they
 * are a member of; Admin sees all.
 */
function scopeFilter(user, base = {}) {
  const f = { isActive: true, ...base };
  if (user.role === 'HOD') f.department = user.department;
  if (user.role === 'Employee') f.members = user._id;
  return f;
}

exports.listTeams = asyncHandler(async (req, res) => {
  const { department } = req.query;
  const filter = scopeFilter(req.user);
  if (department && req.user.role !== 'HOD') filter.department = department;

  const items = await Team.find(filter)
    .populate('lead', 'name email')
    .populate('department', 'name')
    .populate('members', 'name email role')
    .sort({ name: 1 });

  res.json({ success: true, data: items });
});

exports.createTeam = asyncHandler(async (req, res) => {
  const { name, description, department, lead, members = [] } = req.body;
  if (!name || !department) {
    throw new AppError('name and department are required', 400);
  }

  // HOD can only create teams in their own department.
  if (req.user.role === 'HOD' && String(department) !== String(req.user.department)) {
    throw new AppError('HOD can only create teams in own department', 403);
  }

  const team = await Team.create({ name, description, department, lead, members });

  // Backfill teamIds on members.
  if (members.length) {
    await User.updateMany(
      { _id: { $in: members } },
      { $addToSet: { teamIds: team._id } }
    );
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'team.create',
    entity: 'Team',
    entityId: team._id,
  });

  res.status(201).json({ success: true, team });
});

exports.getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id)
    .populate('lead', 'name email')
    .populate('department', 'name')
    .populate('members', 'name email role');
  if (!team) throw new AppError('Team not found', 404);
  res.json({ success: true, team });
});

exports.updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found', 404);

  if (req.user.role === 'HOD' && String(team.department) !== String(req.user.department)) {
    throw new AppError('Not authorised', 403);
  }

  const fields = ['name', 'description', 'lead', 'members', 'isActive'];
  const oldMembers = team.members.map(String);

  for (const k of fields) if (req.body[k] !== undefined) team[k] = req.body[k];
  await team.save();

  // Reconcile teamIds on users.
  if (req.body.members) {
    const newMembers = team.members.map(String);
    const added = newMembers.filter((m) => !oldMembers.includes(m));
    const removed = oldMembers.filter((m) => !newMembers.includes(m));
    if (added.length) {
      await User.updateMany(
        { _id: { $in: added } },
        { $addToSet: { teamIds: team._id } }
      );
    }
    if (removed.length) {
      await User.updateMany(
        { _id: { $in: removed } },
        { $pull: { teamIds: team._id } }
      );
    }
  }

  res.json({ success: true, team });
});

exports.deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found', 404);
  if (req.user.role === 'HOD' && String(team.department) !== String(req.user.department)) {
    throw new AppError('Not authorised', 403);
  }
  team.isActive = false;
  await team.save();
  await User.updateMany(
    { teamIds: team._id },
    { $pull: { teamIds: team._id } }
  );
  res.json({ success: true });
});
