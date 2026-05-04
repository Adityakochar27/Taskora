/**
 * Tests for the WhatsApp NLP parser. Runs with `npm test`.
 * Uses Node's built-in test runner — no extra dependencies.
 */
const test = require('node:test');
const assert = require('node:assert');
const { parseTaskMessage, parseDeadline } = require('../services/taskParserService');

test('returns null for non-trigger messages', () => {
  assert.strictEqual(parseTaskMessage('hello there'), null);
  assert.strictEqual(parseTaskMessage(''), null);
  assert.strictEqual(parseTaskMessage(null), null);
});

test('parses simple "Assign task: ... to <name>"', () => {
  const r = parseTaskMessage('Assign task: Submit report by Friday to Rahul');
  assert.strictEqual(r.title, 'Submit report');
  assert.strictEqual(r.assigneeHint, 'Rahul');
  assert.strictEqual(r.priority, 'Medium');
  assert.ok(r.deadline instanceof Date);
});

test('extracts priority and email assignee', () => {
  const r = parseTaskMessage(
    'Assign: Prepare quote by 2026-05-15 to priya@org.com priority high'
  );
  assert.strictEqual(r.title, 'Prepare quote');
  assert.strictEqual(r.priority, 'High');
  assert.strictEqual(r.assigneeHint, 'priya@org.com');
  assert.strictEqual(r.deadline.toISOString().slice(0, 10), '2026-05-15');
});

test('handles "tomorrow" and phone assignee', () => {
  const r = parseTaskMessage('New task: Inspect sample by tomorrow to +919999900000');
  assert.strictEqual(r.title, 'Inspect sample');
  assert.strictEqual(r.assigneeHint, '+919999900000');
  assert.ok(r.deadline > new Date());
});

test('handles "in N days"', () => {
  const r = parseTaskMessage('Create task: Vendor follow-up by in 3 days to Aditya');
  const days = (r.deadline - new Date()) / (24 * 60 * 60 * 1000);
  // Deadline is end-of-day on day+3, so the gap is roughly 2.5–4 days.
  assert.ok(days >= 2 && days <= 4, `expected 2–4 days, got ${days.toFixed(2)}`);
});

test('parseDeadline accepts dd/mm/yyyy', () => {
  const d = parseDeadline('15/05/2026');
  assert.strictEqual(d.getMonth(), 4); // May = index 4
  assert.strictEqual(d.getDate(), 15);
});

test('all four trigger phrasings work', () => {
  for (const trigger of ['Assign task:', 'Assign:', 'New task:', 'Create task:']) {
    const r = parseTaskMessage(`${trigger} Quick win to Asha`);
    assert.ok(r, `failed for trigger "${trigger}"`);
    assert.strictEqual(r.title, 'Quick win');
    assert.strictEqual(r.assigneeHint, 'Asha');
  }
});
