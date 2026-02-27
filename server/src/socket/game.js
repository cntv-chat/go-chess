import { verifyToken } from '../middleware/auth.js';
import { createBoard, playMove, calculateScore, BLACK, WHITE, EMPTY, cloneBoard } from '../game/engine.js';
import { getAIMove } from '../game/ai.js';
import { saveGame, updateELO, getRecentGames, getDB } from '../db.js';
import { randomUUID } from 'crypto';

const games = new Map();
const waitingPlayers = new Map();
const onlineUsers = new Map(); // oderId -> { id, username, rating, sockets: Set }
const gameTimers = new Map(); // gameId -> intervalId

// Default time limits per board size (seconds)
const DEFAULT_TIME = { 9: 600, 13: 1200, 19: 1800 };

export function setupGameSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      const user = verifyToken(token);
      if (user) {
        const db = getDB();
        const full = db.prepare('SELECT id, username, rating, wins, losses FROM users WHERE id = ?').get(user.id);
        socket.user = full || user;
        return next();
      }
    }
    socket.user = { id: 0, username: 'Guest', rating: 1500 };
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Connected: ${socket.user.username}`);

    // Track online user (deduplicate by userId)
    const uid = socket.user.id;
    if (uid && uid !== 0) {
      if (onlineUsers.has(uid)) {
        onlineUsers.get(uid).sockets.add(socket.id);
      } else {
        onlineUsers.set(uid, { id: uid, username: socket.user.username, rating: socket.user.rating || 1500, sockets: new Set([socket.id]) });
      }
      broadcastOnlineUsers(io);
    }
    broadcastActiveGames(io);

    // --- Online users ---
    socket.on('get:online', () => {
      socket.emit('online:users', getOnlineList());
    });

    // --- Active games list ---
    socket.on('get:activeGames', () => {
      socket.emit('active:games', getActiveGamesList());
    });

    // --- Rejoin active game after refresh ---
    socket.on('rejoin', () => {
      // Find game where this user is a player
      for (const [gameId, game] of games) {
        if (game.status !== 'playing') continue;
        const isBlack = game.playerUsers.black.username === socket.user.username;
        const isWhite = game.playerUsers.white.username === socket.user.username;
        if (isBlack || isWhite) {
          // Update socket id in players
          if (isBlack) game.players.black = socket.id;
          else game.players.white = socket.id;
          socket.join(gameId);
          socket.gameId = gameId;
          socket.emit('game:rejoin', sanitizeGame(game));
          return;
        }
      }
      socket.emit('game:rejoin', null);
    });

    // --- Game history ---
    socket.on('get:history', (data) => {
      const limit = (data && data.limit) || 20;
      const history = getRecentGames(limit);
      socket.emit('game:history', history);
    });

    // --- Create AI game ---
    socket.on('create:ai', ({ boardSize = 19, difficulty = 'medium', playerColor = 'black', timeLimit } = {}) => {
      const gameId = randomUUID();
      const totalTime = timeLimit || DEFAULT_TIME[boardSize] || 1800;
      const game = {
        id: gameId,
        type: 'ai',
        boardSize,
        board: createBoard(boardSize),
        currentColor: BLACK,
        koPoint: null,
        moves: [],
        history: [], // for undo
        captures: { black: 0, white: 0 },
        passes: 0,
        difficulty,
        players: {
          black: playerColor === 'black' ? socket.id : 'ai',
          white: playerColor === 'white' ? socket.id : 'ai',
        },
        playerUsers: {
          black: playerColor === 'black' ? socket.user : { username: `AI (${difficulty})` },
          white: playerColor === 'white' ? socket.user : { username: `AI (${difficulty})` },
        },
        blackId: playerColor === 'black' ? socket.user.id : null,
        whiteId: playerColor === 'white' ? socket.user.id : null,
        timer: { black: totalTime, white: totalTime, totalTime },
        status: 'playing',
        spectators: new Set(),
        createdAt: new Date().toISOString(),
      };

      games.set(gameId, game);
      socket.join(gameId);
      socket.gameId = gameId;

      socket.emit('game:start', sanitizeGame(game));
      startTimer(io, gameId);
      broadcastActiveGames(io);

      if (playerColor === 'white') {
        setTimeout(() => makeAIMove(io, gameId), 500);
      }
    });

    // --- Create PvP game ---
    socket.on('create:pvp', ({ boardSize = 19, timeLimit } = {}) => {
      const waiting = waitingPlayers.get(boardSize);
      if (waiting && waiting.id !== socket.id) {
        waitingPlayers.delete(boardSize);
        const gameId = randomUUID();
        const totalTime = timeLimit || DEFAULT_TIME[boardSize] || 1800;
        const game = {
          id: gameId,
          type: 'pvp',
          boardSize,
          board: createBoard(boardSize),
          currentColor: BLACK,
          koPoint: null,
          moves: [],
          history: [],
          captures: { black: 0, white: 0 },
          passes: 0,
          players: { black: waiting.id, white: socket.id },
          playerUsers: { black: waiting.user, white: socket.user },
          blackId: waiting.user.id,
          whiteId: socket.user.id,
          timer: { black: totalTime, white: totalTime, totalTime },
          status: 'playing',
          spectators: new Set(),
          createdAt: new Date().toISOString(),
        };

        games.set(gameId, game);
        waiting.join(gameId);
        socket.join(gameId);
        waiting.gameId = gameId;
        socket.gameId = gameId;

        io.to(gameId).emit('game:start', sanitizeGame(game));
        startTimer(io, gameId);
        broadcastActiveGames(io);
      } else {
        waitingPlayers.set(boardSize, socket);
        socket.emit('game:waiting', { boardSize });
      }
    });

    // --- Cancel matchmaking ---
    socket.on('cancel:pvp', () => {
      for (const [size, s] of waitingPlayers) {
        if (s.id === socket.id) waitingPlayers.delete(size);
      }
      socket.emit('game:cancelled');
    });

    // --- Place a stone ---
    socket.on('move', ({ x, y }) => {
      const game = games.get(socket.gameId);
      if (!game || game.status !== 'playing') return;

      const playerColor = game.players.black === socket.id ? BLACK : WHITE;
      if (game.currentColor !== playerColor) return socket.emit('error', '不是你的回合');

      const result = playMove(game.board, x, y, playerColor, game.koPoint);
      if (!result) return socket.emit('error', '无效落子');

      // Save state for undo
      game.history.push({
        board: cloneBoard(game.board),
        koPoint: game.koPoint,
        captures: { ...game.captures },
        currentColor: game.currentColor,
        passes: game.passes,
        moves: [...game.moves],
      });
      // Keep history manageable
      if (game.history.length > 400) game.history = game.history.slice(-200);

      game.board = result.board;
      game.koPoint = result.koPoint;
      game.passes = 0;
      if (playerColor === BLACK) game.captures.black += result.captured;
      else game.captures.white += result.captured;
      game.moves.push({ x, y, color: playerColor });
      game.currentColor = playerColor === BLACK ? WHITE : BLACK;

      io.to(game.id).emit('game:update', sanitizeGame(game));

      if (game.type === 'ai' && game.status === 'playing') {
        setTimeout(() => makeAIMove(io, game.id), 300);
      }
    });

    // --- Pass ---
    socket.on('pass', () => {
      const game = games.get(socket.gameId);
      if (!game || game.status !== 'playing') return;

      const playerColor = game.players.black === socket.id ? BLACK : WHITE;
      if (game.currentColor !== playerColor) return;

      game.history.push({
        board: cloneBoard(game.board),
        koPoint: game.koPoint,
        captures: { ...game.captures },
        currentColor: game.currentColor,
        passes: game.passes,
        moves: [...game.moves],
      });

      game.passes++;
      game.moves.push({ pass: true, color: playerColor });
      game.currentColor = playerColor === BLACK ? WHITE : BLACK;

      if (game.passes >= 2) {
        endGame(io, game);
      } else {
        io.to(game.id).emit('game:update', sanitizeGame(game));
        if (game.type === 'ai' && game.status === 'playing') {
          setTimeout(() => makeAIMove(io, game.id), 300);
        }
      }
    });

    // --- Undo (AI mode only) ---
    socket.on('undo', () => {
      const game = games.get(socket.gameId);
      if (!game || game.status !== 'playing' || game.type !== 'ai') return;
      // Undo 2 steps (player + AI)
      if (game.history.length < 2) return socket.emit('error', '无法悔棋');

      const prev = game.history[game.history.length - 2];
      game.history = game.history.slice(0, -2);
      game.board = prev.board;
      game.koPoint = prev.koPoint;
      game.captures = prev.captures;
      game.currentColor = prev.currentColor;
      game.passes = prev.passes;
      game.moves = prev.moves;

      io.to(game.id).emit('game:update', sanitizeGame(game));
    });

    // --- Resign ---
    socket.on('resign', () => {
      const game = games.get(socket.gameId);
      if (!game || game.status !== 'playing') return;

      const playerColor = game.players.black === socket.id ? 'black' : 'white';
      game.status = 'ended';
      game.result = { winner: playerColor === 'black' ? 'white' : 'black', reason: 'resign' };
      stopTimer(game.id);
      persistGame(game);
      io.to(game.id).emit('game:end', sanitizeGame(game));
      broadcastActiveGames(io);
    });

    // --- Spectate ---
    socket.on('spectate', ({ gameId }) => {
      const game = games.get(gameId);
      if (!game) return socket.emit('error', '对局不存在');
      socket.join(gameId);
      socket.spectatingId = gameId;
      game.spectators.add(socket.id);
      socket.emit('game:start', { ...sanitizeGame(game), spectating: true });
      io.to(gameId).emit('game:spectators', game.spectators.size);
    });

    socket.on('leave:spectate', () => {
      if (socket.spectatingId) {
        const game = games.get(socket.spectatingId);
        if (game) {
          game.spectators.delete(socket.id);
          io.to(socket.spectatingId).emit('game:spectators', game.spectators.size);
        }
        socket.leave(socket.spectatingId);
        socket.spectatingId = null;
      }
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      // Remove socket from online tracking
      const uid = socket.user.id;
      if (uid && uid !== 0 && onlineUsers.has(uid)) {
        const entry = onlineUsers.get(uid);
        entry.sockets.delete(socket.id);
        if (entry.sockets.size === 0) onlineUsers.delete(uid);
      }
      broadcastOnlineUsers(io);

      for (const [size, s] of waitingPlayers) {
        if (s.id === socket.id) waitingPlayers.delete(size);
      }

      // Spectator cleanup
      if (socket.spectatingId) {
        const game = games.get(socket.spectatingId);
        if (game) {
          game.spectators.delete(socket.id);
          io.to(socket.spectatingId).emit('game:spectators', game.spectators.size);
        }
      }

      // Active game disconnect
      const game = games.get(socket.gameId);
      if (game && game.status === 'playing' && game.type === 'pvp') {
        game.status = 'ended';
        const playerColor = game.players.black === socket.id ? 'black' : 'white';
        game.result = { winner: playerColor === 'black' ? 'white' : 'black', reason: 'disconnect' };
        stopTimer(game.id);
        persistGame(game);
        io.to(game.id).emit('game:end', sanitizeGame(game));
        broadcastActiveGames(io);
      }
    });
  });
}

// --- Timer ---
function startTimer(io, gameId) {
  const interval = setInterval(() => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') { clearInterval(interval); gameTimers.delete(gameId); return; }

    const colorKey = game.currentColor === BLACK ? 'black' : 'white';
    game.timer[colorKey]--;

    if (game.timer[colorKey] <= 0) {
      game.timer[colorKey] = 0;
      game.status = 'ended';
      game.result = { winner: colorKey === 'black' ? 'white' : 'black', reason: 'timeout' };
      clearInterval(interval);
      gameTimers.delete(gameId);
      persistGame(game);
      io.to(game.id).emit('game:end', sanitizeGame(game));
      broadcastActiveGames(io);
      return;
    }

    io.to(game.id).emit('game:timer', { black: game.timer.black, white: game.timer.white });
  }, 1000);
  gameTimers.set(gameId, interval);
}

function stopTimer(gameId) {
  const interval = gameTimers.get(gameId);
  if (interval) { clearInterval(interval); gameTimers.delete(gameId); }
}

// --- AI Move ---
function makeAIMove(io, gameId) {
  const game = games.get(gameId);
  if (!game || game.status !== 'playing') return;

  const aiColor = game.players.black === 'ai' ? BLACK : WHITE;
  if (game.currentColor !== aiColor) return;

  // Save state for undo
  game.history.push({
    board: cloneBoard(game.board),
    koPoint: game.koPoint,
    captures: { ...game.captures },
    currentColor: game.currentColor,
    passes: game.passes,
    moves: [...game.moves],
  });

  const move = getAIMove(game.board, aiColor, game.koPoint, game.difficulty);

  if (!move) {
    game.passes++;
    game.moves.push({ pass: true, color: aiColor });
    game.currentColor = aiColor === BLACK ? WHITE : BLACK;
    if (game.passes >= 2) {
      endGame(io, game);
    } else {
      io.to(game.id).emit('game:update', sanitizeGame(game));
    }
    return;
  }

  const [x, y] = move;
  const result = playMove(game.board, x, y, aiColor, game.koPoint);
  if (!result) {
    game.passes++;
    game.moves.push({ pass: true, color: aiColor });
    game.currentColor = aiColor === BLACK ? WHITE : BLACK;
    io.to(game.id).emit('game:update', sanitizeGame(game));
    return;
  }

  game.board = result.board;
  game.koPoint = result.koPoint;
  game.passes = 0;
  if (aiColor === BLACK) game.captures.black += result.captured;
  else game.captures.white += result.captured;
  game.moves.push({ x, y, color: aiColor });
  game.currentColor = aiColor === BLACK ? WHITE : BLACK;

  io.to(game.id).emit('game:update', sanitizeGame(game));
}

// --- End Game ---
function endGame(io, game) {
  game.status = 'ended';
  const score = calculateScore(game.board);
  game.result = {
    winner: score.black > score.white ? 'black' : 'white',
    reason: 'score',
    score
  };
  stopTimer(game.id);
  persistGame(game);
  io.to(game.id).emit('game:end', sanitizeGame(game));
  broadcastActiveGames(io);
}

// --- Persist game + ELO ---
function persistGame(game) {
  try {
    const elapsed = Math.floor((Date.now() - new Date(game.createdAt).getTime()) / 1000);
    game.durationSeconds = elapsed;
    saveGame(game);

    if (game.type === 'pvp' && game.result && game.blackId && game.whiteId) {
      const winnerId = game.result.winner === 'black' ? game.blackId : game.whiteId;
      const loserId = game.result.winner === 'black' ? game.whiteId : game.blackId;
      if (winnerId && loserId) updateELO(winnerId, loserId);
    }
  } catch (e) {
    console.error('Failed to persist game:', e.message);
  }
}

// --- Helpers ---
function getOnlineList() {
  return Array.from(onlineUsers.values()).map(u => ({ id: u.id, username: u.username, rating: u.rating }));
}

function getActiveGamesList() {
  const list = [];
  for (const [id, game] of games) {
    if (game.status !== 'playing') continue;
    list.push({
      id,
      type: game.type,
      boardSize: game.boardSize,
      players: game.playerUsers,
      moves: game.moves.length,
      spectators: game.spectators.size,
    });
  }
  return list;
}

function broadcastOnlineUsers(io) {
  io.emit('online:users', getOnlineList());
}

function broadcastActiveGames(io) {
  io.emit('active:games', getActiveGamesList());
}

function sanitizeGame(game) {
  return {
    id: game.id,
    type: game.type,
    boardSize: game.boardSize,
    board: game.board,
    currentColor: game.currentColor,
    moves: game.moves,
    captures: game.captures,
    passes: game.passes,
    status: game.status,
    result: game.result,
    players: game.playerUsers,
    difficulty: game.difficulty,
    timer: { black: game.timer.black, white: game.timer.white, totalTime: game.timer.totalTime },
    spectators: game.spectators?.size || 0,
    canUndo: game.type === 'ai' && game.history.length >= 2,
  };
}
