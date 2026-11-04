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

## Experimental human-writing score

The activity panel calculates an explainable 0–100% human-like activity score after the answer reaches 50 words. The scale is **100% human-like, 0% AI-like**. `src/assessment.js` contains all rules. The JSON export includes the result, explicit scale direction, algorithm version, observations, deduction breakdown, and limitations. Restored sessions are recomputed. More than 10% unobserved-source input withholds the score.

Weights are hand-chosen demo values, unvalidated and uncalibrated:

| Rule | Maximum | Calculation |
| --- | ---: | --- |
| Imported share | 60 | 60 × pasted/dropped characters ÷ all entered characters |
| Large imported block | 25 | Applies to blocks of at least 120 characters; scales to 25 when one block is 80% of total input |
| Limited revision after import | 15 | Applies when the last imported block is at least 120 characters and imported text is at least half of input; reduced to zero after removing/replacing 20% of that last block |

The revision component is also scaled by imported share. The displayed score is **100 minus the rounded sum of these deductions**. Human-like scores above 65 receive the human-like activity label; scores from 31 to 65 receive the mixed label; scores up to 30 receive the AI-like activity label. Counts are cumulative session observations, so deleted imported text still contributes. Undo/redo, pauses, window switching, speed, grammar, vocabulary, disability/accessibility patterns, and equations are not independent suspicion rules.

**This score is not an authorship probability, proof of misconduct, or a human/AI classification.** Its AI-authorship verdict always remains `Undetermined`, with `aiProbability: null`. Pasting original human writing can give a low score; manually retyping AI-generated text can give a high score. Adding a real text-classifier model/service would be a separate integration, with its own validation requirements; none is connected here.

This demo records activity only inside its editor and tab. It has no server, trained AI-authorship classifier, automatic academic grading, or remote submission. Activity alone cannot establish AI use.
