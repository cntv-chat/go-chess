import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/go-chess.db');

let db;

export function getDB() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDB() {
  const d = getDB();
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rating INTEGER DEFAULT 1500,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Recreate games table with correct schema
  // Check if games table has ended_at column
  const tableInfo = d.prepare("PRAGMA table_info(games)").all();
  const hasEndedAt = tableInfo.some(col => col.name === 'ended_at');
  if (!hasEndedAt) {
    d.exec('DROP TABLE IF EXISTS games');
  }

  d.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      black_id INTEGER,
      white_id INTEGER,
      black_name TEXT,
      white_name TEXT,
      board_size INTEGER DEFAULT 19,
      type TEXT DEFAULT 'ai',
      status TEXT DEFAULT 'playing',
      winner TEXT,
      reason TEXT,
      score_black REAL,
      score_white REAL,
      moves TEXT DEFAULT '[]',
      duration_seconds INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY (black_id) REFERENCES users(id),
      FOREIGN KEY (white_id) REFERENCES users(id)
    );
  `);
  console.log('Database initialized');
}

// Simple ELO calculation
export function updateELO(winnerId, loserId) {
  const d = getDB();
  const winner = d.prepare('SELECT rating, wins FROM users WHERE id = ?').get(winnerId);
  const loser = d.prepare('SELECT rating, losses FROM users WHERE id = ?').get(loserId);
  if (!winner || !loser) return;

  const K = 32;
  const expectedW = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
  const expectedL = 1 - expectedW;
  const newWinnerRating = Math.round(winner.rating + K * (1 - expectedW));
  const newLoserRating = Math.round(loser.rating + K * (0 - expectedL));

  d.prepare('UPDATE users SET rating = ?, wins = wins + 1 WHERE id = ?').run(newWinnerRating, winnerId);
  d.prepare('UPDATE users SET rating = ?, losses = losses + 1 WHERE id = ?').run(Math.max(100, newLoserRating), loserId);
}

export function saveGame(game) {
  const d = getDB();
  d.prepare(`
    INSERT OR REPLACE INTO games (id, black_id, white_id, black_name, white_name, board_size, type, status, winner, reason, score_black, score_white, moves, duration_seconds, created_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    game.id,
    game.blackId || null,
    game.whiteId || null,
    game.playerUsers.black.username,
    game.playerUsers.white.username,
    game.boardSize,
    game.type,
    game.status,
    game.result?.winner || null,
    game.result?.reason || null,
    game.result?.score?.black || null,
    game.result?.score?.white || null,
    JSON.stringify(game.moves),
    game.durationSeconds || 0,
    game.createdAt || new Date().toISOString()
  );
}

export function getRecentGames(limit = 20) {
  const d = getDB();
  return d.prepare('SELECT * FROM games WHERE status = ? ORDER BY ended_at DESC LIMIT ?').all('ended', limit);
}

export function getUserGames(userId, limit = 20) {
  const d = getDB();
  return d.prepare('SELECT * FROM games WHERE (black_id = ? OR white_id = ?) AND status = ? ORDER BY ended_at DESC LIMIT ?').all(userId, userId, 'ended', limit);
}
