/**
 * Seed script - populates a fresh database with a working demo dataset.
 * Idempotent: safe to re-run; it skips records that already exist by email/name.
 *
 *   node scripts/seed.js                 # default credentials
 *   ADMIN_EMAIL=me@org.com node scripts/seed.js
 */
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Department = require('../models/Department');
const Team = require('../models/Team');
const Task = require('../models/Task');
const logger = require('../utils/logger');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@taskflow.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

async function upsertUser({ name, email, password, role, department, phone }) {
  let user = await User.findOne({ email });
  if (user) {
    logger.info(`  · user exists: ${email}`);
    return user;
  }
  user = await User.create({ name, email, password, role, department, phone });
  logger.info(`  + created user: ${email} (${role})`);
  return user;
}

async function upsertDepartment({ name, description }) {
  let d = await Department.findOne({ name });
  if (d) return d;
  d = await Department.create({ name, description });
  logger.info(`  + created department: ${name}`);
  return d;
}

async function upsertTeam({ name, department, lead, members }) {
  let t = await Team.findOne({ name, department: department._id });
  if (t) return t;
  t = await Team.create({
    name, department: department._id,
    lead: lead?._id, members: members.map((m) => m._id),
  });
  await User.updateMany(
    { _id: { $in: members.map((m) => m._id) } },
    { $addToSet: { teamIds: t._id } }
  );
  logger.info(`  + created team: ${name}`);
  return t;
}

async function seed() {
  await connectDB();
  logger.info('Seeding demo data…');

  // 1. Departments
  const eng = await upsertDepartment({
    name: 'Engineering',
    description: 'Software & infrastructure',
  });
  const ops = await upsertDepartment({
    name: 'Operations',
    description: 'Production, logistics & QC',
  });

  // 2. Admin
  const admin = await upsertUser({
    name: 'Demo Admin',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'Admin',
    phone: '+910000000000',
  });

  // 3. HODs
  const engHod = await upsertUser({
    name: 'Priya Engineering',
    email: 'priya@taskflow.dev',
    password: 'priya1234',
    role: 'HOD',
    department: eng._id,
    phone: '+911111111111',
  });
  const opsHod = await upsertUser({
    name: 'Rahul Operations',
    email: 'rahul@taskflow.dev',
    password: 'rahul1234',
    role: 'HOD',
    department: ops._id,
    phone: '+912222222222',
  });

  // Backfill HOD on departments.
  if (!eng.hod) { eng.hod = engHod._id; await eng.save(); }
  if (!ops.hod) { ops.hod = opsHod._id; await ops.save(); }

  // 4. Employees
  const employees = await Promise.all([
    upsertUser({
      name: 'Asha Frontend',
      email: 'asha@taskflow.dev',
      password: 'asha1234',
      role: 'Employee',
      department: eng._id,
    }),
    upsertUser({
      name: 'Karan Backend',
      email: 'karan@taskflow.dev',
      password: 'karan1234',
      role: 'Employee',
      department: eng._id,
    }),
    upsertUser({
      name: 'Meera QC',
      email: 'meera@taskflow.dev',
      password: 'meera1234',
      role: 'Employee',
      department: ops._id,
    }),
    upsertUser({
      name: 'Vikram Production',
      email: 'vikram@taskflow.dev',
      password: 'vikram1234',
      role: 'Employee',
      department: ops._id,
    }),
  ]);

  // 5. Teams
  const frontendTeam = await upsertTeam({
    name: 'Frontend Squad',
    department: eng,
    lead: engHod,
    members: [employees[0], employees[1]],
  });
  const qcTeam = await upsertTeam({
    name: 'QC Line A',
    department: ops,
    lead: opsHod,
    members: [employees[2], employees[3]],
  });

  // 6. Sample tasks - only seed if there are no tasks yet so re-running stays clean.
  const taskCount = await Task.countDocuments();
  if (taskCount === 0) {
    const day = (n) => new Date(Date.now() + n * 86_400_000);
    await Task.insertMany([
      {
        title: 'Ship login + signup pages',
        description: 'Wire the auth screens to /api/auth.',
        assignedBy: engHod._id,
        assignedToUser: employees[0]._id,
        department: eng._id,
        priority: 'High',
        deadline: day(2),
        status: 'In Progress',
      },
      {
        title: 'Add task filters to backend',
        assignedBy: engHod._id,
        assignedToUser: employees[1]._id,
        department: eng._id,
        priority: 'Medium',
        deadline: day(5),
        status: 'Pending',
      },
      {
        title: 'Inspect raw material batch #2026-04',
        assignedBy: opsHod._id,
        assignedToTeam: qcTeam._id,
        department: ops._id,
        priority: 'High',
        deadline: day(-1), // overdue
        status: 'Pending',
      },
      {
        title: 'Calibrate ESD floor tester monthly',
        assignedBy: admin._id,
        assignedToUser: employees[2]._id,
        department: ops._id,
        priority: 'Low',
        deadline: day(14),
        status: 'Completed',
        completedAt: new Date(),
      },
      {
        title: 'Refactor frontend auth context',
        assignedBy: admin._id,
        assignedToTeam: frontendTeam._id,
        department: eng._id,
        priority: 'Medium',
        deadline: day(7),
        status: 'Pending',
      },
    ]);
    logger.info('  + 5 sample tasks created');
  } else {
    logger.info(`  · ${taskCount} tasks already present, skipping samples`);
  }

  logger.info('\nSeed complete!\n');
  logger.info('Demo credentials:');
  logger.info(`  Admin:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  logger.info('  HOD:      priya@taskflow.dev / priya1234   (Engineering)');
  logger.info('  HOD:      rahul@taskflow.dev / rahul1234   (Operations)');
  logger.info('  Employee: asha@taskflow.dev / asha1234     (Frontend Squad)');
  logger.info('  Employee: karan@taskflow.dev / karan1234   (Frontend Squad)');
  logger.info('  Employee: meera@taskflow.dev / meera1234   (QC Line A)');
  logger.info('  Employee: vikram@taskflow.dev / vikram1234 (QC Line A)');

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error('Seed failed', err);
  process.exit(1);
});
