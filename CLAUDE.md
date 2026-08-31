## Running the project

There is no `package.json`, build step, bundler, transpiler, or test/lint tooling — this is dependency-free vanilla HTML/CSS/JS. Verification is manual: open `index.html` in a browser and play. There is no automated test suite to run.

## Architecture

`init()` is both the initial bootstrap (called at the bottom of `game.js`) and the restart handler (bound to the restart button), so it must fully reset every module-level `let` binding declared at the top of the file.

## Invariants that span files

- **Piece type == color index == board cell value.** The integers 1-7 are simultaneously the index into `PIECES`, the index into `COLORS`, and the value `merge()` writes into `board` cells (later read back by `drawBlock()` to pick a color). Adding, removing, or reordering a piece means keeping `PIECES`, `COLORS`, and `randomPiece()`'s `Math.floor(Math.random() * 7) + 1` all in sync.
- **Canvas size must match board constants.** `index.html`'s `<canvas id="board">` hardcodes `width="300" height="600"`, which must equal `COLS * BLOCK` x `ROWS * BLOCK` from `game.js`. Changing `COLS`, `ROWS`, or `BLOCK` requires updating that markup too.
- **Next-piece preview assumes a 4x4 grid at 30px.** `drawNext()` hardcodes `NB = 30` and centers shapes in a 4-cell grid; `index.html`'s `#next-canvas` is hardcoded to `120x120` to match. Changing one requires changing the other.
- **Pause must reset `lastTime` before resuming.** `togglePause()` cancels the animation frame and, on resume, sets `lastTime = performance.now()` before calling `loop()` directly — skipping that reset would make the next frame's `dt` (and thus the drop accumulator) spike.

## Conventions

- ES6+ vanilla JS only (no transpiler, so don't introduce syntax that needs one).
- User-facing strings (overlay text, HUD, README) are in Spanish; keep new user-facing text Spanish for consistency. HUD labels (SCORE/LINES/LEVEL/NEXT) are the exception and stay in English.

See `README.md` for full details on controls, the scoring table, and tunable constants (`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`).
