// Go AI - multiple difficulty levels
import { EMPTY, BLACK, WHITE, cloneBoard, playMove, getValidMoves, calculateScore, createBoard } from './engine.js';

// Difficulty levels
export const AI_EASY = 'easy';       // Random valid moves
export const AI_MEDIUM = 'medium';   // Greedy - captures + basic strategy
export const AI_HARD = 'hard';       // Monte Carlo Tree Search (light)

function getNeighbors(x, y, size) {
  const n = [];
  if (x > 0) n.push([x - 1, y]);
  if (x < size - 1) n.push([x + 1, y]);
  if (y > 0) n.push([x, y - 1]);
  if (y < size - 1) n.push([x, y + 1]);
  return n;
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
  if (moves.length === 0) return null; // pass
  return moves[Math.floor(Math.random() * moves.length)];
}

// Medium: score each move with heuristics
function mediumMove(board, color, koPoint) {
  const moves = getValidMoves(board, color, koPoint);
  if (moves.length === 0) return null;

  const size = board.length;
  const opponent = color === BLACK ? WHITE : BLACK;
  const scored = [];

  for (const [x, y] of moves) {
    let score = 0;
    const result = playMove(board, x, y, color, koPoint);
    if (!result) continue;

    // Reward captures
    score += result.captured * 10;

    // Reward moves near center
    const cx = size / 2, cy = size / 2;
    const dist = Math.abs(x - cx) + Math.abs(y - cy);
    score += Math.max(0, size - dist) * 0.5;

    // Reward extending own groups
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      if (board[nx][ny] === color) score += 2;
    }

    // Reward threatening opponent groups with few liberties
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      if (board[nx][ny] === opponent) {
        const group = findGroup(board, nx, ny);
        if (group.liberties.size <= 2) score += 5;
        if (group.liberties.size === 1) score += 15;
      }
    }

    // Penalize self-atari
    const selfGroup = findGroup(result.board, x, y);
    if (selfGroup.liberties.size === 1) score -= 8;

    // Avoid edges early (first 30 moves approximation)
    if (x === 0 || x === size - 1 || y === 0 || y === size - 1) score -= 3;

    // Star points bonus for opening
    const starPoints = size === 19 ? [3, 9, 15] : size === 13 ? [3, 6, 9] : [2, 4, 6];
    if (starPoints.includes(x) && starPoints.includes(y) && board[x][y] === EMPTY) {
      score += 4;
    }

    scored.push({ move: [x, y], score });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);

  // Add some randomness - pick from top 3
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.floor(Math.random() * top.length)].move;
}

// Hard: lightweight Monte Carlo simulation
function hardMove(board, color, koPoint) {
  const moves = getValidMoves(board, color, koPoint);
  if (moves.length === 0) return null;

  const simulations = 100;
  const scores = new Map();

  for (const [x, y] of moves) {
    const key = `${x},${y}`;
    let wins = 0;

    for (let s = 0; s < simulations; s++) {
      const result = simulateGame(board, x, y, color, koPoint);
      if (result === color) wins++;
    }

    scores.set(key, wins / simulations);
  }

  // Pick best
  let bestMove = moves[0];
  let bestScore = -1;
  for (const [x, y] of moves) {
    const s = scores.get(`${x},${y}`) || 0;
    if (s > bestScore) {
      bestScore = s;
      bestMove = [x, y];
    }
  }

  return bestMove;
}

function simulateGame(board, firstX, firstY, firstColor, koPoint) {
  let simBoard = cloneBoard(board);
  const result = playMove(simBoard, firstX, firstY, firstColor, koPoint);
  if (!result) return firstColor === BLACK ? WHITE : BLACK;

  simBoard = result.board;
  let currentColor = firstColor === BLACK ? WHITE : BLACK;
  let ko = result.koPoint;
  let passes = 0;
  const maxMoves = simBoard.length * simBoard.length;

  for (let i = 0; i < maxMoves && passes < 2; i++) {
    const validMoves = getValidMoves(simBoard, currentColor, ko);
    if (validMoves.length === 0) {
      passes++;
      currentColor = currentColor === BLACK ? WHITE : BLACK;
      continue;
    }

    passes = 0;
    const [mx, my] = validMoves[Math.floor(Math.random() * validMoves.length)];
    const moveResult = playMove(simBoard, mx, my, currentColor, ko);
    if (moveResult) {
      simBoard = moveResult.board;
      ko = moveResult.koPoint;
    }
    currentColor = currentColor === BLACK ? WHITE : BLACK;
  }

  const score = calculateScore(simBoard);
  return score.black > score.white ? BLACK : WHITE;
}

export function getAIMove(board, color, koPoint, difficulty = AI_MEDIUM) {
  switch (difficulty) {
    case AI_EASY: return easyMove(board, color, koPoint);
    case AI_HARD: return hardMove(board, color, koPoint);
    case AI_MEDIUM:
    default: return mediumMove(board, color, koPoint);
  }
}
