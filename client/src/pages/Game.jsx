import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../socket.js';
import Board from '../components/Board.jsx';

const BLACK = 1, WHITE = 2;

const styles = {
  page: { display: 'flex', gap: 24, justifyContent: 'center', paddingTop: 24, flexWrap: 'wrap' },
  sidebar: {
    width: 260, display: 'flex', flexDirection: 'column', gap: 16,
  },
  infoCard: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 20,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  playerRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
  },
  stone: {
    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
  },
  activePlayer: {
    boxShadow: '0 0 0 3px #667eea',
  },
  playerName: { fontSize: 15, fontWeight: 600 },
  captures: { fontSize: 13, color: '#999', marginLeft: 'auto' },
  status: {
    textAlign: 'center', padding: '12px 16px', borderRadius: 8,
    background: 'rgba(102,126,234,0.15)', fontSize: 14, fontWeight: 600,
  },
  actions: { display: 'flex', flexDirection: 'column', gap: 10 },
  moveList: {
    maxHeight: 200, overflowY: 'auto', fontSize: 13, color: '#aaa',
    background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 12,
  },
  result: {
    textAlign: 'center', padding: 24, borderRadius: 12,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  },
  resultTitle: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  resultDetail: { fontSize: 14, color: '#aaa', marginBottom: 16 },
};

export default function Game({ user, token }) {
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket(token);

    socket.on('game:start', setGame);
    socket.on('game:update', setGame);
    socket.on('game:end', setGame);
    socket.on('error', (msg) => { setError(msg); setTimeout(() => setError(''), 3000); });

    return () => {
      socket.off('game:start', setGame);
      socket.off('game:update', setGame);
      socket.off('game:end', setGame);
      socket.off('error');
    };
  }, [token]);

  const handleMove = useCallback((x, y) => {
    const socket = getSocket(token);
    socket.emit('move', { x, y });
  }, [token]);

  const handlePass = () => {
    const socket = getSocket(token);
    socket.emit('pass');
  };

  const handleResign = () => {
    if (confirm('确定要认输吗？')) {
      const socket = getSocket(token);
      socket.emit('resign');
    }
  };

  const goBack = () => navigate('/');

  if (!game) {
    return <div style={{ textAlign: 'center', paddingTop: 80, color: '#999' }}>加载中...</div>;
  }

  const isMyTurn = game.status === 'playing' && (
    (game.currentColor === BLACK && game.players.black.username === user.username) ||
    (game.currentColor === WHITE && game.players.white.username === user.username)
  );

  const lastMove = game.moves.length > 0 ? (() => {
    const m = game.moves[game.moves.length - 1];
    return m.pass ? null : [m.x, m.y];
  })() : null;

  const statusText = game.status === 'ended'
    ? '对局结束'
    : isMyTurn ? '轮到你了' : '等待对方落子...';

  return (
    <div style={styles.page}>
      <Board
        board={game.board}
        boardSize={game.boardSize}
        currentColor={game.currentColor}
        onMove={handleMove}
        disabled={!isMyTurn || game.status !== 'playing'}
        lastMove={lastMove}
      />
      <div style={styles.sidebar}>
        {/* Players */}
        <div style={styles.infoCard}>
          <div style={styles.playerRow}>
            <div style={{
              ...styles.stone,
              background: '#222',
              ...(game.currentColor === BLACK && game.status === 'playing' ? styles.activePlayer : {}),
            }} />
            <span style={styles.playerName}>{game.players.black.username || '黑方'}</span>
            <span style={styles.captures}>提子: {game.captures.black}</span>
          </div>
          <div style={styles.playerRow}>
            <div style={{
              ...styles.stone,
              background: '#eee',
              ...(game.currentColor === WHITE && game.status === 'playing' ? styles.activePlayer : {}),
            }} />
            <span style={styles.playerName}>{game.players.white.username || '白方'}</span>
            <span style={styles.captures}>提子: {game.captures.white}</span>
          </div>
        </div>

        {/* Status */}
        <div style={styles.status}>
          {error ? <span style={{ color: '#f44336' }}>{error}</span> : statusText}
        </div>

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
            </div>
            <button className="btn-primary" onClick={goBack}>返回大厅</button>
          </div>
        )}

        {/* Actions */}
        {game.status === 'playing' && (
          <div style={styles.actions}>
            <button className="btn-secondary" onClick={handlePass}>
              跳过 (Pass)
            </button>
            <button className="btn-danger" onClick={handleResign}>
              认输
            </button>
          </div>
        )}

        {/* Move history */}
        {game.moves.length > 0 && (
          <div style={styles.infoCard}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>落子记录 ({game.moves.length}手)</div>
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
