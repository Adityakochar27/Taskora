/**
 * Tiny structured logger. Swap for pino/winston in production if needed.
 */
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const current = levels[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 2;

function fmt(level, args) {
  const ts = new Date().toISOString();
  return [`[${ts}]`, `[${level.toUpperCase()}]`, ...args];
}

module.exports = {
  error: (...a) => current >= 0 && console.error(...fmt('error', a)),
  warn: (...a) => current >= 1 && console.warn(...fmt('warn', a)),
  info: (...a) => current >= 2 && console.log(...fmt('info', a)),
  debug: (...a) => current >= 3 && console.log(...fmt('debug', a)),
};
