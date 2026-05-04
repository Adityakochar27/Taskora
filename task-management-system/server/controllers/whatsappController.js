/**
 * WhatsApp inbound webhook handler.
 *
 * Twilio's WhatsApp webhook posts application/x-www-form-urlencoded with
 * fields like:
 *   From=whatsapp:+919876543210
 *   Body="Assign task: Submit report by Friday to Rahul"
 *
 * The handler:
 *   1. Identifies the sender by phone number (must be a registered user with
 *      role Admin or HOD — Employees can't create tasks).
 *   2. Parses the body via taskParserService.
 *   3. Resolves the assignee against the User collection.
 *   4. Creates the task and replies with confirmation.
 *
 * All replies are sent via TwiML so the user gets immediate feedback.
 */
const Task = require('../models/Task');
const User = require('../models/User');
const Team = require('../models/Team');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../utils/asyncHandler');
const { parseTaskMessage } = require('../services/taskParserService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

function twiml(message) {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

function normalisePhone(raw) {
  if (!raw) return null;
  // Twilio sends "whatsapp:+919876543210"
  return raw.replace(/^whatsapp:/i, '').trim();
}

async function resolveAssignee(hint, sender) {
  if (!hint) return null;

  const h = hint.trim();

  // Email
  if (/@/.test(h)) {
    return User.findOne({ email: h.toLowerCase(), isActive: true });
  }

  // Phone-like
  if (/^\+?\d{6,}$/.test(h)) {
    return User.findOne({ phone: h.startsWith('+') ? h : `+${h}`, isActive: true });
  }

  // Name match — prefer same-department first.
  const rx = new RegExp(`^${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  let user = null;
  if (sender.department) {
    user = await User.findOne({
      name: rx,
      department: sender.department,
      isActive: true,
    });
  }
  if (!user) user = await User.findOne({ name: rx, isActive: true });
  return user;
}

/**
 * POST /api/whatsapp/inbound
 * Twilio webhook endpoint.
 */
exports.inbound = asyncHandler(async (req, res) => {
  const from = normalisePhone(req.body.From);
  const body = (req.body.Body || '').trim();
  logger.info('WA inbound', { from, body });

  res.set('Content-Type', 'text/xml');

  if (!from) return res.send(twiml('Could not identify sender.'));

  const sender = await User.findOne({ phone: from, isActive: true });
  if (!sender) {
    return res.send(
      twiml('Your number is not registered. Ask your admin to add your phone to your profile.')
    );
  }

  if (!['Admin', 'HOD'].includes(sender.role)) {
    return res.send(twiml('Only Admins and HODs can create tasks via WhatsApp.'));
  }

  // Help text
  if (/^(help|menu|hi|hello)$/i.test(body)) {
    return res.send(
      twiml(
        `Hi ${sender.name}! Send a message like:\n` +
          `"Assign task: <title> by <date|weekday|today|tomorrow> to <name|email> priority <low|medium|high>"`
      )
    );
  }

  const parsed = parseTaskMessage(body);
  if (!parsed) {
    return res.send(
      twiml(
        'Could not parse your message. Try:\n"Assign task: Submit report by Friday to Rahul"'
      )
    );
  }

  const assignee = await resolveAssignee(parsed.assigneeHint, sender);
  if (!assignee) {
    return res.send(
      twiml(`Could not find user matching "${parsed.assigneeHint || '(none)'}".`)
    );
  }

  // HOD scope check
  if (
    sender.role === 'HOD' &&
    String(assignee.department) !== String(sender.department)
  ) {
    return res.send(
      twiml(`As HOD you can only assign within your own department.`)
    );
  }

  const task = await Task.create({
    title: parsed.title,
    description: `Created via WhatsApp by ${sender.name}`,
    assignedBy: sender._id,
    assignedToUser: assignee._id,
    department: assignee.department || sender.department || null,
    priority: parsed.priority || 'Medium',
    deadline: parsed.deadline || null,
  });

  await ActivityLog.create({
    user: sender._id,
    action: 'task.create.whatsapp',
    entity: 'Task',
    entityId: task._id,
    details: { from, body },
  });

  await notificationService.notify({
    userId: assignee._id,
    type: 'task_assigned',
    title: 'New task assigned',
    message: `${sender.name} assigned you "${task.title}"${task.deadline ? ` (due ${task.deadline.toLocaleDateString()})` : ''}`,
    taskId: task._id,
    channels: { inApp: true, push: true, whatsapp: true },
  });

  const dl = task.deadline ? task.deadline.toLocaleString() : 'no deadline';
  return res.send(
    twiml(
      `✓ Task created\n*${task.title}*\nAssigned to: ${assignee.name}\nPriority: ${task.priority}\nDue: ${dl}`
    )
  );
});

/**
 * POST /api/whatsapp/test/parse  { message }
 * Diagnostic endpoint to dry-run the parser. Admin only.
 */
exports.testParse = asyncHandler(async (req, res) => {
  const parsed = parseTaskMessage(req.body.message || '');
  res.json({ success: true, parsed });
});
