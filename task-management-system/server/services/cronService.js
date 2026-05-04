/**
 * Background cron jobs.
 * - every 15 minutes: look for tasks whose deadline is within the next 24h and
 *   that haven't had a reminder dispatched yet, then notify the assignee(s).
 */
const cron = require('node-cron');
const Task = require('../models/Task');
const Team = require('../models/Team');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

async function runDeadlineSweep() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await Task.find({
    status: { $ne: 'Completed' },
    reminderSent: false,
    deadline: { $gte: now, $lte: in24h },
  });

  for (const t of tasks) {
    const targets = [];
    if (t.assignedToUser) targets.push(String(t.assignedToUser));
    if (t.assignedToTeam) {
      const team = await Team.findById(t.assignedToTeam).select('members');
      if (team) targets.push(...team.members.map(String));
    }

    await notificationService.notifyMany(targets, {
      type: 'deadline_approaching',
      title: 'Deadline approaching',
      message: `"${t.title}" is due ${t.deadline.toLocaleString()}`,
      taskId: t._id,
      channels: { inApp: true, push: true, whatsapp: true },
    });

    t.reminderSent = true;
    await t.save();
  }

  if (tasks.length) logger.info(`Deadline sweep: ${tasks.length} reminders sent`);
}

function startCronJobs() {
  cron.schedule('*/15 * * * *', () => {
    runDeadlineSweep().catch((e) => logger.error('Deadline sweep failed', e));
  });
  logger.info('Cron jobs scheduled');
}

module.exports = startCronJobs;
module.exports.runDeadlineSweep = runDeadlineSweep;
