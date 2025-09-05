const GameSession = require("../../models/GameSession");

// In-memory storage for active game rooms
const gameRooms = new Map();

/**
 * Generates a unique 6-character room code
 * @returns {string} Uppercase room code
 */
const generateRoomCode = () => {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
};

/**
 * Checks for winning combination on the game board
 * @param {Array} board - 3x3 tic-tac-toe board represented as flat array
 * @returns {string|null} Winner symbol ('X' or 'O') or null if no winner
 */
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

/**
 * Updates game session in database with round results
 * Maps player symbols to correct database player names
 * @param {Object} room - Game room object
 * @param {string|null} winner - Winning symbol ('X', 'O', or null for draw)
 * @param {boolean} isDraw - Whether the round ended in a draw
 */
const updateGameSessionInDatabase = async (room, winner, isDraw) => {
  try {
    const updates = { $inc: { totalRounds: 1 } };

    if (winner) {
      const gameSession = await GameSession.findById(room.gameSessionId);
      if (!gameSession) {
        console.error(`GameSession ${room.gameSessionId} not found`);
        return;
      }

      const winnerPlayer = room.players.find((p) => p.symbol === winner);
      if (!winnerPlayer) {
        console.error(`Winner player with symbol ${winner} not found`);
        return;
      }

      // Map winner to correct database player using name (not array position)
      if (winnerPlayer.name === gameSession.player1Name) {
        updates.$inc.player1Wins = 1;
      } else if (winnerPlayer.name === gameSession.player2Name) {
        updates.$inc.player2Wins = 1;
      } else {
        console.error(
          `Winner ${winnerPlayer.name} doesn't match gameSession player names`
        );
        return;
      }
    } else if (isDraw) {
      updates.$inc.draws = 1;
    }

    await GameSession.findByIdAndUpdate(room.gameSessionId, updates);
    console.log(
      `GameSession ${room.gameSessionId} updated: winner=${winner}, isDraw=${isDraw}`
    );
  } catch (error) {
    console.error(`Failed to update GameSession ${room.gameSessionId}:`, error);
  }
};

/**
 * Starts a new round with symbol swapping and fresh game state
 * @param {Object} io - Socket.io server instance
 * @param {string} roomCode - Room identifier
 * @param {Object} room - Game room object
 */
const startNewRound = async (io, roomCode, room) => {
  // Swap player symbols every round for fairness (except first game)
  if (room.roundCount > 0 && room.players.length === 2) {
    const temp = room.players[0].symbol;
    room.players[0].symbol = room.players[1].symbol;
    room.players[1].symbol = temp;
  }

  room.roundCount += 1;

  // Reset game state for new round
  room.gameState = {
    board: Array(9).fill(null),
    currentTurn: "X",
    winner: null,
    isDraw: false,
    isActive: true,
  };

  // Clear ready status for next confirmation cycle
  room.playersReady.clear();

  // Fetch updated standings from database
  let gameSessionData = null;
  if (room.gameSessionId) {
    try {
      gameSessionData = await GameSession.findById(room.gameSessionId);
    } catch (error) {
      console.error(
        `Failed to fetch GameSession ${room.gameSessionId}:`,
        error
      );
    }
  }

  // Notify all players that new round has started
  io.to(roomCode).emit("new_round_started", {
    gameState: room.gameState,
    players: room.players,
    gameSession: gameSessionData,
  });

  console.log(
    `New round started in room: ${roomCode}, Round: ${room.roundCount}`
  );
};

/**
 * Socket Event Handlers - All WebSocket event handling logic
 */
const socketHandlers = {
  /**
   * CONNECTION - New client connects to server
   */
  handleConnection: (io, socket) => {
    console.log("Player connected:", socket.id);
  },

  /**
   * CREATE ROOM - Player creates a new game room
   */
  handleCreateRoom: (io, socket) => {
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
        roundCount: 0,
        playersReady: new Set(),
        createdAt: new Date(),
      };

      gameRooms.set(roomCode, roomData);
      socket.join(roomCode);

      console.log(`Room created: ${roomCode} by ${playerName}`);
      callback({ success: true, roomCode, playerSymbol: "X" });
    });
  },

  /**
   * JOIN ROOM - Player joins an existing room
   */
  handleJoinRoom: (io, socket) => {
    socket.on("join_room", async (roomCode, playerName, callback) => {
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
      room.roundCount = 1;

      socket.join(roomCode);
      console.log(`${playerName} joined room: ${roomCode}`);

      // Create GameSession in database when both players are present
      if (room.players.length === 2) {
        try {
          const gameSession = new GameSession({
            player1Name: room.players[0].name,
            player2Name: room.players[1].name,
          });
          const savedSession = await gameSession.save();
          room.gameSessionId = savedSession._id;
          console.log(
            `GameSession created for room ${roomCode}: ${savedSession._id}`
          );
        } catch (error) {
          console.error(
            `Failed to create GameSession for room ${roomCode}:`,
            error
          );
        }
      }

      let gameSessionData = null;
      if (room.gameSessionId) {
        try {
          gameSessionData = await GameSession.findById(room.gameSessionId);
        } catch (error) {
          console.error(
            `Failed to fetch GameSession ${room.gameSessionId}:`,
            error
          );
        }
      }

      // Notify all players that game is ready to start
      io.to(roomCode).emit("game_ready", {
        players: room.players,
        gameState: room.gameState,
        gameSession: gameSessionData,
      });

      callback({ success: true, roomCode, playerSymbol: "O" });
    });
  },

  /**
   * JOIN EXISTING ROOM - Player rejoins room (for page navigation/reconnection)
   */
  handleJoinExistingRoom: (io, socket) => {
    socket.on(
      "join_existing_room",
      async (roomCode, playerName, playerSymbol, callback) => {
        const room = gameRooms.get(roomCode);

        if (!room) {
          callback({ success: false, error: "Room not found" });
          return;
        }

        // Check if player is rejoining existing session
        const existingPlayer = room.players.find(
          (p) => p.name === playerName && p.symbol === playerSymbol
        );
        if (existingPlayer) {
          existingPlayer.id = socket.id;
          socket.join(roomCode);

          let gameSessionData = null;
          if (room.gameSessionId) {
            try {
              gameSessionData = await GameSession.findById(room.gameSessionId);
            } catch (error) {
              console.error(
                `Failed to fetch GameSession ${room.gameSessionId}:`,
                error
              );
            }
          }

          socket.emit("game_ready", {
            players: room.players,
            gameState: room.gameState,
            gameSession: gameSessionData,
          });

          callback({ success: true });
          return;
        }

        // Join as new player if room has space
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

          let gameSessionData = null;
          if (room.gameSessionId) {
            try {
              gameSessionData = await GameSession.findById(room.gameSessionId);
            } catch (error) {
              console.error(
                `Failed to fetch GameSession ${room.gameSessionId}:`,
                error
              );
            }
          }

          // Notify all players that game is ready
          io.to(roomCode).emit("game_ready", {
            players: room.players,
            gameState: room.gameState,
            gameSession: gameSessionData,
          });

          callback({ success: true });
          return;
        }

        callback({ success: false, error: "Room is full or invalid" });
      }
    );
  },

  /**
   * MAKE MOVE - Player makes a move in the game
   */
  handleMakeMove: (io, socket) => {
    socket.on("make_move", async (roomCode, position, callback) => {
      const room = gameRooms.get(roomCode);

      // Validate game state
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

      // Execute move
      room.gameState.board[position] = player.symbol;
      room.gameState.currentTurn = player.symbol === "X" ? "O" : "X";

      // Check for game end conditions
      const winner = checkWinner(room.gameState.board);
      const isDraw =
        !winner && room.gameState.board.every((cell) => cell !== null);

      if (winner || isDraw) {
        room.gameState.winner = winner;
        room.gameState.isDraw = isDraw;
        room.gameState.isActive = false;

        // Update database and send response with fresh standings
        if (room.gameSessionId) {
          await updateGameSessionInDatabase(room, winner, isDraw);

          try {
            const updatedGameSession = await GameSession.findById(
              room.gameSessionId
            );
            io.to(roomCode).emit("move_made", {
              position,
              player: player.symbol,
              gameState: room.gameState,
              gameSession: updatedGameSession,
            });
          } catch (error) {
            console.error(
              `Failed to fetch updated GameSession ${room.gameSessionId}:`,
              error
            );
            io.to(roomCode).emit("move_made", {
              position,
              player: player.symbol,
              gameState: room.gameState,
            });
          }
        } else {
          io.to(roomCode).emit("move_made", {
            position,
            player: player.symbol,
            gameState: room.gameState,
          });
        }
      } else {
        // Game continues - notify players of move
        io.to(roomCode).emit("move_made", {
          position,
          player: player.symbol,
          gameState: room.gameState,
        });
      }

      callback({ success: true });
    });
  },

  /**
   * PLAYER READY - Player indicates readiness for next round
   */
  handlePlayerReady: (io, socket) => {
    socket.on("player_ready", (roomCode) => {
      const room = gameRooms.get(roomCode);

      if (!room) {
        return;
      }

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) {
        return;
      }

      room.playersReady.add(socket.id);
      console.log(
        `Player ${player.name} is ready in room ${roomCode}. Ready count: ${room.playersReady.size}/2`
      );

      // Notify all players about ready status
      io.to(roomCode).emit("player_ready_status", {
        readyCount: room.playersReady.size,
        totalPlayers: room.players.length,
        playerReady: player.name,
      });

      // Start new round if both players are ready
      if (room.playersReady.size === 2 && room.players.length === 2) {
        startNewRound(io, roomCode, room);
      }
    });
  },

  /**
   * NEW ROUND - Legacy handler for immediate round restart
   */
  handleNewRound: (io, socket) => {
    socket.on("new_round", (roomCode) => {
      const room = gameRooms.get(roomCode);
      if (!room) return;

      startNewRound(io, roomCode, room);
    });
  },

  /**
   * SEND MESSAGE - Player sends chat message
   */
  handleSendMessage: (io, socket) => {
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

      // Broadcast message to all players in room
      io.to(roomCode).emit("new_message", chatMessage);
      console.log(
        `Chat message in room ${roomCode}: ${player.name}: ${message}`
      );
    });
  },

  /**
   * DISCONNECT - Player disconnects from server
   */
  handleDisconnect: (io, socket) => {
    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);

      // Find and handle disconnection from active rooms
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
  },
};

/**
 * Room Cleanup Service - Removes inactive rooms periodically
 */
const startRoomCleanup = () => {
  setInterval(() => {
    const now = new Date();
    for (const [roomCode, room] of gameRooms.entries()) {
      // Remove rooms older than 30 minutes with no activity
      if (now - room.createdAt > 30 * 60 * 1000) {
        gameRooms.delete(roomCode);
        console.log(`Cleaned up inactive room: ${roomCode}`);
      }
    }
  }, 5 * 60 * 1000); // Run cleanup every 5 minutes
};

/**
 * Initialize all socket handlers for the io server
 * @param {Object} io - Socket.io server instance
 */
const initializeSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    // Initialize connection
    socketHandlers.handleConnection(io, socket);

    // Register all event handlers
    socketHandlers.handleCreateRoom(io, socket);
    socketHandlers.handleJoinRoom(io, socket);
    socketHandlers.handleJoinExistingRoom(io, socket);
    socketHandlers.handleMakeMove(io, socket);
    socketHandlers.handlePlayerReady(io, socket);
    socketHandlers.handleNewRound(io, socket);
    socketHandlers.handleSendMessage(io, socket);
    socketHandlers.handleDisconnect(io, socket);
  });

  // Start background services
  startRoomCleanup();
};

module.exports = {
  initializeSocketHandlers,
  socketHandlers, // Export for testing
  gameRooms, // Export for testing/monitoring
};
