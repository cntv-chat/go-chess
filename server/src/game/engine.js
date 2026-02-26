// Go game engine - handles rules, captures, ko, scoring

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export function createBoard(size = 19) {
  return Array.from({ length: size }, () => new Array(size).fill(EMPTY));
}

export function cloneBoard(board) {
  return board.map(row => [...row]);
}

function getNeighbors(x, y, size) {
  const neighbors = [];
  if (x > 0) neighbors.push([x - 1, y]);
  if (x < size - 1) neighbors.push([x + 1, y]);
  if (y > 0) neighbors.push([x, y - 1]);
  if (y < size - 1) neighbors.push([x, y + 1]);
  return neighbors;
}

// Find connected group of same-color stones
function getGroup(board, x, y) {
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

    if (board[cx][cy] === EMPTY) {
      liberties.add(key);
      continue;
    }
    if (board[cx][cy] !== color) continue;

    stones.push([cx, cy]);
    for (const [nx, ny] of getNeighbors(cx, cy, size)) {
      if (!visited.has(`${nx},${ny}`)) stack.push([nx, ny]);
    }
  }
  return { stones, liberties };
}

// Remove captured stones, return count
function removeCaptures(board, color) {
  const size = board.length;
  const opponent = color === BLACK ? WHITE : BLACK;
  let captured = 0;
  const capturedStones = [];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (board[x][y] === opponent) {
        const group = getGroup(board, x, y);
        if (group.liberties.size === 0) {
          for (const [sx, sy] of group.stones) {
            board[sx][sy] = EMPTY;
            capturedStones.push([sx, sy]);
          }
          captured += group.stones.length;
        }
      }
    }
  }
  return { captured, capturedStones };
}

function boardToString(board) {
  return board.map(row => row.join('')).join('|');
}

export function isValidMove(board, x, y, color, koPoint) {
  const size = board.length;
  if (x < 0 || x >= size || y < 0 || y >= size) return false;
  if (board[x][y] !== EMPTY) return false;

  // Ko rule
  if (koPoint && koPoint[0] === x && koPoint[1] === y) return false;

  // Try the move
  const testBoard = cloneBoard(board);
  testBoard[x][y] = color;
  removeCaptures(testBoard, color);

  // Check suicide
  const group = getGroup(testBoard, x, y);
  if (group.liberties.size === 0) return false;

  return true;
}

export function playMove(board, x, y, color, koPoint) {
  if (!isValidMove(board, x, y, color, koPoint)) return null;

  const newBoard = cloneBoard(board);
  newBoard[x][y] = color;
  const { captured, capturedStones } = removeCaptures(newBoard, color);

  // Detect ko
  let newKo = null;
  if (captured === 1 && capturedStones.length === 1) {
    const group = getGroup(newBoard, x, y);
    if (group.stones.length === 1 && group.liberties.size === 1) {
      newKo = capturedStones[0];
    }
  }

  return { board: newBoard, captured, koPoint: newKo };
}

// Simple territory scoring (Chinese rules)
export function calculateScore(board, komi = 6.5) {
  const size = board.length;
  const visited = Array.from({ length: size }, () => new Array(size).fill(false));
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let blackStones = 0;
  let whiteStones = 0;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (board[x][y] === BLACK) blackStones++;
      else if (board[x][y] === WHITE) whiteStones++;
    }
  }

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (board[x][y] !== EMPTY || visited[x][y]) continue;

      // BFS to find empty region
      const region = [];
      const borders = new Set();
      const stack = [[x, y]];

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cx >= size || cy < 0 || cy >= size) continue;
        if (visited[cx][cy]) continue;

        if (board[cx][cy] !== EMPTY) {
          borders.add(board[cx][cy]);
          continue;
        }

        visited[cx][cy] = true;
        region.push([cx, cy]);
        for (const [nx, ny] of getNeighbors(cx, cy, size)) {
          stack.push([nx, ny]);
        }
      }

      if (borders.size === 1) {
        if (borders.has(BLACK)) blackTerritory += region.length;
        else if (borders.has(WHITE)) whiteTerritory += region.length;
      }
    }
  }

  return {
    black: blackStones + blackTerritory,
    white: whiteStones + whiteTerritory + komi,
    blackTerritory,
    whiteTerritory,
    blackStones,
    whiteStones,
    komi
  };
}

// Get all valid moves for a color
export function getValidMoves(board, color, koPoint) {
  const size = board.length;
  const moves = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (isValidMove(board, x, y, color, koPoint)) {
        moves.push([x, y]);
      }
    }
  }
  return moves;
}
