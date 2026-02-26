import React, { useState, useEffect } from 'react';
import Login from './pages/Login.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';
import { disconnectSocket } from './socket.js';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [game, setGame] = useState(null);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => setUser(data.user))
        .catch(() => { setToken(null); localStorage.removeItem('token'); });
    }
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
    disconnectSocket();
  };

  const handleGameStart = (g) => setGame(g);
  const handleGameUpdate = (g) => setGame(g);
  const handleBackToLobby = () => setGame(null);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <div className="header">
        <h1>⚫ 围棋对战 ⚪</h1>
        <div className="header-user">
          {game && (
            <button className="btn-secondary" onClick={handleBackToLobby} style={{ marginRight: 8 }}>
              返回大厅
            </button>
          )}
          <span>{user.username}</span>
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
          />
        ) : (
          <Lobby
            user={user}
            token={token}
            onGameStart={handleGameStart}
          />
        )}
      </div>
    </>
  );
}

export default App;
