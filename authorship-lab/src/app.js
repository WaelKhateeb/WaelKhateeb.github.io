import { Editor, Node, generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { isHistoryTransaction } from '@tiptap/pm/history';
import katex from 'katex';
import { characters, spaces, textDifference, transactionChanges, newSession } from './tracking.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'prooflab-session-v2';
const PROMPT = $('questionTitle').textContent;
let session = newSession(), editor, intent = null, composing = null;
let focused = false, lastEdit = 0, pauseRecorded = false, pauseEligible = false;
let playback = null, saveTimer = null, renderPending = false, resetting = false;
let view = 'write', equationTarget = null, equationSelection = null, storageAvailable = true;
const formatTime = ms => {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const relativeTime = at => formatTime(session.startedAt ? at - session.startedAt : 0);
const setIntent = (type, extra = {}) => { intent = { type, at: Date.now(), ...extra }; };
const mathOptions = { output: 'mathml', throwOnError: true, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20 };

function renderMath(latex, element, display = false) {
  // Native MathML: one accessible rendering, no remote fonts or stylesheet race.
  try { katex.render(latex, element, { ...mathOptions, displayMode: display }); }
  catch { element.textContent = latex; }
}

function mathExtension(block) {
  return Node.create({
    name: block ? 'mathBlock' : 'mathInline', group: block ? 'block' : 'inline',
    inline: !block, atom: true, selectable: true,
    addAttributes() { return { latex: { default: 'x', parseHTML: el => el.getAttribute('data-latex') || 'x' } }; },
    parseHTML() { return [{ tag: `${block ? 'div' : 'span'}[data-equation]` }]; },
    renderHTML({ node }) {
      return [block ? 'div' : 'span', { 'data-equation': block ? 'block' : 'inline', 'data-latex': node.attrs.latex, class: `math-node math-${block ? 'block' : 'inline'}` }, node.attrs.latex];
    },
    renderText({ node }) { return node.attrs.latex; },
    addNodeView() {
      return ({ node, getPos }) => {
        const dom = document.createElement(block ? 'div' : 'span');
        dom.className = `math-node math-${block ? 'block' : 'inline'}`;
        dom.contentEditable = 'false'; dom.title = 'Double-click to edit equation';
        const draw = current => { dom.dataset.latex = current.attrs.latex; dom.dataset.equation = block ? 'block' : 'inline'; renderMath(current.attrs.latex, dom, block); };
        draw(node);
        dom.addEventListener('dblclick', event => { event.preventDefault(); openEquation({ pos: getPos(), node }); });
        return { dom, update(next) { if (next.type !== node.type) return false; node = next; draw(node); return true; }, ignoreMutation: () => true };
      };
    },
  });
}
const extensions = [StarterKit.configure({ link: false, underline: false }), mathExtension(false), mathExtension(true)];

const eventLabels = {
  typing: ['Typing', '⌨'], delete: ['Text deleted', '⌫'], paste: ['Pasted text', '⧉'],
  undo: ['Undo', '↶'], redo: ['Redo', '↷'], history: ['Undo / redo', '↶'],
  format: ['Formatting', 'B'], equation: ['Equation', '∑'], pause: ['Writing pause', '◷'],
  focus: ['Editor focused', '○'], blur: ['Editor unfocused', '○'],
  hidden: ['Tab left', '↗'], visible: ['Tab returned', '↙'],
  drop: ['Text dropped', '↓'], edit: ['Document changed', '✎'], finish: ['Attempt finished', '✓'],
};

function addEvent(type, detail, extra = {}) {
  const at = Date.now();
  const previous = session.events.at(-1);
  // Group the live display, but preserve every transaction in replay snapshots.
  if (type === 'typing' && previous?.type === type && at - previous.at < 1400) {
    previous.at = at; previous.text += extra.text || ''; previous.characters += extra.characters || 0;
    previous.detail = `${previous.characters} characters typed`;
  } else session.events.push({ at, type, detail, ...extra });
  scheduleRender(); scheduleSave();
}

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; renderStats(); renderActivity(); updateClock(); });
}
function renderStats() {
  const m = session.metrics;
  for (const [id, key] of Object.entries({ statTyped: 'typed', statSpaces: 'spaces', statBackspaces: 'backspaces', statDeleted: 'deleted', statPastes: 'pastes', statPasted: 'pasted', statPauses: 'pauses', statEdits: 'edits', statFocus: 'focus' })) $(id).textContent = m[key].toLocaleString();
  $('eventTotal').textContent = `${session.events.length} events`;
  $('revisionCount').textContent = `${session.snapshots.length - 1} revisions`;
}
function renderActivity() {
  const list = $('activityList'); list.replaceChildren();
  if (!session.events.length) {
    const empty = document.createElement('li'); empty.className = 'empty'; empty.textContent = 'Type, make a correction, or paste a sentence to see it here.'; list.append(empty); return;
  }
  for (const event of session.events.slice(-12).reverse()) {
    const [label, icon] = eventLabels[event.type] || eventLabels.edit;
    const item = document.createElement('li'); item.className = 'activity-item'; item.dataset.type = event.type;
    const symbol = document.createElement('span'); symbol.className = 'event-icon'; symbol.textContent = icon; symbol.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div'); copy.className = 'event-copy';
    const title = document.createElement('strong'); title.textContent = label;
    const detail = document.createElement('small'); detail.textContent = event.detail;
    const time = document.createElement('time'); time.textContent = relativeTime(event.at);
    copy.append(title, detail); item.append(symbol, copy, time); list.append(item);
  }
}

function plainText() {
  return editor.getText({ blockSeparator: '\n', textSerializers: { mathInline: () => '', mathBlock: () => '' } });
}

function updateDocumentUI() {
  const text = plainText();
  const words = text.trim().match(/\S+/gu)?.length || 0;
  $('wordCount').textContent = words;
  $('characterCount').textContent = characters(text).toLocaleString();
  $('wordGuide').className = words >= 100 && words <= 150 ? 'in-range' : words > 150 ? 'over-limit' : '';
  $('wordGuide').textContent = words > 150 ? `${words - 150} words above the suggested length` : 'Suggested: 100–150 words';
  const first = editor.view.dom.querySelector('p');
  first?.classList.toggle('is-empty', editor.isEmpty);
  first?.setAttribute('data-placeholder', 'Start writing your answer…');
  $('finishBtn').textContent = session.finishedAt ? 'Finished ✓' : 'Finish attempt ↗';
  $('finishBtn').disabled = Boolean(session.finishedAt);
  updateToolbar();
}

function beginEdit() {
  if (!session.startedAt) session.startedAt = Date.now();
  session.finishedAt = null;
  lastEdit = Date.now(); pauseRecorded = false; pauseEligible = focused;
  $('submitMessage').className = '';
  $('submitMessage').textContent = storageAvailable ? 'Saved in this tab as you write.' : 'Tab storage is unavailable. Export to keep this session.';
  $('editorStatus').textContent = 'Tracking your changes';
}

function onDocumentChange({ transaction, appendedTransactions = [] }) {
  if (resetting) return;
  const transactions = [transaction, ...appendedTransactions];
  if (!transactions.some(tr => tr.docChanged)) return;
  beginEdit(); session.metrics.edits++;
  const changes = transactionChanges(transactions);
  const action = intent && Date.now() - intent.at < 2000 ? intent : null;
  const history = transactions.some(isHistoryTransaction);
  const pasted = transactions.some(tr => tr.getMeta('paste') || tr.getMeta('uiEvent') === 'paste');
  const dropped = transactions.some(tr => tr.getMeta('uiEvent') === 'drop');
  let kind = history ? (['undo', 'redo'].includes(action?.type) ? action.type : 'history') : pasted ? 'paste' : dropped ? 'drop' : action?.type;
  if (!kind) kind = changes.inserted ? 'typing' : changes.deleted ? 'delete' : 'format';
  let detail = '';
  if (composing !== null) {
    // Intermediate IME replacements are recorded as revisions, counted once at compositionend.
    kind = 'composition'; detail = 'Composing text';
  } else if (kind === 'typing') {
    session.metrics.typed += characters(changes.inserted); session.metrics.spaces += spaces(changes.inserted);
    session.metrics.deleted += characters(changes.deleted);
    detail = changes.inserted ? `${characters(changes.inserted)} characters typed` : 'New paragraph';
    addEvent(kind, detail, { text: changes.inserted, characters: characters(changes.inserted), deleted: changes.deleted });
  } else {
    if (kind === 'paste') {
      session.metrics.pastes++; session.metrics.pasted += characters(changes.inserted);
      detail = `${characters(changes.inserted)} characters inserted`;
    } else if (kind === 'delete') detail = changes.deleted ? `${characters(changes.deleted)} characters deleted` : 'Paragraph break removed';
    else if (kind === 'equation') detail = action?.detail || 'Equation updated';
    else if (kind === 'format') detail = action?.detail || 'Text formatting changed';
    else if (history) detail = 'Previous document state restored';
    else detail = 'Content updated';
    if (['delete', 'paste', 'drop', 'edit'].includes(kind)) session.metrics.deleted += characters(changes.deleted);
    addEvent(kind, detail, { inserted: changes.inserted, deleted: changes.deleted });
  }
  intent = null;
  session.document = editor.getJSON();
  session.snapshots.push({ at: Date.now(), reason: detail, doc: session.document });
  updateDocumentUI(); scheduleRender(); scheduleSave();
}

function handleKeyDown(_view, event) {
  if (event.isComposing) return false;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 'z') setIntent(event.shiftKey ? 'redo' : 'undo');
  else if (mod && event.key.toLowerCase() === 'y') setIntent('redo');
  else if (mod && ['b', 'i'].includes(event.key.toLowerCase())) setIntent('format', { detail: 'Text formatting shortcut' });
  else if (event.key === 'Backspace' || event.key === 'Delete') {
    if (event.key === 'Backspace') { session.metrics.backspaces++; scheduleRender(); scheduleSave(); }
    setIntent('delete');
  } else if (event.key === 'Enter') setIntent('typing');
  return false;
}
function beforeInput(_view, event) {
  const inputType = event.inputType || '';
  if (inputType === 'historyUndo' || inputType === 'historyRedo') setIntent(inputType === 'historyUndo' ? 'undo' : 'redo');
  else if (inputType === 'insertFromPaste') setIntent('paste');
  else if (inputType.startsWith('delete')) {
    // Mobile keyboards can issue beforeinput without a keyboard event.
    if (inputType === 'deleteContentBackward' && !(intent?.type === 'delete' && Date.now() - intent.at < 100)) { session.metrics.backspaces++; scheduleRender(); }
    setIntent('delete');
  } else if (inputType.startsWith('insert') && composing === null) setIntent('typing');
  return false;
}

function stopPlayback() {
  clearInterval(playback); playback = null;
  $('playReplay').textContent = 'Play'; $('playReplay').setAttribute('aria-label', 'Play replay');
}
function renderReplay(index) {
  const max = session.snapshots.length - 1, position = Math.max(0, Math.min(index, max));
  const snapshot = session.snapshots[position];
  $('replaySlider').max = max; $('replaySlider').value = position; $('replaySlider').disabled = !max; $('playReplay').disabled = !max;
  $('replayStep').textContent = `${position} / ${max}`;
  $('replayLabel').textContent = position ? `Revision ${position} · ${snapshot.reason}` : 'Initial state';
  $('replayTime').textContent = relativeTime(snapshot.at);
  if (!snapshot.doc) $('replayBody').innerHTML = '<p class="empty">Start writing to build a replay.</p>';
  else {
    // Regenerate from validated editor JSON, never from pasted/exported HTML.
    $('replayBody').innerHTML = generateHTML(snapshot.doc, extensions);
    $('replayBody').querySelectorAll('[data-equation]').forEach(el => renderMath(el.dataset.latex, el, el.dataset.equation === 'block'));
  }
}
function showView(next) {
  view = next; stopPlayback();
  $('writeView').hidden = next !== 'write'; $('replayView').hidden = next !== 'replay';
  for (const key of ['write', 'replay']) { $(`${key}Tab`).classList.toggle('active', next === key); $(`${key}Tab`).setAttribute('aria-pressed', String(next === key)); }
  if (next === 'replay') renderReplay(session.snapshots.length - 1);
  updateClock();
}

function updateClock() {
  const now = Date.now();
  $('elapsed').textContent = session.startedAt ? formatTime((session.finishedAt || now) - session.startedAt) : '00:00';
  const canPause = focused && !document.hidden && !session.finishedAt && pauseEligible && lastEdit;
  if (canPause && !pauseRecorded && now - lastEdit >= 5000) {
    pauseRecorded = true; session.metrics.pauses++;
    addEvent('pause', 'No editing for at least 5 seconds');
  }
  $('activityStatus').textContent = session.finishedAt ? 'Attempt finished' : view === 'replay' ? 'Viewing replay' : focused ? (canPause && now - lastEdit >= 5000 ? 'Paused' : lastEdit && now - lastEdit < 1500 ? 'Writing…' : 'Editor focused') : session.startedAt ? 'Editor unfocused' : 'Ready when you are';
}

function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveSession, 500); }
function saveSession() {
  if (!editor || resetting) return;
  session.document = editor.getJSON();
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session)); storageAvailable = true; }
  catch { storageAvailable = false; $('submitMessage').textContent = 'Tab storage is full or unavailable. Export to keep this session.'; }
}
function restoreSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === 2 && Array.isArray(saved.events) && Array.isArray(saved.snapshots) && saved.snapshots.length && saved.metrics && saved.document) {
      // Schema validation prevents stale or malformed tab data from breaking boot.
      for (const key of Object.keys(session.metrics)) if (!Number.isFinite(saved.metrics[key]) || saved.metrics[key] < 0) return;
      const schema = editor.schema;
      schema.nodeFromJSON(saved.document).check();
      for (const snapshot of saved.snapshots) if (snapshot.doc) schema.nodeFromJSON(snapshot.doc).check();
      session = saved;
      editor.commands.setContent(saved.document, { emitUpdate: false });
      $('editorStatus').textContent = saved.finishedAt ? 'Attempt finished' : 'Session restored';
    }
  } catch { /* A clean editor remains usable when storage is blocked or stale. */ }
}

function updateToolbar() {
  if (!editor) return;
  document.querySelectorAll('[data-command]').forEach(button => {
    const command = button.dataset.command;
    if (command === 'undo' || command === 'redo') button.disabled = !editor.can()[command]();
    else button.setAttribute('aria-pressed', String(editor.isActive(command)));
  });
}
function toolbarCommand(command) {
  setIntent(['undo', 'redo'].includes(command) ? command : 'format', { detail: `${command} formatting` });
  const chain = editor.chain().focus();
  const methods = { bold: 'toggleBold', italic: 'toggleItalic', bulletList: 'toggleBulletList', orderedList: 'toggleOrderedList', undo: 'undo', redo: 'redo' };
  chain[methods[command]]().run(); updateToolbar();
}

function previewEquation() {
  const latex = $('latexInput').value.trim();
  $('insertEquation').disabled = true; $('latexError').textContent = '';
  if (!latex) { $('latexPreview').textContent = 'Your equation preview'; return false; }
  try {
    katex.render(latex, $('latexPreview'), { ...mathOptions, displayMode: $('displayEquation').checked });
    $('insertEquation').disabled = false; return true;
  } catch (error) {
    $('latexPreview').textContent = 'Check your expression';
    $('latexError').textContent = error.message.replace(/^KaTeX parse error:\s*/, ''); return false;
  }
}
function openEquation(target = null) {
  equationTarget = target; equationSelection = { from: editor.state.selection.from, to: editor.state.selection.to };
  $('equationTitle').textContent = target ? 'Edit equation' : 'Insert an equation';
  $('insertEquation').textContent = target ? 'Save equation' : 'Insert equation';
  $('latexInput').value = target?.node.attrs.latex || 'x^2 + y^2 = r^2';
  $('displayEquation').checked = target?.node.type.name === 'mathBlock';
  previewEquation(); $('equationDialog').showModal(); $('latexInput').focus(); $('latexInput').select();
}

function exportSession() {
  saveSession();
  const data = { format: 'ProofLab 2.0', prompt: PROMPT, instruction: 'Give your opinion and support it with two reasons or examples. Suggested length: 100–150 words.', disclaimer: 'Descriptive writing activity; no inference of AI authorship.', ...session, exportedAt: new Date().toISOString(), answer: { text: editor.getText(), html: editor.getHTML() } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `prooflab-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function boot() {
  editor = new Editor({
    element: $('editor'), extensions, content: '<p></p>',
    editorProps: {
      attributes: { 'aria-label': 'Your answer', 'aria-multiline': 'true', spellcheck: 'true', autocapitalize: 'sentences' },
      handleKeyDown, handleTextInput() { if (composing === null) setIntent('typing'); return false; },
      handlePaste() { setIntent('paste'); return false; },
      handleDOMEvents: {
        beforeinput: beforeInput,
        cut() { setIntent('delete'); return false; },
        compositionstart() { composing = plainText(); return false; },
        compositionend() {
          const before = composing;
          setTimeout(() => {
            if (before === null || resetting) return;
            const change = textDifference(before, plainText()); composing = null;
            session.metrics.typed += characters(change.inserted); session.metrics.spaces += spaces(change.inserted); session.metrics.deleted += characters(change.deleted);
            if (change.inserted || change.deleted) addEvent('typing', `${characters(change.inserted)} characters composed`, { text: change.inserted, characters: characters(change.inserted), deleted: change.deleted });
          }, 0);
          return false;
        },
      },
    },
    onUpdate: onDocumentChange,
    onFocus() { focused = true; if (resetting) return; session.metrics.focus++; pauseEligible = false; addEvent('focus', 'Writing area selected'); },
    onBlur() { focused = false; pauseEligible = false; if (resetting) return; session.metrics.focus++; addEvent('blur', 'Writing area left'); },
    onSelectionUpdate: updateToolbar,
  });
  restoreSession();
  $('editor').setAttribute('aria-busy', 'false');
  $('trackingStatus').textContent = 'Live';
  if (!session.document) $('editorStatus').textContent = 'Ready to write';
  document.querySelectorAll('.toolbar button, #exportBtn, #resetBtn').forEach(button => { button.disabled = false; });
  document.querySelectorAll('[data-command]').forEach(button => {
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => toolbarCommand(button.dataset.command));
  });
  $('equationBtn').addEventListener('mousedown', event => event.preventDefault());
  $('equationBtn').addEventListener('click', () => {
    const { node, from } = editor.state.selection;
    openEquation(node?.type.name.startsWith('math') ? { node, pos: from } : null);
  });
  $('latexInput').addEventListener('input', previewEquation);
  $('displayEquation').addEventListener('change', previewEquation);
  document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => { $('latexInput').value = button.dataset.example; previewEquation(); $('latexInput').focus(); }));
  for (const id of ['closeEquation', 'cancelEquation']) $(id).addEventListener('click', () => $('equationDialog').close());
  $('equationDialog').addEventListener('close', () => { if (view === 'write') editor.commands.focus(); });
  $('equationForm').addEventListener('submit', event => {
    event.preventDefault(); if (!previewEquation()) return;
    const latex = $('latexInput').value.trim(), type = $('displayEquation').checked ? 'mathBlock' : 'mathInline';
    setIntent('equation', { detail: `${equationTarget ? 'Updated' : 'Inserted'} equation: ${latex}` });
    const range = equationTarget ? { from: equationTarget.pos, to: equationTarget.pos + equationTarget.node.nodeSize } : equationSelection;
    editor.chain().focus().insertContentAt(range, { type, attrs: { latex } }).run();
    $('equationDialog').close();
  });
  $('writeTab').addEventListener('click', () => showView('write'));
  $('replayTab').addEventListener('click', () => showView('replay'));
  $('replaySlider').addEventListener('input', event => { stopPlayback(); renderReplay(Number(event.target.value)); });
  $('playReplay').addEventListener('click', () => {
    if (playback) { stopPlayback(); return; }
    let position = Number($('replaySlider').value);
    if (position >= session.snapshots.length - 1) position = 0;
    renderReplay(position); $('playReplay').textContent = 'Pause'; $('playReplay').setAttribute('aria-label', 'Pause replay');
    playback = setInterval(() => { position++; renderReplay(position); if (position >= session.snapshots.length - 1) stopPlayback(); }, 250);
  });
  $('finishBtn').addEventListener('click', () => {
    if (editor.isEmpty) { $('submitMessage').textContent = 'Write an answer first.'; $('submitMessage').className = 'error'; return; }
    session.finishedAt = Date.now(); pauseEligible = false;
    addEvent('finish', 'Current answer marked as finished');
    $('submitMessage').className = 'success'; $('submitMessage').textContent = 'Attempt finished. You can review the replay or keep editing.';
    $('editorStatus').textContent = 'Attempt finished'; updateDocumentUI(); saveSession();
  });
  $('exportBtn').addEventListener('click', exportSession);
  $('resetBtn').addEventListener('click', () => { $('resetDialog').returnValue = ''; $('resetDialog').showModal(); });
  $('resetDialog').addEventListener('close', () => {
    if ($('resetDialog').returnValue !== 'reset') return;
    stopPlayback(); clearTimeout(saveTimer); resetting = true;
    // Reset editor history too, so undo cannot resurrect the previous attempt.
    session = newSession(); editor.destroy(); $('editor').replaceChildren();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* In-memory reset still works. */ }
    focused = false; lastEdit = 0; pauseRecorded = false; pauseEligible = false; intent = null; composing = null;
    location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    pauseEligible = false;
    addEvent(document.hidden ? 'hidden' : 'visible', document.hidden ? 'Browser tab moved to the background' : 'Browser tab became visible');
    if (document.hidden) saveSession();
  });
  window.addEventListener('pagehide', saveSession);
  updateDocumentUI(); renderStats(); renderActivity(); renderReplay(0); updateClock();
  setInterval(updateClock, 250);
}
try { boot(); }
catch (error) {
  console.error('ProofLab could not initialize:', error);
  $('editorStatus').textContent = 'Editor could not load. Please refresh.';
  $('trackingStatus').textContent = 'Offline'; $('trackingIndicator').classList.add('offline');
}
