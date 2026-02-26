import React, { useRef, useEffect, useState } from 'react';

const EMPTY = 0, BLACK = 1, WHITE = 2;

const BOARD_COLORS = {
  bg: '#dcb35c',
  line: '#5a4a2a',
  starPoint: '#5a4a2a',
};

function getStarPoints(size) {
  if (size === 19) return [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]];
  if (size === 13) return [[3,3],[3,9],[6,6],[9,3],[9,9]];
  if (size === 9) return [[2,2],[2,6],[4,4],[6,2],[6,6]];
  return [];
}

export default function Board({ board, boardSize, currentColor, onMove, disabled, lastMove }) {
  const canvasRef = useRef(null);
  const [hoverPos, setHoverPos] = useState(null);

  const padding = 32;
  const canvasSize = Math.min(600, window.innerWidth - 80);
  const cellSize = (canvasSize - padding * 2) / (boardSize - 1);

  useEffect(() => {
    draw();
  }, [board, hoverPos, lastMove]);

  function toCanvas(x, y) {
    return [padding + y * cellSize, padding + x * cellSize];
  }

  function fromCanvas(cx, cy) {
    const y = Math.round((cx - padding) / cellSize);
    const x = Math.round((cy - padding) / cellSize);
    if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return null;
    return [x, y];
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvasSize;

    ctx.clearRect(0, 0, w, w);

    // Board background
    ctx.fillStyle = BOARD_COLORS.bg;
    ctx.fillRect(0, 0, w, w);

    // Grid lines
    ctx.strokeStyle = BOARD_COLORS.line;
    ctx.lineWidth = 1;
    for (let i = 0; i < boardSize; i++) {
      const [x1, y1] = toCanvas(i, 0);
      const [x2, y2] = toCanvas(i, boardSize - 1);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toCanvas(0, i);
      const [x4, y4] = toCanvas(boardSize - 1, i);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }

    // Star points
    ctx.fillStyle = BOARD_COLORS.starPoint;
    for (const [sx, sy] of getStarPoints(boardSize)) {
      const [cx, cy] = toCanvas(sx, sy);
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // Stones
    const stoneRadius = cellSize * 0.45;
    for (let x = 0; x < boardSize; x++) {
      for (let y = 0; y < boardSize; y++) {
        if (board[x][y] === EMPTY) continue;
        const [cx, cy] = toCanvas(x, y);
        const isBlack = board[x][y] === BLACK;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(cx + 2, cy + 2, stoneRadius, 0, Math.PI * 2); ctx.fill();

        // Stone
        const grad = ctx.createRadialGradient(cx - stoneRadius * 0.3, cy - stoneRadius * 0.3, stoneRadius * 0.1, cx, cy, stoneRadius);
        if (isBlack) {
          grad.addColorStop(0, '#555');
          grad.addColorStop(1, '#111');
        } else {
          grad.addColorStop(0, '#fff');
          grad.addColorStop(1, '#ccc');
        }
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2); ctx.fill();

        // Last move marker
        if (lastMove && lastMove[0] === x && lastMove[1] === y) {
          ctx.fillStyle = isBlack ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
          ctx.beginPath(); ctx.arc(cx, cy, stoneRadius * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Hover preview
    if (hoverPos && !disabled && board[hoverPos[0]][hoverPos[1]] === EMPTY) {
      const [cx, cy] = toCanvas(hoverPos[0], hoverPos[1]);
      ctx.fillStyle = currentColor === BLACK ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2); ctx.fill();
    }
  }

  function handleMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(e.clientX - rect.left, e.clientY - rect.top);
    setHoverPos(pos);
  }

  function handleClick(e) {
    if (disabled) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(e.clientX - rect.left, e.clientY - rect.top);
    if (pos && board[pos[0]][pos[1]] === EMPTY) {
      onMove(pos[0], pos[1]);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      style={{ borderRadius: 8, cursor: disabled ? 'default' : 'pointer' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverPos(null)}
      onClick={handleClick}
    />
  );
}
