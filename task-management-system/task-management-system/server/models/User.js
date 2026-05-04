const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['Admin', 'HOD', 'Employee'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'Employee', index: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    phone: { type: String, trim: true, default: '' }, // E.164 e.g. +919876543210 — used by WhatsApp
    fcmTokens: [{ type: String }], // multiple devices per user
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function () {
  const o = this.toObject();
  delete o.password;
  delete o.fcmTokens;
  return o;
};

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
