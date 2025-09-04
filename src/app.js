const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const config = require("./config");
const {
  connectDatabase,
  disconnectDatabase,
} = require("./database/connection");
const setupMiddleware = require("./middleware");
const setupRoutes = require("./routes");
const { errorHandler, notFoundHandler } = require("./errors");

const createApp = () => {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: config.CORS_ORIGINS,
      methods: ["GET", "POST", "PUT"],
      credentials: true,
    },
  });

  setupMiddleware(app);
  setupRoutes(app);
  setupSocketIO(io);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, server, io };
};

const setupSocketIO = (io) => {
  const gameRooms = new Map();
  const generateRoomCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("create_room", (playerName, callback) => {
      const roomCode = generateRoomCode();
      const roomData = {
        roomCode,
        players: [{ id: socket.id, name: playerName, symbol: "X" }],
        gameState: {
          board: Array(9).fill(null),
          currentTurn: "X",
          winner: null,
          isDraw: false,
          isActive: false,
        },
        createdAt: new Date(),
      };

      gameRooms.set(roomCode, roomData);
      socket.join(roomCode);

      console.log(`Room created: ${roomCode} by ${playerName}`);
      callback({ success: true, roomCode, playerSymbol: "X" });
    });

    socket.on("join_room", (roomCode, playerName, callback) => {
      const room = gameRooms.get(roomCode);

      if (!room) {
        callback({ success: false, error: "Room not found" });
        return;
      }

      if (room.players.length >= 2) {
        callback({ success: false, error: "Room is full" });
        return;
      }

      room.players.push({ id: socket.id, name: playerName, symbol: "O" });
      room.gameState.isActive = true;

      socket.join(roomCode);

      console.log(`${playerName} joined room: ${roomCode}`);

      io.to(roomCode).emit("game_ready", {
        players: room.players,
        gameState: room.gameState,
      });

      callback({ success: true, roomCode, playerSymbol: "O" });
    });

    // WebSocket: Join existing room (for page navigation)
    socket.on(
      "join_existing_room",
      (roomCode, playerName, playerSymbol, callback) => {
        const room = gameRooms.get(roomCode);

        if (!room) {
          callback({ success: false, error: "Room not found" });
          return;
        }

        const existingPlayer = room.players.find(
          (p) => p.name === playerName && p.symbol === playerSymbol
        );
        if (existingPlayer) {
          existingPlayer.id = socket.id;
          socket.join(roomCode);

          socket.emit("game_ready", {
            players: room.players,
            gameState: room.gameState,
          });

          callback({ success: true });
          return;
        }

        if (
          room.players.length === 1 &&
          !room.players.find((p) => p.symbol === playerSymbol)
        ) {
          room.players.push({
            id: socket.id,
            name: playerName,
            symbol: playerSymbol,
          });
          room.gameState.isActive = true;
          socket.join(roomCode);

          console.log(`${playerName} joined existing room: ${roomCode}`);

          io.to(roomCode).emit("game_ready", {
            players: room.players,
            gameState: room.gameState,
          });

          callback({ success: true });
          return;
        }

        callback({ success: false, error: "Room is full or invalid" });
      }
    );

    socket.on("make_move", (roomCode, position, callback) => {
      const room = gameRooms.get(roomCode);

      if (!room || !room.gameState.isActive) {
        callback({ success: false, error: "Game not active" });
        return;
      }

      const player = room.players.find((p) => p.id === socket.id);
      if (!player || player.symbol !== room.gameState.currentTurn) {
        callback({ success: false, error: "Not your turn" });
        return;
      }

      if (room.gameState.board[position] !== null) {
        callback({ success: false, error: "Position already taken" });
        return;
      }

      room.gameState.board[position] = player.symbol;
      room.gameState.currentTurn = player.symbol === "X" ? "O" : "X";

      const winner = checkWinner(room.gameState.board);
      const isDraw =
        !winner && room.gameState.board.every((cell) => cell !== null);

      if (winner || isDraw) {
        room.gameState.winner = winner;
        room.gameState.isDraw = isDraw;
        room.gameState.isActive = false;
      }

      io.to(roomCode).emit("move_made", {
        position,
        player: player.symbol,
        gameState: room.gameState,
      });

      callback({ success: true });
    });

    // WebSocket: Start new round
    socket.on("new_round", (roomCode) => {
      const room = gameRooms.get(roomCode);

      if (!room) {
        return;
      }

      room.gameState = {
        board: Array(9).fill(null),
        currentTurn: "X",
        winner: null,
        isDraw: false,
        isActive: true,
      };

      io.to(roomCode).emit("new_round_started", {
        gameState: room.gameState,
      });

      console.log(`New round started in room: ${roomCode}`);
    });

    // WebSocket: Send chat message
    socket.on("send_message", (roomCode, message, playerName) => {
      const room = gameRooms.get(roomCode);

      if (!room) {
        return;
      }

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) {
        return;
      }

      const chatMessage = {
        id: Date.now().toString(),
        playerName: player.name,
        playerSymbol: player.symbol,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };

      io.to(roomCode).emit("new_message", chatMessage);
      console.log(
        `Chat message in room ${roomCode}: ${player.name}: ${message}`
      );
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);

      for (const [roomCode, room] of gameRooms.entries()) {
        const playerIndex = room.players.findIndex((p) => p.id === socket.id);
        if (playerIndex !== -1) {
          if (room.players.length === 2) {
            socket.to(roomCode).emit("player_disconnected");
          }
          console.log(
            `Player ${socket.id} disconnected from room ${roomCode}, keeping room active for reconnection`
          );
          break;
        }
      }
    });
  });

  const checkWinner = (board) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  };

  // Clean up inactive rooms every 5 minutes
  setInterval(() => {
    const now = new Date();
    for (const [roomCode, room] of gameRooms.entries()) {
      // Remove rooms older than 30 minutes with no activity
      if (now - room.createdAt > 30 * 60 * 1000) {
        gameRooms.delete(roomCode);
        console.log(`Cleaned up inactive room: ${roomCode}`);
      }
    }
  }, 5 * 60 * 1000);
};

const startServer = async () => {
  try {
    await connectDatabase(config.MONGODB_URI);
    const { server } = createApp();

    server.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
      console.log(`API available at: http://localhost:${config.PORT}`);
      console.log(`Health check: http://localhost:${config.PORT}`);
      console.log(`Games API: http://localhost:${config.PORT}/api/games`);
      console.log(`WebSocket available for real-time multiplayer`);
      console.log(`Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT, shutting down gracefully...");

  try {
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

module.exports = { createApp, startServer };
