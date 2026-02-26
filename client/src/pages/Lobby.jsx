import React, { useState } from 'react';
import { getSocket } from '../socket.js';

const styles = {
  lobby: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40 },
  welcome: { fontSize: 20, marginBottom: 40, color: '#ccc' },
  modes: { display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' },
  modeCard: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 32,
    border: '1px solid rgba(255,255,255,0.1)', width: 320,
  },
  modeTitle: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
  modeDesc: { color: '#999', fontSize: 14, marginBottom: 20, lineHeight: 1.6 },
  options: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 },
  label: { fontSize: 13, color: '#aaa', marginBottom: 4 },
  select: {
    padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)', color: '#eee', fontSize: 14,
  },
  waiting: {
    textAlign: 'center', padding: 40, fontSize: 18, color: '#999',
  },
  spinner: { fontSize: 32, marginBottom: 16 },
};

export default function Lobby({ user, token, onGameStart }) {
  const [boardSize, setBoardSize] = useState(19);
  const [difficulty, setDifficulty] = useState('medium');
  const [playerColor, setPlayerColor] = useState('black');
  const [waiting, setWaiting] = useState(false);

  const startAIGame = () => {
    const socket = getSocket(token);
    socket.emit('create:ai', { boardSize, difficulty, playerColor });
    socket.once('game:start', (game) => {
      onGameStart(game);
    });
  };

  const startPvPGame = () => {
    const socket = getSocket(token);
    setWaiting(true);
    socket.emit('create:pvp', { boardSize });
    socket.once('game:start', (game) => {
      setWaiting(false);
      onGameStart(game);
    });
  };

  const cancelWaiting = () => {
    const socket = getSocket(token);
    socket.emit('cancel:pvp');
    setWaiting(false);
  };

  if (waiting) {
    return (
      <div style={styles.waiting}>
        <div style={styles.spinner}>⏳</div>
        <div>正在匹配对手...</div>
        <div style={{ fontSize: 14, marginTop: 8 }}>棋盘: {boardSize}×{boardSize}</div>
        <button className="btn-secondary" style={{ marginTop: 24 }} onClick={cancelWaiting}>
          取消匹配
        </button>
      </div>
    );
  }

  return (
    <div style={styles.lobby}>
      <div style={styles.welcome}>欢迎, {user.username} 👋</div>
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
          <button className="btn-primary" style={{ width: '100%' }} onClick={startAIGame}>
            开始对局
          </button>
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
          <button className="btn-success" style={{ width: '100%' }} onClick={startPvPGame}>
            匹配对手
          </button>
        </div>
      </div>
    </div>
  );
}
