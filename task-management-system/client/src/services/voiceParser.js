/**
 * Voice/text task parser. Mirrors the WhatsApp parser's rules but does NOT
 * require an "Assign task:" trigger — every voice input is implicitly a task
 * creation.
 */

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const PRIORITY_RX = /\b(?:priority|prio|priorities)\s+(low|medium|high)\b/i;
const DEADLINE_RX =
  /\bby\s+(today|tomorrow|tonight|eod|end\s+of\s+day|in\s+\d+\s+days?|next\s+\w+|\w+day|\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i;
const ASSIGNEE_RX =
  /\bto\s+(@?[\w.+-]+(?:@[\w.-]+\.\w+)?|\+\d{6,}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;

function endOfDay(d) {
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDeadline(raw) {
  if (!raw) return null;
  const txt = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const now = new Date();

  if (txt === 'today' || txt === 'tonight' || txt === 'eod' || txt === 'end of day')
    return endOfDay(new Date(now));
  if (txt === 'tomorrow') {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return endOfDay(d);
  }

  const wd = txt.replace(/^next\s+/, '');
  if (WEEKDAYS[wd] != null) {
    const target = WEEKDAYS[wd];
    const d = new Date(now);
    const diff = (target - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return endOfDay(d);
  }

  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return endOfDay(new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`));

  const dmy = txt.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    const yyyy = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    return endOfDay(new Date(yyyy, Number(mm) - 1, Number(dd)));
  }

  const inDays = txt.match(/^in\s+(\d+)\s+day/);
  if (inDays) {
    const d = new Date(now); d.setDate(d.getDate() + Number(inDays[1]));
    return endOfDay(d);
  }

  return null;
}

function normalise(input) {
  let s = (input || '').trim();
  s = s.replace(/\b(comma|colon|full stop|period|exclamation|question mark)\b/gi, '');
  s = s.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (m) =>
    String(WORD_NUMBERS[m.toLowerCase()])
  );
  s = s.replace(/\bto morrow\b/gi, 'tomorrow');
  s = s.replace(/\bto day\b/gi, 'today');
  return s.replace(/\s{2,}/g, ' ').trim();
}

export function parseVoiceInput(input) {
  const cleaned = normalise(input);
  if (!cleaned) {
    return { title: '', deadline: null, assigneeHint: null, priority: 'Medium' };
  }

  let body = cleaned;

  let priority = 'Medium';
  const pm = body.match(PRIORITY_RX);
  if (pm) {
    priority = pm[1][0].toUpperCase() + pm[1].slice(1).toLowerCase();
    body = body.replace(PRIORITY_RX, '').trim();
  }

  let assigneeHint = null;
  const am = body.match(ASSIGNEE_RX);
  if (am) {
    assigneeHint = am[1].trim();
    body = body.replace(ASSIGNEE_RX, '').trim();
  } else {
    const lm = body.match(/\bto\s+([a-z][\w.+-]{1,30})/i);
    if (lm) {
      assigneeHint = lm[1].trim();
      body = body.replace(lm[0], '').trim();
    }
  }

  let deadline = null;
  const dm = body.match(DEADLINE_RX);
  if (dm) {
    deadline = parseDeadline(dm[1]);
    body = body.replace(DEADLINE_RX, '').trim();
  }

  const title = body
    .replace(/^[:,;\s]+|[:,;\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { title, deadline, assigneeHint, priority };
}

export function resolveAssignee(hint, users) {
  if (!hint || !users?.length) return null;
  const h = hint.trim().toLowerCase();

  if (/@/.test(h)) {
    return users.find((u) => u.email?.toLowerCase() === h) || null;
  }

  if (/^\+?\d{6,}$/.test(h)) {
    const target = h.startsWith('+') ? h : `+${h}`;
    return users.find((u) => u.phone === target) || null;
  }

  const matches = users
    .filter((u) => u.name?.toLowerCase().startsWith(h))
    .sort((a, b) => a.name.length - b.name.length);
  return matches[0] || null;
}
