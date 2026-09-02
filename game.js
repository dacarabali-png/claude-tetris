'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris acero)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const startBestCombo = document.getElementById('start-best-combo');
const startMaxLines = document.getElementById('start-max-lines');
const startRecordsTable = document.getElementById('start-records-table');
const overlayBestCombo = document.getElementById('overlay-best-combo');
const overlayMaxLines = document.getElementById('overlay-max-lines');
const overlayRecordsTable = document.getElementById('overlay-records-table');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const resetRecordsBtnStart = document.getElementById('reset-records-btn-start');
const resetRecordsBtnOverlay = document.getElementById('reset-records-btn-overlay');

const HIGHSCORES_KEY = 'tetris-highscores';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo;
// Transient UI state for the "you made the top 5" name-entry flow. Not game state: reset
// explicitly wherever it matters rather than inside init()'s state-reset block.
let pendingRecord = null;
// Theme preference, not game state: intentionally left out of init()'s reset so it survives restarts.
let gridColor, blockHighlight;

function readThemeColors() {
  const style = getComputedStyle(document.body);
  gridColor = style.getPropertyValue('--grid-color').trim();
  blockHighlight = style.getPropertyValue('--block-highlight').trim();
}

function setTheme(isLight) {
  document.body.classList.toggle('light-theme', isLight);
  localStorage.setItem('tetris-light-theme', isLight ? '1' : '0');
  readThemeColors();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = blockHighlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (gameOver) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function defaultRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return defaultRecords();
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.scores)) return defaultRecords();
    const scores = data.scores
      .filter(r => r && typeof r.score === 'number' && typeof r.name === 'string')
      .slice(0, 5);
    return {
      scores,
      bestCombo: typeof data.bestCombo === 'number' ? data.bestCombo : 0,
      maxLines: typeof data.maxLines === 'number' ? data.maxLines : 0,
    };
  } catch (e) {
    return defaultRecords();
  }
}

function saveRecords(data) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(data));
  } catch (e) {
    // Storage unavailable/full/blocked (e.g. private browsing) — fail silently, game still works.
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderRecordsTable(tableEl, scores, highlightIndex) {
  const tbody = tableEl.querySelector('tbody');
  tbody.innerHTML = '';
  if (!scores.length) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'Sin records todavía';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  scores.forEach((rec, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('new-record');
    tr.innerHTML =
      `<td class="rank-cell">${i + 1}</td>` +
      `<td>${escapeHtml(rec.name)}</td>` +
      `<td class="score-cell">${rec.score.toLocaleString()}</td>` +
      `<td>N${rec.level ?? '-'} L${rec.lines ?? '-'}</td>` +
      `<td>x${rec.combo ?? 0}</td>`;
    tbody.appendChild(tr);
  });
}

function refreshRecordsUI(highlightIndex, data) {
  data = data || loadRecords();
  startBestCombo.textContent = data.bestCombo;
  startMaxLines.textContent = data.maxLines;
  renderRecordsTable(startRecordsTable, data.scores);
  overlayBestCombo.textContent = data.bestCombo;
  overlayMaxLines.textContent = data.maxLines;
  renderRecordsTable(overlayRecordsTable, data.scores, highlightIndex);
}

function handleResetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los records? Esta acción no se puede deshacer.')) return;
  localStorage.removeItem(HIGHSCORES_KEY);
  refreshRecordsUI();
}

function saveHighscore() {
  if (!pendingRecord) return;
  const name = nameInput.value.trim() || 'Jugador';
  const data = loadRecords();
  const record = {
    name,
    score: pendingRecord.score,
    lines: pendingRecord.lines,
    level: pendingRecord.level,
    combo: pendingRecord.combo,
    date: new Date().toISOString().slice(0, 10),
  };
  data.scores.push(record);
  data.scores.sort((a, b) => b.score - a.score);
  data.scores = data.scores.slice(0, 5);
  data.bestCombo = Math.max(data.bestCombo, record.combo);
  data.maxLines = Math.max(data.maxLines, record.lines);
  saveRecords(data);

  const highlightIndex = data.scores.indexOf(record);
  pendingRecord = null;
  nameEntry.classList.add('hidden');
  refreshRecordsUI(highlightIndex >= 0 ? highlightIndex : undefined, data);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  animId = null;
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');

  // All-time bestCombo/maxLines are independent of whether the score itself makes the top 5.
  const data = loadRecords();
  let statsChanged = false;
  if (maxCombo > data.bestCombo) { data.bestCombo = maxCombo; statsChanged = true; }
  if (lines > data.maxLines) { data.maxLines = lines; statsChanged = true; }

  const qualifies = data.scores.length < 5 || score > data.scores[data.scores.length - 1].score;
  if (statsChanged) saveRecords(data);

  if (qualifies) {
    pendingRecord = { score, lines, level, combo: maxCombo };
    nameInput.value = 'Jugador';
    nameEntry.classList.remove('hidden');
    setTimeout(() => { nameInput.focus(); nameInput.select(); }, 0);
  } else {
    pendingRecord = null;
    nameEntry.classList.add('hidden');
  }
  refreshRecordsUI(undefined, data);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function showStartScreen() {
  board = createBoard();
  gameOver = true; // keeps draw() from touching the (still unset) current/next piece
  draw();
  refreshRecordsUI();
  startScreen.classList.remove('hidden');
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  pendingRecord = null;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  startScreen.classList.add('hidden');
  refreshRecordsUI();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function startNewGame() {
  if (pendingRecord && !confirm('Todavía no guardaste tu nombre para el nuevo record. ¿Reiniciar de todos modos y perderlo?')) {
    return;
  }
  init();
}

restartBtn.addEventListener('click', startNewGame);
playBtn.addEventListener('click', startNewGame);

saveScoreBtn.addEventListener('click', saveHighscore);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveHighscore();
});

resetRecordsBtnStart.addEventListener('click', handleResetRecords);
resetRecordsBtnOverlay.addEventListener('click', handleResetRecords);

themeToggle.addEventListener('change', () => setTheme(themeToggle.checked));

const savedLightTheme = localStorage.getItem('tetris-light-theme') === '1';
themeToggle.checked = savedLightTheme;
setTheme(savedLightTheme);

showStartScreen();
