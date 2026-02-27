import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../socket.js';
import Board from '../components/Board.jsx';
import { playPlaceSound, playCaptureSound, playPassSound, playEndSound } from '../sounds.js';

const BLACK = 1, WHITE = 2;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = {
  page: {
    display: 'flex', gap: 24, justifyContent: 'center', paddingTop: 24,
    flexWrap: 'wrap', alignItems: 'flex-start',
  },
  sidebar: { width: 280, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 240 },
  infoCard: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  playerRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' },
  stone: { width: 20, height: 20, borderRadius: '50%', flexShrink: 0 },
  activePlayer: { boxShadow: '0 0 0 3px #667eea' },
  playerName: { fontSize: 15, fontWeight: 600, flex: 1 },
  captures: { fontSize: 13, color: '#999' },
  timerText: { fontSize: 14, fontWeight: 700, fontFamily: 'monospace', marginLeft: 8 },
  timerLow: { color: '#f44336' },
  timerNormal: { color: '#4fc3f7' },
  status: {
    textAlign: 'center', padding: '10px 16px', borderRadius: 8,
    background: 'rgba(102,126,234,0.15)', fontSize: 14, fontWeight: 600,
  },
  actions: { display: 'flex', flexDirection: 'column', gap: 8 },
  moveList: {
    maxHeight: 180, overflowY: 'auto', fontSize: 12, color: '#aaa',
    background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10,
  },
  result: {
    textAlign: 'center', padding: 20, borderRadius: 12,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  },
  resultTitle: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  resultDetail: { fontSize: 13, color: '#aaa', marginBottom: 16 },
  gameInfo: { fontSize: 12, color: '#777', display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 8 },
  spectatorBadge: {
    fontSize: 12, color: '#999', textAlign: 'center', padding: '4px 0',
  },
};

export default function Game({ user, token, game: initialGame, onGameUpdate, onBack, spectating = false }) {
  const [game, setGame] = useState(initialGame);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(initialGame.timer || { black: 0, white: 0 });
  const [spectatorCount, setSpectatorCount] = useState(initialGame.spectators || 0);
  const prevMovesLen = useRef(initialGame.moves?.length || 0);
  const prevCaptures = useRef({ ...(initialGame.captures || { black: 0, white: 0 }) });
  const gameIdRef = useRef(initialGame.id);

  useEffect(() => {
    const socket = getSocket(token);

    // Rejoin spectate room on reconnect
    const handleReconnect = () => {
      if (spectating && gameIdRef.current) {
        socket.emit('spectate', { gameId: gameIdRef.current });
      }
    };
    socket.on('connect', handleReconnect);

    const handleUpdate = (g) => {
      // Sound effects
      if (g.moves && g.moves.length > prevMovesLen.current) {
        const lastMove = g.moves[g.moves.length - 1];
        if (lastMove.pass) {
          playPassSound();
        } else {
          const totalCapNow = (g.captures?.black || 0) + (g.captures?.white || 0);
          const totalCapPrev = (prevCaptures.current.black || 0) + (prevCaptures.current.white || 0);
          if (totalCapNow > totalCapPrev) playCaptureSound();
          else playPlaceSound();
        }
      }
      prevMovesLen.current = g.moves?.length || 0;
      prevCaptures.current = { ...(g.captures || { black: 0, white: 0 }) };

      setGame(g);
      if (g.timer) setTimer(g.timer);
    };

    const handleEnd = (g) => {
      playEndSound();
      setGame(g);
    };

    const handleError = (msg) => { setError(msg); setTimeout(() => setError(''), 3000); };
    const handleTimer = (t) => setTimer(t);
    const handleSpectators = (count) => setSpectatorCount(count);

    socket.on('game:update', handleUpdate);
    socket.on('game:end', handleEnd);
    socket.on('error', handleError);
    socket.on('game:timer', handleTimer);
    socket.on('game:spectators', handleSpectators);

    return () => {
      socket.off('game:update', handleUpdate);
      socket.off('game:end', handleEnd);
      socket.off('error', handleError);
      socket.off('game:timer', handleTimer);
      socket.off('game:spectators', handleSpectators);
      socket.off('connect', handleReconnect);
      if (spectating) socket.emit('leave:spectate');
    };
  }, [token, spectating]);

  const handleMove = useCallback((x, y) => {
    if (spectating) return;
    const socket = getSocket(token);
    socket.emit('move', { x, y });
  }, [token, spectating]);

  const handlePass = () => {
    if (spectating) return;
    getSocket(token).emit('pass');
  };

  const handleResign = () => {
    if (spectating) return;
    if (confirm('确定要认输吗？')) getSocket(token).emit('resign');
  };

  const handleUndo = () => {
    if (spectating) return;
    getSocket(token).emit('undo');
  };

  if (!game) return null;

  const isMyTurn = !spectating && game.status === 'playing' && (
    (game.currentColor === BLACK && game.players.black.username === user.username) ||
    (game.currentColor === WHITE && game.players.white.username === user.username)
  );

  const lastMove = game.moves.length > 0 ? (() => {
    const m = game.moves[game.moves.length - 1];
    return m.pass ? null : [m.x, m.y];
  })() : null;

  const statusText = spectating
    ? '观战中'
    : game.status === 'ended'
      ? '对局结束'
      : isMyTurn ? '轮到你了' : '等待对方落子...';

  const boardSizeLabel = `${game.boardSize}×${game.boardSize}`;
  const totalTimeLabel = timer.totalTime ? formatTime(timer.totalTime) : '';

  return (
    <div style={styles.page}>
      <Board
        board={game.board}
        boardSize={game.boardSize}
        currentColor={game.currentColor}
        onMove={handleMove}
        disabled={spectating || !isMyTurn || game.status !== 'playing'}
        lastMove={lastMove}
      />
      <div style={styles.sidebar}>
        {/* Game info */}
        <div style={styles.gameInfo}>
          <span>📐 {boardSizeLabel}</span>
          {game.type === 'ai' && <span>🤖 {game.difficulty}</span>}
          {totalTimeLabel && <span>⏱ {totalTimeLabel}</span>}
          <span>📝 {game.moves.length}手</span>
        </div>

        {/* Players + timer */}
        <div style={styles.infoCard}>
          <div style={styles.playerRow}>
            <div style={{
              ...styles.stone, background: '#222',
              ...(game.currentColor === BLACK && game.status === 'playing' ? styles.activePlayer : {}),
            }} />
            <span style={styles.playerName}>{game.players.black.username || '黑方'}</span>
            <span style={styles.captures}>提{game.captures.black}</span>
            <span style={{
              ...styles.timerText,
              ...(timer.black <= 60 ? styles.timerLow : styles.timerNormal),
            }}>{formatTime(timer.black)}</span>
          </div>
          <div style={styles.playerRow}>
            <div style={{
              ...styles.stone, background: '#eee',
              ...(game.currentColor === WHITE && game.status === 'playing' ? styles.activePlayer : {}),
            }} />
            <span style={styles.playerName}>{game.players.white.username || '白方'}</span>
            <span style={styles.captures}>提{game.captures.white}</span>
            <span style={{
              ...styles.timerText,
              ...(timer.white <= 60 ? styles.timerLow : styles.timerNormal),
            }}>{formatTime(timer.white)}</span>
          </div>
        </div>

        {/* Status */}
        <div style={styles.status}>
          {error ? <span style={{ color: '#f44336' }}>{error}</span> : statusText}
        </div>

        {/* Spectator count */}
        {spectatorCount > 0 && (
          <div style={styles.spectatorBadge}>👁 {spectatorCount} 人观战</div>
        )}

        {/* Result */}
        {game.status === 'ended' && game.result && (
          <div style={styles.result}>
            <div style={styles.resultTitle}>
              {game.result.winner === 'black' ? '⚫ 黑方胜' : '⚪ 白方胜'}
            </div>
            <div style={styles.resultDetail}>
              {game.result.reason === 'score' && game.result.score && (
                <>黑: {game.result.score.black} | 白: {game.result.score.white} (贴目 {game.result.score.komi})</>
              )}
              {game.result.reason === 'resign' && '对方认输'}
              {game.result.reason === 'disconnect' && '对方断线'}
              {game.result.reason === 'timeout' && '超时判负'}
            </div>
            <button className="btn-primary" onClick={onBack}>返回大厅</button>
          </div>
        )}

        {/* Actions */}
        {game.status === 'playing' && !spectating && (
          <div style={styles.actions}>
            {game.canUndo && (
              <button className="btn-secondary" onClick={handleUndo}>↩ 悔棋</button>
            )}
            <button className="btn-secondary" onClick={handlePass}>跳过 (Pass)</button>
            <button className="btn-danger" onClick={handleResign}>认输</button>
          </div>
        )}

        {/* Move list */}
        {game.moves.length > 0 && (
          <div style={styles.infoCard}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>落子记录</div>
            <div style={styles.moveList}>
              {game.moves.map((m, i) => (
                <div key={i}>
                  {i + 1}. {m.color === BLACK ? '⚫' : '⚪'}{' '}
                  {m.pass ? 'Pass' : `(${m.x}, ${m.y})`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
