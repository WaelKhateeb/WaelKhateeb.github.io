# ProofLab

A browser-only Tiptap writing workspace at https://waelkhateeb.github.io/authorship-lab/.

## Develop

```sh
npm ci
npm test
npm run build
```

Serve this directory with any static HTTP server. GitHub Pages serves `index.html`, `styles.css`, and the checked-in `app.js` bundle directly. Rebuild `app.js` after changing files in `src/`.

Tiptap, ProseMirror, and KaTeX are bundled together, avoiding duplicate ProseMirror plugin instances from separate CDN modules. Exact dependencies and a lockfile make the build repeatable. No runtime network dependencies are needed. KaTeX generates native MathML for equation preview, editing, and replay; current Chrome, Firefox, and Safari render it without external math fonts or CSS.

## Tracking

- Typed text, spaces, and deleted characters come from actual ProseMirror document replacements. Formatting and undo/redo do not inflate typing totals.
- Backspace presses are counted separately from deleted characters. Paste counts reflect text actually inserted into the editor.
- Pauses are counted once per idle interval after an edit, while the editor is focused and the tab is visible. Leaving the editor or tab is tracked separately.
- Every document update has a replay snapshot. Typing bursts are grouped only in the activity list and event log. IME composition is counted from its final text.
- Undo does not subtract cumulative observations. Equations and formatting are separate event types.
- The session is restored from sessionStorage after refresh. Storage failure leaves the in-memory editor usable and prompts the user to export. Export contains the answer, events, counters, and replay snapshots.
- A new session clears the document and editor undo history. Finish marks a local attempt; further editing resumes it.

This demo records activity only inside its editor and tab. It has no server, AI-authorship classifier, automatic grading, or remote submission. Activity alone cannot establish AI use.
