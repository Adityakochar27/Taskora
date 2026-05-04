const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teamSchema.index({ department: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
