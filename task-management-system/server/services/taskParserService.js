/**
 * Lightweight rule-based parser that turns a WhatsApp message like:
 *
 *   "Assign task: Submit report by Friday to Rahul"
 *   "Assign: Prepare quote for ACME by 2026-05-15 to priya@org.com priority high"
 *
 * into a structured task draft:
 *
 *   { title, deadline (Date|null), assigneeHint, priority }
 *
 * The hint is a free-text token (name fragment, email, or @handle) that the
 * controller resolves against the User collection.
 *
 * This is intentionally dependency-free — for richer extraction, swap in an
 * LLM or chrono-node without changing the call sites.
 */

const TRIGGERS = [
  /^assign\s*task\s*:\s*/i,
  /^assign\s*:\s*/i,
  /^new\s*task\s*:\s*/i,
  /^create\s*task\s*:\s*/i,
];

const PRIORITY_RX = /\b(priority|prio)\s*(low|medium|high)\b/i;
const DEADLINE_RX = /\bby\s+(.+?)(?=\s+to\s+|\s+priority\b|\s+prio\b|$)/i;
const ASSIGNEE_RX = /\bto\s+([^\s,]+(?:\s+[^\s,]+)?)/i;

const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function parseDeadline(raw) {
  if (!raw) return null;
  const txt = raw.trim().toLowerCase();
  const now = new Date();

  if (txt === 'today') return endOfDay(now);
  if (txt === 'tomorrow') {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return endOfDay(d);
  }
  if (txt === 'eod' || txt === 'end of day') return endOfDay(now);

  // weekday name -> next occurrence
  if (WEEKDAYS[txt] != null) {
    const target = WEEKDAYS[txt];
    const d = new Date(now);
    const diff = (target - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return endOfDay(d);
  }

  // ISO yyyy-mm-dd
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return endOfDay(new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`));

  // dd/mm/yyyy
  const dmy = txt.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    const yyyy = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    return endOfDay(new Date(yyyy, Number(mm) - 1, Number(dd)));
  }

  // "in N days"
  const inDays = txt.match(/^in\s+(\d+)\s+day/);
  if (inDays) {
    const d = new Date(now); d.setDate(d.getDate() + Number(inDays[1]));
    return endOfDay(d);
  }

  // Fallback: try Date.parse
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? endOfDay(new Date(ts)) : null;
}

function endOfDay(d) {
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseTaskMessage(message) {
  if (!message || typeof message !== 'string') return null;
  let body = message.trim();

  const trigger = TRIGGERS.find((rx) => rx.test(body));
  if (!trigger) return null;
  body = body.replace(trigger, '').trim();

  // priority
  let priority = 'Medium';
  const pm = body.match(PRIORITY_RX);
  if (pm) {
    priority = pm[2][0].toUpperCase() + pm[2].slice(1).toLowerCase();
    body = body.replace(PRIORITY_RX, '').trim();
  }

  // assignee
  let assigneeHint = null;
  const am = body.match(ASSIGNEE_RX);
  if (am) {
    assigneeHint = am[1].trim().replace(/[.,;]+$/, '');
  }

  // deadline
  let deadline = null;
  const dm = body.match(DEADLINE_RX);
  if (dm) deadline = parseDeadline(dm[1]);

  // title = remainder after stripping
  let title = body
    .replace(DEADLINE_RX, '')
    .replace(ASSIGNEE_RX, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.,;]+$/, '');

  if (!title) return null;

  return { title, deadline, assigneeHint, priority };
}

module.exports = { parseTaskMessage, parseDeadline };
