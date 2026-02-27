import React, { useState, useEffect } from 'react';
import { getSocket } from '../socket.js';

const styles = {
  lobby: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24 },
  welcome: { fontSize: 20, marginBottom: 24, color: '#ccc' },
  topRow: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 900, marginBottom: 24 },
  modes: { display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 900 },
  modeCard: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 24,
    border: '1px solid rgba(255,255,255,0.1)', flex: '1 1 300px', maxWidth: 380,
  },
  modeTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  modeDesc: { color: '#999', fontSize: 13, marginBottom: 16, lineHeight: 1.5 },
  options: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  label: { fontSize: 12, color: '#aaa', marginBottom: 2 },
  select: {
    padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)', color: '#eee', fontSize: 14, width: '100%',
  },
  waiting: { textAlign: 'center', padding: 40, fontSize: 18, color: '#999' },
  spinner: { fontSize: 32, marginBottom: 16 },
  sidePanel: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16,
    border: '1px solid rgba(255,255,255,0.08)', flex: '1 1 200px', maxWidth: 280, minWidth: 200,
  },
  panelTitle: { fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#bbb' },
  userItem: { fontSize: 13, padding: '4px 0', color: '#ccc', display: 'flex', alignItems: 'center', gap: 8 },
  onlineDot: { width: 8, height: 8, borderRadius: '50%', background: '#4caf50', flexShrink: 0 },
  rating: { fontSize: 12, color: '#888', marginLeft: 'auto' },
  bottomRow: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 900, marginTop: 20 },
  gameItem: {
    fontSize: 13, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
    background: 'rgba(255,255,255,0.04)', marginBottom: 6,
    border: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.2s',
  },
  historyItem: {
    fontSize: 12, padding: '6px 10px', borderRadius: 6,
    background: 'rgba(255,255,255,0.03)', marginBottom: 4,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  noData: { fontSize: 13, color: '#666', textAlign: 'center', padding: 12 },
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
    <div style={styles.lobby}>
      <div style={styles.welcome}>欢迎, {user.username} 👋 {user.rating && <span style={{ fontSize: 14, color: '#888' }}>({user.rating})</span>}</div>

      {/* Top: online users + active games */}
      <div style={styles.topRow}>
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
        <div style={styles.sidePanel}>
          <div style={styles.panelTitle}>⚔️ 进行中 ({activeGames.length})</div>
          {activeGames.length === 0 ? <div style={styles.noData}>暂无对局</div> :
            activeGames.map((g) => (
              <div key={g.id} style={styles.gameItem}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onClick={() => spectateGame(g.id)}>
                <div>{g.players.black.username} vs {g.players.white.username}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {g.boardSize}×{g.boardSize} · {g.moves}手 · 👁 {g.spectators}
                </div>
              </div>
            ))
          }
        </div>
        <div style={styles.sidePanel}>
          <div style={styles.panelTitle}>📜 最近对局</div>
          {history.length === 0 ? <div style={styles.noData}>暂无记录</div> :
            history.map((g, i) => (
              <div key={i} style={styles.historyItem}>
                <div style={{ fontSize: 12 }}>{g.black_name} vs {g.white_name}</div>
                <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                  {g.winner === 'black' ? '⚫胜' : '⚪胜'} · {g.reason} · {g.board_size}路
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Game modes */}
      <div style={styles.modes}>
        <div style={styles.modeCard}>
          <div style={styles.modeTitle}>🤖 人机对战</div>
          <div style={styles.modeDesc}>和 AI 对弈，支持多种难度，适合练习和学习。</div>
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
          <div style={styles.modeDesc}>在线匹配真人对手，体验真正的围棋对弈。</div>
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
    </div>
  );
}
