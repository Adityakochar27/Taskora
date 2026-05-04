/**
 * Firebase Cloud Messaging service.
 * Falls back to logging when Firebase is not configured.
 */
const { getFirebase } = require('../config/firebase');
const logger = require('../utils/logger');

async function sendToTokens(tokens, payload) {
  if (!tokens?.length) return { sent: 0 };

  const fb = getFirebase();
  if (!fb) {
    logger.debug('FCM no-op (not configured)', { tokens: tokens.length, payload });
    return { sent: 0, skipped: true };
  }

  try {
    const res = await fb.messaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.message },
      data: Object.fromEntries(
        Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
      ),
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    return { sent: res.successCount, failed: res.failureCount };
  } catch (err) {
    logger.error('FCM send failed', err);
    return { sent: 0, error: err.message };
  }
}

module.exports = { sendToTokens };
