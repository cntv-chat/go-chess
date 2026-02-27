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

// Easy: random valid move
function easyMove(board, color, koPoint) {
  const moves = getValidMoves(board, color, koPoint);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

// Shared scoring function
function scoreMove(board, x, y, color, koPoint, level) {
  const size = board.length;
  const opponent = color === BLACK ? WHITE : BLACK;
  const result = playMove(board, x, y, color, koPoint);
  if (!result) return null;

  let score = 0;

  // Captures (high value)
  score += result.captured * 12;

  // Center preference
  const cx = (size - 1) / 2, cy = (size - 1) / 2;
  const dist = Math.abs(x - cx) + Math.abs(y - cy);
  score += Math.max(0, size - dist) * 0.3;

  // Neighbor analysis
  let friendlyNeighbors = 0, enemyNeighbors = 0, emptyNeighbors = 0;
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    if (board[nx][ny] === color) friendlyNeighbors++;
    else if (board[nx][ny] === opponent) enemyNeighbors++;
    else emptyNeighbors++;
  }

  // Extend own groups
  score += friendlyNeighbors * 1.5;

  // Threaten enemy groups
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    if (board[nx][ny] === opponent) {
      const group = findGroup(board, nx, ny);
      if (group.liberties.size === 1) score += 20; // atari!
      else if (group.liberties.size === 2) score += 6;
      else if (group.liberties.size === 3) score += 2;
    }
  }

  // Self-atari penalty
  const selfGroup = findGroup(result.board, x, y);
  if (selfGroup.liberties.size === 1) score -= 10;
  if (selfGroup.liberties.size === 2 && selfGroup.stones.length === 1) score -= 3;

  // Edge penalty (early game)
  if (x === 0 || x === size - 1 || y === 0 || y === size - 1) score -= 4;
  if (x === 1 || x === size - 2 || y === 1 || y === size - 2) score -= 1;

  // Star points bonus
  const sp = size === 19 ? [3, 9, 15] : size === 13 ? [3, 6, 9] : [2, 4, 6];
  if (sp.includes(x) && sp.includes(y)) score += 3;

  // === Hard-only enhancements ===
  if (level === 'hard') {
    // Save own groups in atari
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      if (board[nx][ny] === color) {
        const group = findGroup(board, nx, ny);
        if (group.liberties.size === 1) {
          const savedGroup = findGroup(result.board, nx, ny);
          if (savedGroup.liberties.size > 1) score += 15; // escaped atari
        }
      }
    }

    // Diagonal connections (good shape)
    for (const [dx, dy] of getDiagonals(x, y, size)) {
      if (board[dx][dy] === color) score += 1;
    }

    // Cut opponent connections
    let oppDiag = 0;
    for (const [dx, dy] of getDiagonals(x, y, size)) {
      if (board[dx][dy] === opponent) oppDiag++;
    }
    if (oppDiag >= 2 && enemyNeighbors === 0) score += 4; // cutting point

    // Influence: count stones in 3-radius
    let myInfluence = 0, oppInfluence = 0;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        if (Math.abs(dx) + Math.abs(dy) > 3) continue;
        if (board[nx][ny] === color) myInfluence++;
        else if (board[nx][ny] === opponent) oppInfluence++;
      }
    }
    // Prefer moves in contested areas
    if (oppInfluence > 0 && myInfluence > 0) score += 3;
    // Expand into empty areas
    if (oppInfluence === 0 && myInfluence === 0) score += 1;

    // Eye-making: if surrounded by own stones, less valuable (already alive)
    if (friendlyNeighbors >= 3) score -= 2;

    // Ladder breaker: if capturing would create a ladder, bonus
    if (result.captured > 0) score += 3;

    // Thickness: prefer moves that create groups with 3+ liberties
    if (selfGroup.liberties.size >= 3) score += 2;
    if (selfGroup.stones.length >= 3 && selfGroup.liberties.size >= 4) score += 3;
  }

  return { move: [x, y], score };
}

// Medium: heuristic scoring
function mediumMove(board, color, koPoint) {
  const moves = getValidMoves(board, color, koPoint);
  if (moves.length === 0) return null;

  const scored = [];
  for (const [x, y] of moves) {
    const s = scoreMove(board, x, y, color, koPoint, 'medium');
    if (s) scored.push(s);
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.floor(Math.random() * top.length)].move;
}

// Hard: enhanced heuristic (no Monte Carlo, instant response)
function hardMove(board, color, koPoint) {
  const moves = getValidMoves(board, color, koPoint);
  if (moves.length === 0) return null;

  const scored = [];
  for (const [x, y] of moves) {
    const s = scoreMove(board, x, y, color, koPoint, 'hard');
    if (s) scored.push(s);
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  // Less randomness than medium — pick from top 2
  const top = scored.slice(0, Math.min(2, scored.length));
  return top[Math.floor(Math.random() * top.length)].move;
}

export function getAIMove(board, color, koPoint, difficulty = AI_MEDIUM) {
  switch (difficulty) {
    case AI_EASY: return easyMove(board, color, koPoint);
    case AI_HARD: return hardMove(board, color, koPoint);
    case AI_MEDIUM:
    default: return mediumMove(board, color, koPoint);
  }
}
