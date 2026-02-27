import React, { useRef, useEffect, useState, useCallback } from 'react';

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

function drawBoard(canvas, board, boardSize, currentColor, lastMove, hoverPos, disabled, size) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padding = size < 400 ? 20 : 32;
  const cellSize = (size - padding * 2) / (boardSize - 1);

  function toCanvas(x, y) {
    return [padding + y * cellSize, padding + x * cellSize];
  }

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = BOARD_COLORS.bg;
  ctx.fillRect(0, 0, size, size);

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

  ctx.fillStyle = BOARD_COLORS.starPoint;
  const spRadius = size < 400 ? 2.5 : 3.5;
  for (const [sx, sy] of getStarPoints(boardSize)) {
    const [cx, cy] = toCanvas(sx, sy);
    ctx.beginPath(); ctx.arc(cx, cy, spRadius, 0, Math.PI * 2); ctx.fill();
  }

  const stoneRadius = cellSize * 0.45;
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      if (board[x][y] === EMPTY) continue;
      const [cx, cy] = toCanvas(x, y);
      const isBlack = board[x][y] === BLACK;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(cx + 1.5, cy + 1.5, stoneRadius, 0, Math.PI * 2); ctx.fill();
      const grad = ctx.createRadialGradient(cx - stoneRadius * 0.3, cy - stoneRadius * 0.3, stoneRadius * 0.1, cx, cy, stoneRadius);
      if (isBlack) { grad.addColorStop(0, '#555'); grad.addColorStop(1, '#111'); }
      else { grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#ccc'); }
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2); ctx.fill();
      if (lastMove && lastMove[0] === x && lastMove[1] === y) {
        ctx.fillStyle = isBlack ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.arc(cx, cy, stoneRadius * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  if (hoverPos && !disabled && board[hoverPos[0]][hoverPos[1]] === EMPTY) {
    const [cx, cy] = toCanvas(hoverPos[0], hoverPos[1]);
    ctx.fillStyle = currentColor === BLACK ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2); ctx.fill();
  }
}

export default function Board({ board, boardSize, currentColor, onMove, disabled, lastMove }) {
  const canvasRef = useRef(null);
  const modalCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [modalHover, setModalHover] = useState(null);
  const [canvasSize, setCanvasSize] = useState(500);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setCanvasSize(Math.min(600, Math.max(280, w)));
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const padding = canvasSize < 400 ? 20 : 32;
  const cellSize = (canvasSize - padding * 2) / (boardSize - 1);

  function fromCanvas(cx, cy, sz) {
    const p = sz < 400 ? 20 : 32;
    const cs = (sz - p * 2) / (boardSize - 1);
    const y = Math.round((cx - p) / cs);
    const x = Math.round((cy - p) / cs);
    if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return null;
    return [x, y];
  }

  // Draw main board
  useEffect(() => {
    drawBoard(canvasRef.current, board, boardSize, currentColor, lastMove, hoverPos, disabled, canvasSize);
  }, [board, hoverPos, lastMove, canvasSize, boardSize, currentColor, disabled]);

  // Draw modal board
  const modalSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.85, 800);
  useEffect(() => {
    if (showModal) {
      drawBoard(modalCanvasRef.current, board, boardSize, currentColor, lastMove, modalHover, disabled, modalSize);
    }
  }, [showModal, board, modalHover, lastMove, modalSize, boardSize, currentColor, disabled]);

  function handleMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    setHoverPos(fromCanvas(e.clientX - rect.left, e.clientY - rect.top, canvasSize));
  }

  function handleClick(e) {
    if (disabled) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(e.clientX - rect.left, e.clientY - rect.top, canvasSize);
    if (pos && board[pos[0]][pos[1]] === EMPTY) onMove(pos[0], pos[1]);
  }

  function handleTouch(e) {
    if (disabled) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(touch.clientX - rect.left, touch.clientY - rect.top, canvasSize);
    if (pos && board[pos[0]][pos[1]] === EMPTY) onMove(pos[0], pos[1]);
  }

  // Modal handlers
  function handleModalMouseMove(e) {
    const rect = modalCanvasRef.current.getBoundingClientRect();
    setModalHover(fromCanvas(e.clientX - rect.left, e.clientY - rect.top, modalSize));
  }

  function handleModalClick(e) {
    if (disabled) return;
    const rect = modalCanvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(e.clientX - rect.left, e.clientY - rect.top, modalSize);
    if (pos && board[pos[0]][pos[1]] === EMPTY) onMove(pos[0], pos[1]);
  }

  function handleModalTouch(e) {
    if (disabled) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = modalCanvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(touch.clientX - rect.left, touch.clientY - rect.top, modalSize);
    if (pos && board[pos[0]][pos[1]] === EMPTY) onMove(pos[0], pos[1]);
  }

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: 600, flexShrink: 0 }}>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ borderRadius: 8, cursor: disabled ? 'default' : 'pointer', width: '100%', touchAction: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPos(null)}
          onClick={handleClick}
          onTouchEnd={handleTouch}
        />
        <button onClick={() => setShowModal(true)} style={{
          position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)',
          color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px',
          fontSize: 16, cursor: 'pointer', opacity: 0.7,
        }} title="放大棋盘">🔍</button>
      </div>

      {showModal && (
        <div className="board-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="board-modal-content" onClick={e => e.stopPropagation()}>
            <button className="board-modal-close" onClick={() => setShowModal(false)}>✕</button>
            <canvas
              ref={modalCanvasRef}
              style={{ borderRadius: 8, cursor: disabled ? 'default' : 'pointer', touchAction: 'none' }}
              onMouseMove={handleModalMouseMove}
              onMouseLeave={() => setModalHover(null)}
              onClick={handleModalClick}
              onTouchEnd={handleModalTouch}
            />
          </div>
        </div>
      )}
    </div>
  );
}
