/**
 * Twilio client - lazy init, returns null if creds missing so the rest of the
 * app remains operational and WhatsApp calls degrade to no-ops.
 */
const twilio = require('twilio');
const logger = require('../utils/logger');

let client = null;
let attempted = false;

function getTwilio() {
  if (attempted) return client;
  attempted = true;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    logger.warn('WhatsApp disabled: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set');
    return null;
  }

  client = twilio(sid, token);
  logger.info('Twilio client initialised');
  return client;
}

module.exports = { getTwilio };
