import { verifyToken } from '../middleware/auth.js';
import { createBoard, playMove, calculateScore, BLACK, WHITE, EMPTY } from '../game/engine.js';
import { getAIMove } from '../game/ai.js';
import { randomUUID } from 'crypto';

const games = new Map(); // gameId -> game state
const waitingPlayers = new Map(); // boardSize -> socket

export function setupGameSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      const user = verifyToken(token);
      if (user) {
        socket.user = user;
        return next();
      }
    }
    // Allow anonymous play for AI games
    socket.user = { id: 0, username: 'Guest' };
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Connected: ${socket.user.username}`);

    // Create AI game
    socket.on('create:ai', ({ boardSize = 19, difficulty = 'medium', playerColor = 'black' }) => {
      const gameId = randomUUID();
      const game = {
        id: gameId,
        type: 'ai',
        boardSize,
        board: createBoard(boardSize),
        currentColor: BLACK,
        koPoint: null,
        moves: [],
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
        status: 'playing',
      };

      games.set(gameId, game);
      socket.join(gameId);
      socket.gameId = gameId;

      socket.emit('game:start', sanitizeGame(game));

      // If AI plays first (player chose white)
      if (playerColor === 'white') {
        setTimeout(() => makeAIMove(io, gameId), 500);
      }
    });

    // Join matchmaking for PvP
    socket.on('create:pvp', ({ boardSize = 19 }) => {
      const waiting = waitingPlayers.get(boardSize);
      if (waiting && waiting.id !== socket.id) {
        // Match found
        waitingPlayers.delete(boardSize);
        const gameId = randomUUID();
        const game = {
          id: gameId,
          type: 'pvp',
          boardSize,
          board: createBoard(boardSize),
          currentColor: BLACK,
          koPoint: null,
          moves: [],
          captures: { black: 0, white: 0 },
          passes: 0,
          players: { black: waiting.id, white: socket.id },
          playerUsers: { black: waiting.user, white: socket.user },
          status: 'playing',
        };

        games.set(gameId, game);
        waiting.join(gameId);
        socket.join(gameId);
        waiting.gameId = gameId;
        socket.gameId = gameId;

        io.to(gameId).emit('game:start', sanitizeGame(game));
      } else {
        waitingPlayers.set(boardSize, socket);
        socket.emit('game:waiting', { boardSize });
      }
    });

    // Cancel matchmaking
    socket.on('cancel:pvp', () => {
      for (const [size, s] of waitingPlayers) {
        if (s.id === socket.id) waitingPlayers.delete(size);
      }
      socket.emit('game:cancelled');
    });

    // Place a stone
    socket.on('move', ({ x, y }) => {
      const game = games.get(socket.gameId);
      if (!game || game.status !== 'playing') return;

      const playerColor = game.players.black === socket.id ? BLACK : WHITE;
      if (game.currentColor !== playerColor) return socket.emit('error', '不是你的回合');

      const result = playMove(game.board, x, y, playerColor, game.koPoint);
      if (!result) return socket.emit('error', '无效落子');

      game.board = result.board;
      game.koPoint = result.koPoint;
      game.passes = 0;
      if (playerColor === BLACK) game.captures.black += result.captured;
      else game.captures.white += result.captured;
      game.moves.push({ x, y, color: playerColor });
      game.currentColor = playerColor === BLACK ? WHITE : BLACK;

      io.to(game.id).emit('game:update', sanitizeGame(game));

      // AI response
      if (game.type === 'ai' && game.status === 'playing') {
        setTimeout(() => makeAIMove(io, game.id), 300);
      }
    });

    // Pass
    socket.on('pass', () => {
      const game = games.get(socket.gameId);
      if (!game || game.status !== 'playing') return;

      const playerColor = game.players.black === socket.id ? BLACK : WHITE;
      if (game.currentColor !== playerColor) return;

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

    // Resign
    socket.on('resign', () => {
      const game = games.get(socket.gameId);
      if (!game || game.status !== 'playing') return;

      const playerColor = game.players.black === socket.id ? 'black' : 'white';
      game.status = 'ended';
      game.result = { winner: playerColor === 'black' ? 'white' : 'black', reason: 'resign' };
      io.to(game.id).emit('game:end', sanitizeGame(game));
    });

    socket.on('disconnect', () => {
      // Remove from waiting
      for (const [size, s] of waitingPlayers) {
        if (s.id === socket.id) waitingPlayers.delete(size);
      }
      // Handle disconnect in active game
      const game = games.get(socket.gameId);
      if (game && game.status === 'playing' && game.type === 'pvp') {
        game.status = 'ended';
        const playerColor = game.players.black === socket.id ? 'black' : 'white';
        game.result = { winner: playerColor === 'black' ? 'white' : 'black', reason: 'disconnect' };
        io.to(game.id).emit('game:end', sanitizeGame(game));
      }
    });
  });
}

function makeAIMove(io, gameId) {
  const game = games.get(gameId);
  if (!game || game.status !== 'playing') return;

  const aiColor = game.players.black === 'ai' ? BLACK : WHITE;
  if (game.currentColor !== aiColor) return;

  const move = getAIMove(game.board, aiColor, game.koPoint, game.difficulty);

  if (!move) {
    // AI passes
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
    // AI passes if move fails
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

function endGame(io, game) {
  game.status = 'ended';
  const score = calculateScore(game.board);
  game.result = {
    winner: score.black > score.white ? 'black' : 'white',
    reason: 'score',
    score
  };
  io.to(game.id).emit('game:end', sanitizeGame(game));
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
  };
}
