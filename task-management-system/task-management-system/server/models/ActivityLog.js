const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true }, // e.g. 'task.create'
    entity: { type: String, required: true }, // e.g. 'Task'
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
