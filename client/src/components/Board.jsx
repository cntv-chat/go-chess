import React, { useRef, useEffect, useState, useCallback } from 'react';

const EMPTY = 0, BLACK = 1, WHITE = 2;

const THEMES = {
  classic: { name: '经典', bg: '#dcb35c', line: '#5a4a2a', starPoint: '#5a4a2a' },
  walnut: { name: '胡桃木', bg: '#8B6914', line: '#3e2c0a', starPoint: '#3e2c0a' },
  bamboo: { name: '竹青', bg: '#a8c686', line: '#3a5a2a', starPoint: '#3a5a2a' },
  night: { name: '夜间', bg: '#2a2a3a', line: '#666680', starPoint: '#666680' },
  paper: { name: '纸白', bg: '#f5f0e8', line: '#888', starPoint: '#888' },
};

const THEME_KEYS = Object.keys(THEMES);

function getStarPoints(size) {
  if (size === 19) return [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]];
  if (size === 13) return [[3,3],[3,9],[6,6],[9,3],[9,9]];
  if (size === 9) return [[2,2],[2,6],[4,4],[6,2],[6,6]];
  return [];
}

const toolbarStyle = {
  display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
  flexWrap: 'wrap', marginBottom: 6,
};
const themeBtn = (active) => ({
  padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
  border: active ? '2px solid #667eea' : '1px solid rgba(255,255,255,0.15)',
  background: active ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.06)',
  color: active ? '#667eea' : '#aaa', fontWeight: active ? 700 : 400,
});
const zoomBtn = {
  padding: '4px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
  color: '#ccc', fontWeight: 700, userSelect: 'none',
};

export default function Board({ board, boardSize, currentColor, onMove, disabled, lastMove }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [canvasSize, setCanvasSize] = useState(500);
  const [theme, setTheme] = useState(() => localStorage.getItem('go-theme') || 'classic');
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('go-zoom')) || 100);

  useEffect(() => { localStorage.setItem('go-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('go-zoom', zoom); }, [zoom]);

  const zoomIn = () => setZoom(z => Math.min(200, z + 20));
  const zoomOut = () => setZoom(z => Math.max(60, z - 20));
  const zoomReset = () => setZoom(100);

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

  const scaledSize = Math.round(canvasSize * zoom / 100);
  const padding = scaledSize < 400 ? 20 : 32;
  const cellSize = (scaledSize - padding * 2) / (boardSize - 1);

  function toCanvas(x, y) {
    return [padding + y * cellSize, padding + x * cellSize];
  }

  function fromCanvas(cx, cy) {
    const y = Math.round((cx - padding) / cellSize);
    const x = Math.round((cy - padding) / cellSize);
    if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return null;
    return [x, y];
  }

  const colors = THEMES[theme] || THEMES.classic;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = scaledSize;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = w * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = w + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, w);

    // Grid
    ctx.strokeStyle = colors.line;
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
    ctx.fillStyle = colors.starPoint;
    const spRadius = scaledSize < 400 ? 2.5 : 3.5;
    for (const [sx, sy] of getStarPoints(boardSize)) {
      const [cx, cy] = toCanvas(sx, sy);
      ctx.beginPath(); ctx.arc(cx, cy, spRadius, 0, Math.PI * 2); ctx.fill();
    }

    // Stones
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

    // Hover
    if (hoverPos && !disabled && board[hoverPos[0]][hoverPos[1]] === EMPTY) {
      const [cx, cy] = toCanvas(hoverPos[0], hoverPos[1]);
      ctx.fillStyle = currentColor === BLACK ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2); ctx.fill();
    }
  }, [board, hoverPos, lastMove, scaledSize, boardSize, currentColor, disabled, padding, cellSize, colors]);

  useEffect(() => { draw(); }, [draw]);

  function handleMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(e.clientX - rect.left, e.clientY - rect.top);
    setHoverPos(pos);
  }

  function handleClick(e) {
    if (disabled) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(e.clientX - rect.left, e.clientY - rect.top);
    if (pos && board[pos[0]][pos[1]] === EMPTY) onMove(pos[0], pos[1]);
  }

  function handleTouch(e) {
    if (disabled) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = fromCanvas(touch.clientX - rect.left, touch.clientY - rect.top);
    if (pos && board[pos[0]][pos[1]] === EMPTY) onMove(pos[0], pos[1]);
  }

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: 600, flexShrink: 0 }}>
      <div style={toolbarStyle}>
        {THEME_KEYS.map(k => (
          <button key={k} style={themeBtn(theme === k)} onClick={() => setTheme(k)}>{THEMES[k].name}</button>
        ))}
        <span style={{ color: '#555', margin: '0 2px' }}>|</span>
        <button style={zoomBtn} onClick={zoomOut}>−</button>
        <span style={{ fontSize: 11, color: '#999', minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
        <button style={zoomBtn} onClick={zoomIn}>+</button>
        {zoom !== 100 && <button style={{ ...zoomBtn, fontSize: 11 }} onClick={zoomReset}>重置</button>}
      </div>
      <div style={{ overflow: 'auto', maxHeight: '75vh', display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          style={{ borderRadius: 8, cursor: disabled ? 'default' : 'pointer', touchAction: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPos(null)}
          onClick={handleClick}
          onTouchEnd={handleTouch}
        />
      </div>
    </div>
  );
}
