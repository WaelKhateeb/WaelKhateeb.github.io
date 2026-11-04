import { characters } from './tracking.js';

export const ASSESSMENT_RULES = Object.freeze({
  version: 'process-review-v1', minimumWords: 50, largeImportCharacters: 120,
  weights: { importedShare: 60, largestBlock: 25, limitedRevision: 15 },
});
const clamp = value => Math.max(0, Math.min(1, value));
const safeCount = value => Number.isFinite(value) && value >= 0 ? value : 0;
const round = value => Math.round(value * 10) / 10;

// Transparent demonstration rules, NOT a calibrated probability or a trained
// AI-text classifier. These observations cannot establish AI/human authorship.
// Scores describe the cumulative SESSION, including text later removed.
export function assessSession(session, currentText) {
  const { minimumWords, largeImportCharacters, weights } = ASSESSMENT_RULES;
  const words = currentText.trim().match(/\S+/gu)?.length || 0;
  const events = session.events || [];
  const metrics = session.metrics || {};
  const imports = events.filter(event => event.type === 'paste' || event.type === 'drop');
  const dropped = imports.filter(event => event.type === 'drop').reduce((sum, event) => sum + characters(event.inserted || ''), 0);
  const imported = safeCount(metrics.pasted) + dropped;
  const typed = safeCount(metrics.typed);
  const unobserved = events.filter(event => event.type === 'edit').reduce((sum, event) => sum + characters(event.inserted || ''), 0);
  const total = typed + imported + unobserved;
  const importedShare = total ? imported / total : 0;
  const largest = imports.reduce((maximum, event) => Math.max(maximum, characters(event.inserted || '')), 0);
  const lastImportIndex = events.findLastIndex(event => event.type === 'paste' || event.type === 'drop');
  const lastImportLength = lastImportIndex >= 0 ? characters(events[lastImportIndex].inserted || '') : 0;
  const revisedAfterImport = lastImportIndex >= 0 ? events.slice(lastImportIndex + 1)
    .filter(event => ['typing', 'delete', 'edit'].includes(event.type))
    .reduce((sum, event) => sum + characters(event.deleted || ''), 0) : 0;

  const importPoints = weights.importedShare * importedShare;
  const blockPoints = largest >= largeImportCharacters && total ? weights.largestBlock * clamp(largest / (total * 0.8)) : 0;
  const revisionPoints = lastImportLength >= largeImportCharacters && importedShare >= 0.5
    ? weights.limitedRevision * importedShare * (1 - clamp(revisedAfterImport / (lastImportLength * 0.2))) : 0;
  const breakdown = [
    { key: 'importedShare', label: 'Pasted / dropped text share', maximum: weights.importedShare, points: round(importPoints), observation: `${Math.round(importedShare * 100)}% of entered characters came through paste or drop.` },
    { key: 'largestBlock', label: 'Large inserted block', maximum: weights.largestBlock, points: round(blockPoints), observation: `Largest pasted or dropped block: ${largest} characters. Blocks below ${largeImportCharacters} add no points.` },
    { key: 'limitedRevision', label: 'Limited revision after import', maximum: weights.limitedRevision, points: round(revisionPoints), observation: lastImportIndex < 0 ? 'No pasted or dropped text recorded.' : `${revisedAfterImport} characters removed or replaced after the latest import. Applies only when imported text is at least half of all input.` },
  ];
  let status = 'ready', label, score = null;
  if (words < minimumWords) { status = 'insufficient'; label = `Write at least ${minimumWords} words`; }
  else if (!total || unobserved / total > 0.1 || (imported > 0 && !imports.length)) { status = 'incomplete'; label = 'Incomplete activity record'; }
  else {
    score = Math.round(importPoints + blockPoints + revisionPoints);
    label = score >= 70 ? 'More review suggested' : score >= 35 ? 'Some review signals' : 'Few review signals';
  }
  return {
    method: ASSESSMENT_RULES.version, type: 'uncalibrated-heuristic', scope: 'cumulative-session',
    status, label, score, scale: { min: 0, max: 100 }, minimumWords, words,
    aiAuthorship: 'Undetermined', aiProbability: null,
    observations: { typed, imported, importedShare: round(importedShare * 100), largestImportedBlock: largest, revisedAfterLastImport: revisedAfterImport, unobserved },
    breakdown,
    explanation: status === 'insufficient' ? 'The demo needs a longer answer before showing a score.'
      : status === 'incomplete' ? 'Some input has no recorded typing or import source. Start a new session for a complete record.'
      : `${Math.round(importedShare * 100)}% pasted/dropped · largest block ${largest} characters`,
    limitations: 'A review signal, not an AI probability or an academic-integrity verdict. Human-written pasted text can score high; manually retyped AI text can score low. Rules and thresholds are unvalidated demo choices. Text removed later still contributes to session totals.',
  };
}
