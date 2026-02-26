import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDB } from '../db.js';
import { signToken, verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名长度2-20个字符' });
  if (password.length < 4) return res.status(400).json({ error: '密码至少4个字符' });

  const db = getDB();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: '用户名已存在' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
  const user = { id: result.lastInsertRowid, username };
  const token = signToken(user);
  res.json({ token, user: { id: user.id, username } });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ error: '用户名或密码错误' });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, rating: user.rating, wins: user.wins, losses: user.losses } });
});

router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: '登录已过期' });

  const db = getDB();
  const user = db.prepare('SELECT id, username, rating, wins, losses FROM users WHERE id = ?').get(payload.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});

export default router;
