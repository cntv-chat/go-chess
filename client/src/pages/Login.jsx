import React, { useState } from 'react';

const styles = {
  wrapper: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    minHeight: '80vh',
  },
  card: {
    background: 'var(--bg-card)', borderRadius: 16, padding: 40,
    border: '1px solid var(--border)', width: 380, boxShadow: 'var(--shadow)',
  },
  title: {
    fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  subtitle: { textAlign: 'center', color: 'var(--text-muted)', marginBottom: 32, fontSize: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  error: {
    background: 'rgba(244,67,54,0.15)', color: 'var(--danger)',
    padding: '10px 16px', borderRadius: 8, fontSize: 14,
  },
  toggle: { textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)' },
  toggleLink: {
    color: 'var(--accent)', cursor: 'pointer', fontWeight: 600,
    background: 'none', border: 'none', fontSize: 14, padding: 0,
  },
};

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.title}>⚫ 围棋对战 ⚪</div>
        <div style={styles.subtitle}>{isRegister ? '创建账号开始对弈' : '登录继续对弈'}</div>
        <form style={styles.form} onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}
          <input placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="btn-primary" disabled={loading}>
            {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
          </button>
        </form>
        <div style={styles.toggle}>
          {isRegister ? '已有账号？' : '没有账号？'}
          <button style={styles.toggleLink} onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? '去登录' : '去注册'}
          </button>
        </div>
      </div>
    </div>
  );
}
