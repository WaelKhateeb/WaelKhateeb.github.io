import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSession } from '../src/assessment.js';
import { newSession, characters } from '../src/tracking.js';

const answer = 'University students should attend classes because discussion improves understanding and gives them opportunities to ask questions. However, occasional absences should be allowed for illness, work, or family responsibilities. A fair attendance policy should encourage participation while recognising that students have different circumstances and can demonstrate their learning in several ways.';
const n = characters(answer);
function typedSession() { const session = newSession(); session.metrics.typed = n; session.events = [{ type: 'typing', text: answer, characters: n }]; return session; }
function pastedSession() { const session = newSession(); session.metrics.pasted = n; session.metrics.pastes = 1; session.events = [{ type: 'paste', inserted: answer }]; return session; }

test('blank and short answers receive no numeric score', () => {
  const s = pastedSession();
  assert.equal(assessSession(s, '').score, null);
  assert.equal(assessSession(s, 'A short answer.').status, 'insufficient');
});
test('typed answer with no imports has zero process-review points, not a human verdict', () => {
  const result = assessSession(typedSession(), answer);
  assert.equal(result.score, 0); assert.equal(result.aiAuthorship, 'Undetermined'); assert.equal(result.aiProbability, null);
});
test('bulk paste produces a high review score without an AI verdict', () => {
  const result = assessSession(pastedSession(), answer);
  assert.equal(result.score, 100); assert.equal(result.type, 'uncalibrated-heuristic');
  assert.equal(result.aiAuthorship, 'Undetermined'); assert.equal(result.aiProbability, null);
  assert.match(result.limitations, /Human-written pasted text can score high/);
});
test('drag/drop is included in the import evidence', () => {
  const session = newSession(); session.events = [{ type: 'drop', inserted: answer }];
  assert.equal(assessSession(session, answer).score, 100);
});
test('revising imported text lowers the revision component and keeps score bounded', () => {
  const session = pastedSession(); session.events.push({ type: 'delete', deleted: answer.slice(0, 150) });
  const result = assessSession(session, answer);
  assert.equal(result.breakdown.find(item => item.key === 'limitedRevision').points, 0);
  assert.equal(result.score, 85);
  for (const rule of result.breakdown) assert.ok(rule.points >= 0 && rule.points <= rule.maximum);
});
test('edits before a paste do not count as post-import revisions', () => {
  const session = pastedSession(); session.events.unshift({ type: 'delete', deleted: answer });
  assert.equal(assessSession(session, answer).score, 100);
});
test('undo and redo do not manufacture revision evidence', () => {
  const session = pastedSession(); session.events.push({ type: 'undo', deleted: answer }, { type: 'redo', inserted: answer });
  assert.equal(assessSession(session, answer).score, 100);
});
test('unknown-source content withholds the score', () => {
  const session = newSession(); session.events.push({ type: 'edit', inserted: answer });
  const result = assessSession(session, answer);
  assert.equal(result.score, null); assert.equal(result.status, 'incomplete');
});
test('a restored answer without any activity does not receive a false zero', () => {
  assert.equal(assessSession(newSession(), answer).status, 'incomplete');
});
test('focus changes and pauses alone cannot raise suspicion', () => {
  const session = typedSession(); session.metrics.pauses = 50; session.metrics.focus = 100;
  session.events.push({ type: 'hidden' }, { type: 'pause' }, { type: 'blur' });
  assert.equal(assessSession(session, answer).score, 0);
});
test('the result explicitly describes cumulative session evidence, including later deletions', () => {
  const result = assessSession(pastedSession(), answer);
  assert.equal(result.scope, 'cumulative-session'); assert.match(result.limitations, /Text removed later/);
});
