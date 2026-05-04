const mongoose = require('mongoose');

const STATUS = ['Pending', 'In Progress', 'Completed'];
const PRIORITY = ['Low', 'Medium', 'High'];

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: String,           // original filename as uploaded
    url: String,                // public URL (Cloudinary or local /uploads/...)
    storage: { type: String, default: 'cloudinary' }, // 'cloudinary' | 'local'
    publicId: String,           // Cloudinary asset ID, used for delete
    mimeType: String,
    size: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const delegationSchema = new mongoose.Schema(
  {
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Either a user OR a team is targeted (XOR enforced in pre-validate).
    assignedToUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedToTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },

    priority: { type: String, enum: PRIORITY, default: 'Medium', index: true },
    deadline: { type: Date, index: true },

    status: { type: String, enum: STATUS, default: 'Pending', index: true },
    completedAt: { type: Date, default: null },

    attachments: [attachmentSchema],
    comments: [commentSchema],

    /**
     * Delegation chain. Each entry records: fromUser → toUser, with reason.
     * The current assignee is always assignedToUser; this array preserves the
     * full history so the original assigner can see who's working on it now
     * and why it was reassigned.
     */
    delegationHistory: [delegationSchema],

    /**
     * The user the task was ORIGINALLY assigned to (before any delegation).
     * Stays constant once set so we can always notify them of changes.
     * Null for team-assigned tasks.
     */
    originalAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Reminder bookkeeping so we don't double-send.
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// XOR: must be assigned to exactly one of user/team.
taskSchema.pre('validate', function (next) {
  if (!this.assignedToUser && !this.assignedToTeam) {
    return next(new Error('Task must be assigned to a user or a team'));
  }
  if (this.assignedToUser && this.assignedToTeam) {
    return next(new Error('Task cannot be assigned to both a user and a team'));
  }
  // Capture the original assignee on first create so delegation history
  // always has a starting point.
  if (this.isNew && this.assignedToUser && !this.originalAssignedTo) {
    this.originalAssignedTo = this.assignedToUser;
  }
  next();
});

taskSchema.virtual('isOverdue').get(function () {
  return (
    this.deadline &&
    this.status !== 'Completed' &&
    this.deadline.getTime() < Date.now()
  );
});

taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

taskSchema.statics.STATUS = STATUS;
taskSchema.statics.PRIORITY = PRIORITY;

module.exports = mongoose.model('Task', taskSchema);
