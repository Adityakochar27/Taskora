/**
 * Firebase Admin SDK initializer.
 * Lazy: only initialises when FIREBASE_SERVICE_ACCOUNT env is present so the
 * server still boots in dev environments without push credentials.
 */
const admin = require('firebase-admin');
const logger = require('../utils/logger');

let initialised = false;

function getFirebase() {
  if (initialised) return admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    logger.warn('FCM disabled: FIREBASE_SERVICE_ACCOUNT not set');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialised = true;
    logger.info('Firebase Admin initialised');
    return admin;
  } catch (err) {
    logger.error('Failed to init Firebase Admin', err);
    return null;
  }
}

module.exports = { getFirebase };
