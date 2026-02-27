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
    display: 'flex', gap: 20, justifyContent: 'center', paddingTop: 20,
    flexWrap: 'wrap', alignItems: 'flex-start',
  },
  sidebar: { width: 280, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240 },
  infoCard: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  playerRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' },
  stone: { width: 18, height: 18, borderRadius: '50%', flexShrink: 0 },
  activePlayer: { boxShadow: '0 0 0 3px #667eea' },
  playerName: { fontSize: 14, fontWeight: 600, flex: 1 },
  captures: { fontSize: 12, color: '#999' },
  timerText: { fontSize: 13, fontWeight: 700, fontFamily: 'monospace', marginLeft: 6 },
  timerLow: { color: '#f44336' },
  timerNormal: { color: '#4fc3f7' },
  status: {
    textAlign: 'center', padding: '8px 14px', borderRadius: 8,
    background: 'rgba(102,126,234,0.15)', fontSize: 13, fontWeight: 600,
  },
  actions: { display: 'flex', flexDirection: 'column', gap: 8 },
  moveList: {
    maxHeight: 120, overflowY: 'auto', fontSize: 11, color: '#aaa',
    background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 8,
  },
  result: {
    textAlign: 'center', padding: 18, borderRadius: 12,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  },
  resultTitle: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  resultDetail: { fontSize: 12, color: '#aaa', marginBottom: 14 },
  gameInfo: { fontSize: 11, color: '#777', display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 6 },
  spectatorBadge: { fontSize: 11, color: '#999', textAlign: 'center', padding: '2px 0' },
  // Chat styles
  chatBox: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12,
    border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column',
  },
  chatTitle: { fontSize: 12, color: '#999', marginBottom: 6 },
  chatMessages: {
    maxHeight: 150, minHeight: 80, overflowY: 'auto', fontSize: 12, color: '#ccc',
    background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 8, marginBottom: 8,
  },
  chatMsg: { marginBottom: 4, lineHeight: 1.4 },
  chatUser: { color: '#667eea', fontWeight: 600 },
  chatInputRow: { display: 'flex', gap: 6 },
  chatInput: {
    flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)', color: '#eee', fontSize: 12, outline: 'none',
  },
  chatSend: {
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff',
    border: 'none', cursor: 'pointer',
  },
};

export default function Game({ user, token, game: initialGame, onGameUpdate, onBack, spectating = false }) {
  const [game, setGame] = useState(initialGame);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(initialGame.timer || { black: 0, white: 0 });
  const [spectatorCount, setSpectatorCount] = useState(initialGame.spectators || 0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const prevMovesLen = useRef(initialGame.moves?.length || 0);
  const prevCaptures = useRef({ ...(initialGame.captures || { black: 0, white: 0 }) });
  const gameIdRef = useRef(initialGame.id);
  const chatEndRef = useRef(null);

  // Auto scroll chat
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const socket = getSocket(token);

    const handleReconnect = () => {
      if (spectating && gameIdRef.current) {
        socket.emit('spectate', { gameId: gameIdRef.current });
      } else {
        socket.emit('rejoin');
        socket.once('game:rejoin', (g) => {
          if (g) { setGame(g); if (g.timer) setTimer(g.timer); }
        });
      }
    };
    socket.on('connect', handleReconnect);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) {
          socket.connect();
        } else {
          if (spectating && gameIdRef.current) {
            socket.emit('spectate', { gameId: gameIdRef.current });
            socket.once('game:start', (g) => { setGame(g); if (g.timer) setTimer(g.timer); });
          } else {
            socket.emit('rejoin');
            socket.once('game:rejoin', (g) => {
              if (g) { setGame(g); if (g.timer) setTimer(g.timer); }
            });
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleUpdate = (g) => {
      if (g.moves && g.moves.length > prevMovesLen.current) {
        const lastMove = g.moves[g.moves.length - 1];
        if (lastMove.pass) playPassSound();
        else {
          const capNow = (g.captures?.black || 0) + (g.captures?.white || 0);
          const capPrev = (prevCaptures.current.black || 0) + (prevCaptures.current.white || 0);
          if (capNow > capPrev) playCaptureSound(); else playPlaceSound();
        }
      }
      prevMovesLen.current = g.moves?.length || 0;
      prevCaptures.current = { ...(g.captures || { black: 0, white: 0 }) };
      setGame(g);
      // Don't update timer from game:update — let game:timer handle it
    };

    const handleEnd = (g) => { playEndSound(); setGame(g); };
    const handleError = (msg) => { setError(msg); setTimeout(() => setError(''), 3000); };
    const handleTimer = (t) => setTimer(t);
    const handleSpectators = (count) => setSpectatorCount(count);
    const handleChat = (msg) => setChatMessages(prev => [...prev.slice(-100), msg]);

    socket.on('game:update', handleUpdate);
    socket.on('game:end', handleEnd);
    socket.on('error', handleError);
    socket.on('game:timer', handleTimer);
    socket.on('game:spectators', handleSpectators);
    socket.on('chat:message', handleChat);

    return () => {
      socket.off('game:update', handleUpdate);
      socket.off('game:end', handleEnd);
      socket.off('error', handleError);
      socket.off('game:timer', handleTimer);
      socket.off('game:spectators', handleSpectators);
      socket.off('chat:message', handleChat);
      socket.off('connect', handleReconnect);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (spectating) socket.emit('leave:spectate');
    };
  }, [token, spectating]);

  const handleMove = useCallback((x, y) => {
    if (spectating) return;
    getSocket(token).emit('move', { x, y });
  }, [token, spectating]);

  const handlePass = () => { if (!spectating) getSocket(token).emit('pass'); };
  const handleResign = () => { if (!spectating && confirm('确定要认输吗？')) getSocket(token).emit('resign'); };
  const handleUndo = () => { if (!spectating) getSocket(token).emit('undo'); };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    getSocket(token).emit('chat', { message: chatInput });
    setChatInput('');
  };

  const handleChatKey = (e) => { if (e.key === 'Enter') sendChat(); };

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
    : game.status === 'ended' ? '对局结束'
    : isMyTurn ? '轮到你了' : '等待对方落子...';

  const boardSizeLabel = `${game.boardSize}×${game.boardSize}`;
  const totalTimeLabel = timer.totalTime ? formatTime(timer.totalTime) : '';

  return (
    <div style={styles.page}>
      <Board
        board={game.board} boardSize={game.boardSize} currentColor={game.currentColor}
        onMove={handleMove} disabled={spectating || !isMyTurn || game.status !== 'playing'}
        lastMove={lastMove}
      />
      <div style={styles.sidebar}>
        <div style={styles.gameInfo}>
          <span>📐 {boardSizeLabel}</span>
          {game.type === 'ai' && <span>🤖 {game.difficulty}</span>}
          {totalTimeLabel && <span>⏱ {totalTimeLabel}</span>}
          <span>📝 {game.moves.length}手</span>
        </div>

        <div style={styles.infoCard}>
          <div style={styles.playerRow}>
            <div style={{ ...styles.stone, background: '#222', ...(game.currentColor === BLACK && game.status === 'playing' ? styles.activePlayer : {}) }} />
            <span style={styles.playerName}>{game.players.black.username || '黑方'}</span>
            <span style={styles.captures}>提{game.captures.black}</span>
            <span style={{ ...styles.timerText, ...(timer.black <= 60 ? styles.timerLow : styles.timerNormal) }}>{formatTime(timer.black)}</span>
          </div>
          <div style={styles.playerRow}>
            <div style={{ ...styles.stone, background: '#eee', ...(game.currentColor === WHITE && game.status === 'playing' ? styles.activePlayer : {}) }} />
            <span style={styles.playerName}>{game.players.white.username || '白方'}</span>
            <span style={styles.captures}>提{game.captures.white}</span>
            <span style={{ ...styles.timerText, ...(timer.white <= 60 ? styles.timerLow : styles.timerNormal) }}>{formatTime(timer.white)}</span>
          </div>
        </div>

        <div style={styles.status}>
          {error ? <span style={{ color: '#f44336' }}>{error}</span> : statusText}
        </div>

        {spectatorCount > 0 && <div style={styles.spectatorBadge}>👁 {spectatorCount} 人观战</div>}

        {game.status === 'ended' && game.result && (
          <div style={styles.result}>
            <div style={styles.resultTitle}>{game.result.winner === 'black' ? '⚫ 黑方胜' : '⚪ 白方胜'}</div>
            <div style={styles.resultDetail}>
              {game.result.reason === 'score' && game.result.score && <>黑: {game.result.score.black} | 白: {game.result.score.white} (贴目 {game.result.score.komi})</>}
              {game.result.reason === 'resign' && '对方认输'}
              {game.result.reason === 'disconnect' && '对方断线'}
              {game.result.reason === 'timeout' && '超时判负'}
            </div>
            <button className="btn-primary" onClick={onBack}>返回大厅</button>
          </div>
        )}

        {game.status === 'playing' && !spectating && (
          <div style={styles.actions}>
            {game.canUndo && <button className="btn-secondary" onClick={handleUndo}>↩ 悔棋</button>}
            <button className="btn-secondary" onClick={handlePass}>跳过 (Pass)</button>
            <button className="btn-danger" onClick={handleResign}>认输</button>
          </div>
        )}

        {/* Chat */}
        <div style={styles.chatBox}>
          <div style={styles.chatTitle}>💬 聊天</div>
          <div style={styles.chatMessages}>
            {chatMessages.length === 0 && <div style={{ color: '#666', fontSize: 11 }}>暂无消息</div>}
            {chatMessages.map((m, i) => (
              <div key={i} style={styles.chatMsg}>
                <span style={styles.chatUser}>{m.user}</span>: {m.message}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div style={styles.chatInputRow}>
            <input style={styles.chatInput} value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleChatKey} placeholder="说点什么..." maxLength={200} />
            <button style={styles.chatSend} onClick={sendChat}>发送</button>
          </div>
        </div>

        {game.moves.length > 0 && (
          <div style={styles.infoCard}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>落子记录</div>
            <div style={styles.moveList}>
              {game.moves.map((m, i) => (
                <div key={i}>{i + 1}. {m.color === BLACK ? '⚫' : '⚪'} {m.pass ? 'Pass' : `(${m.x}, ${m.y})`}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
