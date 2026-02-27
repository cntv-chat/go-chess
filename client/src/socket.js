import { io } from 'socket.io-client';

let socket = null;
let currentToken = null;

export function getSocket(token) {
  // If token changed, disconnect old socket
  if (socket && currentToken !== token) {
    socket.disconnect();
    socket = null;
  }

  if (socket && socket.connected) return socket;

  // If socket exists but disconnected, let it reconnect
  if (socket) return socket;

  currentToken = token;
  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
