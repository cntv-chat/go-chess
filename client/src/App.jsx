import React, { useState, useEffect, useCallback } from 'react';
import Login from './pages/Login.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';
import { getSocket, disconnectSocket } from './socket.js';

const THEMES = [
  { key: 'dark', name: '深邃', color: '#667eea' },
  { key: 'light', name: '素雅', color: '#e8e0d8' },
  { key: 'green', name: '青竹', color: '#66bb6a' },
  { key: 'warm', name: '暖木', color: '#ffb74d' },
  { key: 'purple', name: '星夜', color: '#ba93ff' },
];

function getHashRoute() {
  const hash = window.location.hash.slice(1); // remove #
  if (hash.startsWith('/game/')) return { mode: 'play', gameId: hash.slice(6) };
  if (hash.startsWith('/spectate/')) return { mode: 'spectate', gameId: hash.slice(10) };
  return { mode: 'lobby', gameId: null };
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [game, setGame] = useState(null);
  const [spectating, setSpectating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('go-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? '' : theme);
    localStorage.setItem('go-theme', theme);
  }, [theme]);

  // Restore from URL hash on load
  useEffect(() => {
    if (!token) { setLoading(false); return; }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setUser(data.user);
        const route = getHashRoute();
        const socket = getSocket(token);

        if (route.mode === 'spectate' && route.gameId) {
          // Rejoin as spectator
          socket.emit('spectate', { gameId: route.gameId });
          socket.once('game:start', (g) => {
            setGame(g);
            setSpectating(true);
            setLoading(false);
          });
          socket.once('error', () => {
            window.location.hash = '';
            setLoading(false);
          });
          setTimeout(() => setLoading(false), 3000);
        } else if (route.mode === 'play' && route.gameId) {
          // Try rejoin active game
          socket.emit('rejoin');
          socket.once('game:rejoin', (g) => {
            if (g && g.id === route.gameId) {
              setGame(g);
              setSpectating(false);
            } else {
              window.location.hash = '';
            }
            setLoading(false);
          });
          setTimeout(() => setLoading(false), 3000);
        } else {
          // Normal rejoin attempt
          socket.emit('rejoin');
          socket.once('game:rejoin', (g) => {
            if (g) {
              setGame(g);
              setSpectating(false);
              window.location.hash = `/game/${g.id}`;
            }
            setLoading(false);
          });
          setTimeout(() => setLoading(false), 3000);
        }
      })
      .catch(() => { setToken(null); localStorage.removeItem('token'); setLoading(false); });
  }, [token]);

  const handleLogin = (t, u) => {
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setGame(null);
    setSpectating(false);
    window.location.hash = '';
    disconnectSocket();
  };

  const handleGameStart = (g) => {
    setGame(g);
    setSpectating(false);
    window.location.hash = `/game/${g.id}`;
  };

  const handleSpectate = (g) => {
    setGame(g);
    setSpectating(true);
    window.location.hash = `/spectate/${g.id}`;
  };

  const handleGameUpdate = () => {};

  const handleBackToLobby = () => {
    setGame(null);
    setSpectating(false);
    window.location.hash = '';
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', color: 'var(--text-muted)' }}>加载中...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <div className="header">
        <h1>⚫ 围棋对战 ⚪</h1>
        <div className="header-user">
          <div className="theme-switcher">
            {THEMES.map(t => (
              <div key={t.key} className={`theme-dot${theme === t.key ? ' active' : ''}`}
                style={{ background: t.color }} title={t.name}
                onClick={() => setTheme(t.key)} />
            ))}
          </div>
          {game && (
            <button className="btn-secondary" onClick={handleBackToLobby} style={{ marginRight: 8 }}>
              {spectating ? '退出观战' : '返回大厅'}
            </button>
          )}
          <span>{user.username}</span>
          {user.rating && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({user.rating})</span>}
          <button className="btn-secondary" onClick={handleLogout}>退出</button>
        </div>
      </div>
      <div className="container">
        {game ? (
          <Game
            user={user}
            token={token}
            game={game}
            onGameUpdate={handleGameUpdate}
            onBack={handleBackToLobby}
            spectating={spectating}
          />
        ) : (
          <Lobby
            user={user}
            token={token}
            onGameStart={handleGameStart}
            onSpectate={handleSpectate}
          />
        )}
      </div>
    </>
  );
}

export default App;
