const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/notifications?unreadOnly=true&page&limit
 */
exports.list = asyncHandler(async (req, res) => {
  const { unreadOnly, page = 1, limit = 30 } = req.query;
  const filter = { user: req.user._id };
  if (unreadOnly === 'true') filter.read = false;

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .populate('task', 'title status priority deadline')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);

  res.json({
    success: true,
    data: items,
    unread,
    pagination: { total, page: Number(page), limit: Number(limit) },
  });
});

/**
 * PUT /api/notifications/:id/read
 */
exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw new AppError('Notification not found', 404);
  n.read = true;
  await n.save();
  res.json({ success: true });
});

/**
 * PUT /api/notifications/read-all
 */
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true });
});

/**
 * DELETE /api/notifications/:id
 */
exports.remove = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ success: true });
});
