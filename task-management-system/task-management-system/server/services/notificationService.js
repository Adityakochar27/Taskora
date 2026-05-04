/**
 * Notification service - the single fan-out point for any user-facing alert.
 * It writes the in-app row, fires FCM push, and dispatches WhatsApp when
 * appropriate. Channels degrade independently if a provider is unconfigured.
 */
const Notification = require('../models/Notification');
const User = require('../models/User');
const fcm = require('./fcmService');
const wa = require('./whatsappService');
const logger = require('../utils/logger');

async function notify({
  userId,
  type,
  title,
  message,
  taskId = null,
  meta = {},
  channels = { inApp: true, push: true, whatsapp: false },
}) {
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user || !user.isActive) return null;

  let notif = null;
  if (channels.inApp) {
    notif = await Notification.create({
      user: userId,
      type,
      title,
      message,
      task: taskId,
      meta,
    });
  }

  if (channels.push && user.fcmTokens?.length) {
    fcm
      .sendToTokens(user.fcmTokens, {
        title,
        message,
        data: { type, taskId: taskId || '' },
      })
      .catch((e) => logger.warn('FCM dispatch error', e));
  }

  if (channels.whatsapp && user.phone) {
    wa.sendText(user.phone, `*${title}*\n${message}`).catch((e) =>
      logger.warn('WhatsApp dispatch error', e)
    );
  }

  return notif;
}

async function notifyMany(userIds, opts) {
  return Promise.all(userIds.map((id) => notify({ userId: id, ...opts })));
}

module.exports = { notify, notifyMany };
