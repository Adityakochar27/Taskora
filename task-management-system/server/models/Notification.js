const mongoose = require('mongoose');

const TYPES = [
  'task_assigned',
  'task_updated',
  'task_completed',
  'task_delegated',         // someone reassigned a task; recipient was the original assigner / admin / team
  'task_received',          // current user is the new delegatee
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
    meta: { type: Object, default: {} },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
