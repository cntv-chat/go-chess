// Go AI - multiple difficulty levels
import { EMPTY, BLACK, WHITE, cloneBoard, playMove, getValidMoves, calculateScore, createBoard } from './engine.js';

export const AI_EASY = 'easy';
export const AI_MEDIUM = 'medium';
export const AI_HARD = 'hard';

function getNeighbors(x, y, size) {
  const n = [];
  if (x > 0) n.push([x - 1, y]);
  if (x < size - 1) n.push([x + 1, y]);
  if (y > 0) n.push([x, y - 1]);
  if (y < size - 1) n.push([x, y + 1]);
  return n;
}

function getDiagonals(x, y, size) {
  const d = [];
  if (x > 0 && y > 0) d.push([x - 1, y - 1]);
  if (x > 0 && y < size - 1) d.push([x - 1, y + 1]);
  if (x < size - 1 && y > 0) d.push([x + 1, y - 1]);
  if (x < size - 1 && y < size - 1) d.push([x + 1, y + 1]);
  return d;
}

function findGroup(board, x, y) {
  const size = board.length;
  const color = board[x][y];
  if (color === EMPTY) return { stones: [], liberties: new Set() };
  const visited = new Set();
  const stones = [];
  const liberties = new Set();
  const stack = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (board[cx][cy] === EMPTY) { liberties.add(key); continue; }
    if (board[cx][cy] !== color) continue;
    stones.push([cx, cy]);
    for (const [nx, ny] of getNeighbors(cx, cy, size)) {
      if (!visited.has(`${nx},${ny}`)) stack.push([nx, ny]);
    }
  }
  return { stones, liberties };
}

// Influence map: flood-fill from each stone, decaying with distance
function buildInfluenceMap(board) {
  const size = board.length;
  const inf = Array.from({ length: size }, () => new Float32Array(size));
  const decay = 0.5;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (board[x][y] === EMPTY) continue;
      const sign = board[x][y] === BLACK ? 1 : -1;
      // BFS with decay
      const visited = new Set();
      const queue = [[x, y, 6]]; // strength 6
      while (queue.length) {
        const [cx, cy, str] = queue.shift();
        const key = cx * size + cy;
        if (visited.has(key) || str <= 0) continue;
        visited.add(key);
        inf[cx][cy] += sign * str;
        for (const [nx, ny] of getNeighbors(cx, cy, size)) {
          // Stones block influence propagation for the other side
          if (board[nx][ny] !== EMPTY && board[nx][ny] !== board[x][y]) continue;
          if (!visited.has(nx * size + ny)) queue.push([nx, ny, str * decay]);
        }
      }
    }
  }
  return inf;
}

// Estimate territory from influence map
function estimateTerritory(board, inf) {
  const size = board.length;
  let blackTerritory = 0, whiteTerritory = 0;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (board[x][y] === BLACK) blackTerritory++;
      else if (board[x][y] === WHITE) whiteTerritory++;
      else if (inf[x][y] > 1.5) blackTerritory++;
      else if (inf[x][y] < -1.5) whiteTerritory++;
    }
  }
  return { black: blackTerritory, white: whiteTerritory + 6.5 }; // komi
}

// Check if AI should resign
export function shouldResign(board, aiColor) {
  const inf = buildInfluenceMap(board);
  const territory = estimateTerritory(board, inf);
  const myScore = aiColor === BLACK ? territory.black : territory.white;
  const oppScore = aiColor === BLACK ? territory.white : territory.black;
  return oppScore - myScore > 30; // resign if behind by 30+
}

// Easy: random valid move
function easyMove(board, color, koPoint) {
  const moves = getValidMoves(board, color, koPoint);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

// Opening: prefer star points and 3-4 points in early game
function getOpeningMove(board, color, size, moveCount) {
  if (moveCount > 8) return null; // only first 8 moves
  const candidates = [];
  if (size === 19) {
    // Star points + 3-4 / 4-3 points
    const pts = [
      [3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15],
      [2,3],[3,2],[2,15],[3,16],[15,2],[16,3],[15,16],[16,15],
    ];
    for (const [x, y] of pts) {
      if (board[x][y] === EMPTY) candidates.push([x, y]);
    }
  } else if (size === 13) {
    const pts = [[3,3],[3,6],[3,9],[6,3],[6,6],[6,9],[9,3],[9,6],[9,9]];
    for (const [x, y] of pts) {
      if (board[x][y] === EMPTY) candidates.push([x, y]);
    }
  } else {
    const pts = [[2,2],[2,4],[2,6],[4,2],[4,4],[4,6],[6,2],[6,4],[6,6]];
    for (const [x, y] of pts) {
      if (board[x][y] === EMPTY) candidates.push([x, y]);
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Score a move with heuristics
function scoreMove(board, x, y, color, koPoint, inf, level) {
  const size = board.length;
  const opponent = color === BLACK ? WHITE : BLACK;
  const result = playMove(board, x, y, color, koPoint);
  if (!result) return null;

  let score = 0;

  // === Captures ===
  score += result.captured * 15;

  // === Influence-based: prefer moves in contested or opponent territory ===
  const mySign = color === BLACK ? 1 : -1;
  const infVal = inf[x][y] * mySign; // positive = my territory, negative = opponent's
  if (infVal < -0.5) score += 8;     // invade opponent area
  else if (infVal < 1) score += 4;   // contested area
  else if (infVal > 4) score -= 3;   // already my territory, low value

  // === Neighbor analysis ===
  let friendly = 0, enemy = 0, empty = 0;
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    if (board[nx][ny] === color) friendly++;
    else if (board[nx][ny] === opponent) enemy++;
    else empty++;
  }

  // === Threaten enemy groups ===
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    if (board[nx][ny] === opponent) {
      const group = findGroup(board, nx, ny);
      const lib = group.liberties.size;
      if (lib === 1) score += 25;      // capture!
      else if (lib === 2) score += 8;  // atari threat
      else if (lib === 3) score += 3;
    }
  }

  // === Save own groups in atari ===
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    if (board[nx][ny] === color) {
      const group = findGroup(board, nx, ny);
      if (group.liberties.size === 1) {
        const saved = findGroup(result.board, nx, ny);
        if (saved.liberties.size > 1) score += 20;
      }
    }
  }

  // === Self-atari penalty ===
  const selfGroup = findGroup(result.board, x, y);
  if (selfGroup.liberties.size === 1 && result.captured === 0) {
    score -= 15;
    if (selfGroup.stones.length > 1) score -= selfGroup.stones.length * 5; // worse for bigger groups
  }

  // === Edge penalty ===
  const edgeDist = Math.min(x, y, size - 1 - x, size - 1 - y);
  if (edgeDist === 0) score -= 5;
  else if (edgeDist === 1) score -= 2;

  // === Extend own groups (connectivity) ===
  score += friendly * 1.5;

  // === Star points bonus (opening) ===
  const sp = size === 19 ? [3, 9, 15] : size === 13 ? [3, 6, 9] : [2, 4, 6];
  if (sp.includes(x) && sp.includes(y)) score += 2;

  // === HARD-only enhancements ===
  if (level === 'hard') {
    // Diagonal connections (good shape)
    for (const [dx, dy] of getDiagonals(x, y, size)) {
      if (board[dx][dy] === color) score += 1.5;
    }

    // Cut opponent diagonal connections
    let oppDiag = 0;
    for (const [dx, dy] of getDiagonals(x, y, size)) {
      if (board[dx][dy] === opponent) oppDiag++;
    }
    if (oppDiag >= 2 && enemy === 0) score += 6;

    // Territory expansion: prefer moves that increase own territory
    const infAfter = buildInfluenceMap(result.board);
    const terBefore = estimateTerritory(board, inf);
    const terAfter = estimateTerritory(result.board, infAfter);
    const myBefore = color === BLACK ? terBefore.black : terBefore.white;
    const myAfter = color === BLACK ? terAfter.black : terAfter.white;
    score += (myAfter - myBefore) * 2;

    // Thickness: prefer groups with many liberties
    if (selfGroup.liberties.size >= 4) score += 3;
    if (selfGroup.stones.length >= 3 && selfGroup.liberties.size >= 5) score += 4;

    // Don't fill own eyes
    if (friendly >= 3 && empty === 0 && enemy === 0) score -= 20;

    // Big moves: prefer moves far from existing stones in mid-game
    let nearbyStones = 0;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && board[nx][ny] !== EMPTY)
          nearbyStones++;
      }
    }
    if (nearbyStones === 0 && edgeDist >= 3) score += 3; // big empty area, worth exploring
  }

  return { move: [x, y], score };
}

// Medium: heuristic scoring
function mediumMove(board, color, koPoint) {
  const moves = getValidMoves(board, color, koPoint);
  if (moves.length === 0) return null;
  const inf = buildInfluenceMap(board);
  const scored = [];
  for (const [x, y] of moves) {
    const s = scoreMove(board, x, y, color, koPoint, inf, 'medium');
    if (s) scored.push(s);
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.floor(Math.random() * top.length)].move;
}

// Hard: enhanced heuristic with opening book + territory awareness
function hardMove(board, color, koPoint, moveCount) {
  // Opening book
  const opening = getOpeningMove(board, color, board.length, moveCount);
  if (opening) return opening;

  const moves = getValidMoves(board, color, koPoint);
  if (moves.length === 0) return null;
  const inf = buildInfluenceMap(board);
  const scored = [];
  for (const [x, y] of moves) {
    const s = scoreMove(board, x, y, color, koPoint, inf, 'hard');
    if (s) scored.push(s);
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  // Pick best move (minimal randomness)
  return scored[0].move;
}

export function getAIMove(board, color, koPoint, difficulty = AI_MEDIUM, moveCount = 0) {
  switch (difficulty) {
    case AI_EASY: return easyMove(board, color, koPoint);
    case AI_HARD: return hardMove(board, color, koPoint, moveCount);
    case AI_MEDIUM:
    default: return mediumMove(board, color, koPoint);
  }
}
