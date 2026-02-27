import React, { useState, useEffect } from 'react';
import { getSocket } from '../socket.js';

const styles = {
  layout: { display: 'flex', gap: 20, justifyContent: 'center', paddingTop: 24, flexWrap: 'wrap', maxWidth: 1100, margin: '0 auto' },
  main: { flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: 20 },
  rightBar: { width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 },
  welcome: { fontSize: 20, marginBottom: 8, color: 'var(--text-secondary)', textAlign: 'center' },
  modes: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  modeCard: {
    background: 'var(--bg-card)', borderRadius: 16, padding: 24,
    border: '1px solid var(--border)', flex: '1 1 280px', maxWidth: 360,
    boxShadow: 'var(--shadow-sm)',
  },
  modeTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' },
  modeDesc: { color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 },
  options: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  label: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 },
  select: {
    padding: '8px 12px', borderRadius: 8, background: 'var(--bg-input)',
    border: '1px solid var(--border-input)', color: 'var(--text)', fontSize: 14, width: '100%',
  },
  waiting: { textAlign: 'center', padding: 40, fontSize: 18, color: 'var(--text-muted)' },
  spinner: { fontSize: 32, marginBottom: 16 },
  infoRow: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  panel: {
    background: 'var(--bg-card)', borderRadius: 12, padding: 14,
    border: '1px solid var(--border)', flex: '1 1 240px', maxWidth: 400,
    boxShadow: 'var(--shadow-sm)',
  },
  sidePanel: {
    background: 'var(--bg-card)', borderRadius: 12, padding: 14,
    border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
  },
  panelTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' },
  userItem: { fontSize: 12, padding: '3px 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 },
  onlineDot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--online-dot)', flexShrink: 0 },
  rating: { fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' },
  gameItem: {
    fontSize: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
    background: 'var(--bg-card)', marginBottom: 6,
    border: '1px solid var(--border)', transition: 'background 0.2s',
  },
  historyItem: {
    fontSize: 11, padding: '6px 10px', borderRadius: 6,
    background: 'var(--bg-card)', marginBottom: 4,
    border: '1px solid var(--border)',
  },
  noData: { fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 10 },
};

export default function Lobby({ user, token, onGameStart, onSpectate }) {
  const [boardSize, setBoardSize] = useState(19);
  const [difficulty, setDifficulty] = useState('medium');
  const [playerColor, setPlayerColor] = useState('black');
  const [waiting, setWaiting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const socket = getSocket(token);
    socket.emit('get:online');
    socket.emit('get:activeGames');
    socket.emit('get:history', { limit: 10 });

    const onOnline = (users) => setOnlineUsers(users);
    const onActive = (games) => setActiveGames(games);
    const onHistory = (h) => setHistory(h);

    socket.on('online:users', onOnline);
    socket.on('active:games', onActive);
    socket.on('game:history', onHistory);

    return () => {
      socket.off('online:users', onOnline);
      socket.off('active:games', onActive);
      socket.off('game:history', onHistory);
    };
  }, [token]);

  const startAIGame = () => {
    const socket = getSocket(token);
    socket.emit('create:ai', { boardSize, difficulty, playerColor });
    socket.once('game:start', (game) => onGameStart(game));
  };

  const startPvPGame = () => {
    const socket = getSocket(token);
    setWaiting(true);
    socket.emit('create:pvp', { boardSize });
    socket.once('game:start', (game) => { setWaiting(false); onGameStart(game); });
  };

  const cancelWaiting = () => {
    getSocket(token).emit('cancel:pvp');
    setWaiting(false);
  };

  const spectateGame = (gameId) => {
    const socket = getSocket(token);
    socket.emit('spectate', { gameId });
    socket.once('game:start', (game) => onSpectate(game));
    socket.once('game:end', (game) => onSpectate(game));
  };

  if (waiting) {
    return (
      <div style={styles.waiting}>
        <div style={styles.spinner}>⏳</div>
        <div>正在匹配对手...</div>
        <div style={{ fontSize: 14, marginTop: 8 }}>棋盘: {boardSize}×{boardSize}</div>
        <button className="btn-secondary" style={{ marginTop: 24 }} onClick={cancelWaiting}>取消匹配</button>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <div style={styles.main}>
        <div style={styles.welcome}>欢迎, {user.username} 👋 {user.rating && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>({user.rating})</span>}</div>

        <div style={styles.modes}>
          <div style={styles.modeCard}>
            <div style={styles.modeTitle}>🤖 人机对战</div>
            <div style={styles.modeDesc}>和 AI 对弈，支持多种难度。</div>
            <div style={styles.options}>
              <div>
                <div style={styles.label}>棋盘大小</div>
                <select style={styles.select} value={boardSize} onChange={e => setBoardSize(Number(e.target.value))}>
                  <option value={9}>9×9 (入门)</option>
                  <option value={13}>13×13 (中等)</option>
                  <option value={19}>19×19 (标准)</option>
                </select>
              </div>
              <div>
                <div style={styles.label}>AI 难度</div>
                <select style={styles.select} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
              <div>
                <div style={styles.label}>执子</div>
                <select style={styles.select} value={playerColor} onChange={e => setPlayerColor(e.target.value)}>
                  <option value="black">执黑先行</option>
                  <option value="white">执白后行</option>
                </select>
              </div>
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={startAIGame}>开始对局</button>
          </div>

          <div style={styles.modeCard}>
            <div style={styles.modeTitle}>👥 人人对战</div>
            <div style={styles.modeDesc}>在线匹配真人对手。</div>
            <div style={styles.options}>
              <div>
                <div style={styles.label}>棋盘大小</div>
                <select style={styles.select} value={boardSize} onChange={e => setBoardSize(Number(e.target.value))}>
                  <option value={9}>9×9 (入门)</option>
                  <option value={13}>13×13 (中等)</option>
                  <option value={19}>19×19 (标准)</option>
                </select>
              </div>
            </div>
            <button className="btn-success" style={{ width: '100%' }} onClick={startPvPGame}>匹配对手</button>
          </div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>⚔️ 进行中 ({activeGames.length})</div>
            {activeGames.length === 0 ? <div style={styles.noData}>暂无对局</div> :
              activeGames.map((g) => (
                <div key={g.id} style={styles.gameItem}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                  onClick={() => spectateGame(g.id)}>
                  <div>{g.players.black.username} vs {g.players.white.username}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {g.boardSize}×{g.boardSize} · {g.moves}手 · 👁 {g.spectators}
                  </div>
                </div>
              ))
            }
          </div>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>📜 最近对局</div>
            {history.length === 0 ? <div style={styles.noData}>暂无记录</div> :
              history.map((g, i) => (
                <div key={i} style={styles.historyItem}>
                  <div>{g.black_name} vs {g.white_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {g.winner === 'black' ? '⚫胜' : '⚪胜'} · {g.reason} · {g.board_size}路
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div style={styles.rightBar}>
        <div style={styles.sidePanel}>
          <div style={styles.panelTitle}>🟢 在线 ({onlineUsers.length})</div>
          {onlineUsers.length === 0 ? <div style={styles.noData}>暂无</div> :
            onlineUsers.map((u, i) => (
              <div key={i} style={styles.userItem}>
                <div style={styles.onlineDot} />
                <span>{u.username}</span>
                <span style={styles.rating}>{u.rating}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
