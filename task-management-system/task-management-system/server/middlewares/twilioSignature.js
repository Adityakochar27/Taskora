/**
 * Twilio webhook signature validation.
 *
 * Twilio signs every webhook request with the auth token. We re-derive the
 * signature server-side and reject any request whose X-Twilio-Signature header
 * does not match — this prevents spoofed inbound messages from creating tasks.
 *
 * Behaviour:
 *   - In dev (TWILIO_AUTH_TOKEN not set): validation is skipped with a warning
 *     so the sandbox / curl tests still work.
 *   - In production (TWILIO_AUTH_TOKEN set): every request is validated against
 *     either TWILIO_WEBHOOK_URL (if set) or the request URL reconstructed from
 *     the proxy headers (Render / Vercel / Cloudflare always front the API).
 *   - On invalid signature: respond 403 with empty TwiML so Twilio doesn't
 *     retry indefinitely.
 */
const twilio = require('twilio');
const logger = require('../utils/logger');

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

function reject(res) {
  return res.status(403).type('text/xml').send(TWIML_EMPTY);
}

function verifyTwilioSignature(req, res, next) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    logger.warn('Twilio signature check skipped (TWILIO_AUTH_TOKEN not set)');
    return next();
  }

  const signature = req.headers['x-twilio-signature'];
  if (!signature) {
    logger.warn('Rejecting webhook: missing X-Twilio-Signature header');
    return reject(res);
  }

  // Prefer an explicit override (so deployments with non-standard proxies can
  // pin the exact URL Twilio is configured to call). Otherwise reconstruct
  // from forwarded headers — these are what Twilio originally hit.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = process.env.TWILIO_WEBHOOK_URL || `${proto}://${host}${req.originalUrl}`;

  const ok = twilio.validateRequest(token, signature, url, req.body);
  if (!ok) {
    logger.warn('Rejecting webhook: invalid Twilio signature', { url });
    return reject(res);
  }

  next();
}

module.exports = { validateTwilioSignature: verifyTwilioSignature };
