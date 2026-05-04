const mongoose = require('mongoose');

const TYPES = [
  'task_assigned',
  'task_updated',
  'task_completed',
  'deadline_approaching',
  'comment_added',
  'system',
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, enum: TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    read: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
