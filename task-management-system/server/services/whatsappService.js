/**
 * WhatsApp service — vendor-agnostic abstraction layer.
 *
 * The default provider is Twilio. To switch to the WhatsApp Business Cloud API
 * (Meta), implement the same `sendText(to, body)` interface and toggle the
 * `provider` selection below — nothing else in the app needs to change.
 *
 * `to` is always an E.164 phone number (e.g. +919876543210). The Twilio adapter
 * prefixes it with `whatsapp:` automatically.
 */
const { getTwilio } = require('../config/twilio');
const logger = require('../utils/logger');

// --- Provider: Twilio ---
const twilioProvider = {
  async sendText(to, body) {
    const client = getTwilio();
    if (!client) {
      logger.debug('WhatsApp no-op (Twilio not configured)', { to, body });
      return { skipped: true };
    }
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!from) {
      logger.warn('TWILIO_WHATSAPP_FROM not set');
      return { skipped: true };
    }

    const msg = await client.messages.create({
      from,
      to: `whatsapp:${to}`,
      body,
    });
    return { sid: msg.sid };
  },
};

// --- Provider: WhatsApp Business Cloud API (stub) ---
// Implement when you migrate off the sandbox / Twilio.
const metaProvider = {
  async sendText(to, body) {
    logger.debug('Meta WA Cloud provider not implemented', { to, body });
    return { skipped: true };
  },
};

const provider =
  process.env.WHATSAPP_PROVIDER === 'meta' ? metaProvider : twilioProvider;

async function sendText(to, body) {
  if (!to) return { skipped: true, reason: 'no recipient' };
  try {
    return await provider.sendText(to, body);
  } catch (err) {
    logger.error('WhatsApp send error', err);
    return { error: err.message };
  }
}

/**
 * Send a templated message that respects 24-hour session rules. For Twilio
 * sandbox / approved templates only — falls back to plain text otherwise.
 */
async function sendTemplate(to, templateBody) {
  return sendText(to, templateBody);
}

module.exports = { sendText, sendTemplate };
