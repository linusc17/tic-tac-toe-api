const GameSession = require("../../models/GameSession");
const GameStatsService = require("./gameStatsService");
const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../../models/User");

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
 * Authenticates a socket token and returns user info
 * @param {string} token - JWT token
 * @returns {Promise<Object|null>} User object or null if invalid
 */
const authenticateSocket = async (token) => {
  try {
    if (!token) return null;

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) return null;

    return user;
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    return null;
  }
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
 *
 * This function is critical for maintaining accurate game statistics:
 * - Increments totalRounds for every completed game
 * - Maps winning symbol (X/O) to actual player names in database
 * - Updates player-specific win counts or draw count
 * - Handles edge cases where players or game sessions might not exist
 *
 * @param {Object} room - Game room object containing players and gameSessionId
 * @param {string|null} winner - Winning symbol ('X', 'O', or null for draw)
 * @param {boolean} isDraw - Whether the round ended in a draw
 */
const updateGameSessionInDatabase = async (
  room,
  winner,
  isDraw,
  board,
  moves
) => {
  try {
    const gameSession = await GameSession.findById(room.gameSessionId);
    if (!gameSession) {
      console.error(`GameSession ${room.gameSessionId} not found`);
      return;
    }

    let gameWinner = null;
    if (winner) {
      const winnerPlayer = room.players.find((p) => p.symbol === winner);
      if (!winnerPlayer) {
        console.error(`Winner player with symbol ${winner} not found`);
        return;
      }

      // Map winner to correct database player using name
      if (winnerPlayer.name === gameSession.player1Name) {
        gameWinner = "player1";
      } else if (winnerPlayer.name === gameSession.player2Name) {
        gameWinner = "player2";
      }
    } else if (isDraw) {
      gameWinner = "draw";
    }

    // Use GameStatsService to update both game session and user stats
    if (gameWinner) {
      try {
        await GameStatsService.updateUserStats(gameSession, {
          winner: gameWinner,
          board: board || Array(9).fill(null),
          moves: moves || [],
        });
        console.log(
          `GameSession ${room.gameSessionId} and user stats updated: winner=${gameWinner}`
        );
      } catch (error) {
        console.error(`Failed to update stats via GameStatsService:`, error);
        // Fallback to old method for game session only
        const updates = { $inc: { totalRounds: 1 } };
        if (gameWinner === "player1") {
          updates.$inc.player1Wins = 1;
        } else if (gameWinner === "player2") {
          updates.$inc.player2Wins = 1;
        } else if (gameWinner === "draw") {
          updates.$inc.draws = 1;
        }
        await GameSession.findByIdAndUpdate(room.gameSessionId, updates);
      }
    }
  } catch (error) {
    console.error(`Failed to update GameSession ${room.gameSessionId}:`, error);
  }
};

/**
 * Starts a new round with symbol swapping and fresh game state
 *
 * Key behaviors:
 * - Swaps X/O symbols between players every round (except first) for fairness
 * - Resets game board and state for fresh round
 * - Clears player ready status to require confirmation for next round
 * - Fetches updated game statistics from database
 * - Notifies all players in room about the new round
 *
 * @param {Object} io - Socket.io server instance
 * @param {string} roomCode - Room identifier
 * @param {Object} room - Game room object
 */
const startNewRound = async (io, roomCode, room) => {
  // Swap player symbols every round for fairness (except first game)
  // This ensures no player always gets the advantage of going first (X always starts)
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
    socket.on("create_room", async (dataOrPlayerName, callback) => {
      // Handle both old format (just playerName) and new format (object with playerName and token)
      let playerName, token;

      if (typeof dataOrPlayerName === "string") {
        // Old format: just player name
        playerName = dataOrPlayerName;
        token = null;
      } else if (
        typeof dataOrPlayerName === "object" &&
        dataOrPlayerName !== null
      ) {
        // New format: object with playerName and token
        playerName = dataOrPlayerName.playerName;
        token = dataOrPlayerName.token;
      } else {
        if (callback)
          callback({ success: false, error: "Invalid data format" });
        return;
      }

      // Authenticate user if token provided
      const user = await authenticateSocket(token);

      const roomCode = generateRoomCode();
      const roomData = {
        roomCode,
        players: [
          {
            id: socket.id,
            name: playerName,
            symbol: "X",
            userId: user ? user._id : null,
          },
        ],
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

      console.log(
        `Room created: ${roomCode} by ${playerName}${user ? ` (authenticated)` : ` (guest)`}`
      );
      if (callback) callback({ success: true, roomCode, playerSymbol: "X" });
    });
  },

  /**
   * JOIN ROOM - Player joins an existing room
   */
  handleJoinRoom: (io, socket) => {
    socket.on(
      "join_room",
      async (roomCodeOrData, playerNameOrCallback, callbackOrUndefined) => {
        // Handle both old format (roomCode, playerName, callback) and new format (data object, callback)
        let roomCode, playerName, token, callback;

        if (
          typeof roomCodeOrData === "string" &&
          typeof playerNameOrCallback === "string"
        ) {
          // Old format: join_room(roomCode, playerName, callback)
          roomCode = roomCodeOrData;
          playerName = playerNameOrCallback;
          callback = callbackOrUndefined;
          token = null;
        } else if (
          typeof roomCodeOrData === "object" &&
          roomCodeOrData !== null
        ) {
          // New format: join_room(data, callback)
          roomCode = roomCodeOrData.roomCode;
          playerName = roomCodeOrData.playerName;
          token = roomCodeOrData.token;
          callback = playerNameOrCallback;
        } else {
          if (typeof playerNameOrCallback === "function") {
            playerNameOrCallback({
              success: false,
              error: "Invalid data format",
            });
          }
          return;
        }

        const room = gameRooms.get(roomCode);

        if (!room) {
          if (callback) callback({ success: false, error: "Room not found" });
          return;
        }

        if (room.players.length >= 2) {
          if (callback) callback({ success: false, error: "Room is full" });
          return;
        }

        // Authenticate user if token provided
        const user = await authenticateSocket(token);

        room.players.push({
          id: socket.id,
          name: playerName,
          symbol: "O",
          userId: user ? user._id : null,
        });
        room.gameState.isActive = true;
        room.roundCount = 1;

        socket.join(roomCode);
        console.log(
          `${playerName} joined room: ${roomCode}${user ? ` (authenticated)` : ` (guest)`}`
        );

        // Create GameSession immediately for real-time standings
        // This creates the database record as soon as 2 players join,
        // allowing us to track statistics across multiple rounds
        if (room.players.length === 2) {
          try {
            const gameSession = new GameSession({
              player1Name: room.players[0].name,
              player2Name: room.players[1].name,
              player1Id: room.players[0].userId,
              player2Id: room.players[1].userId,
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

        if (callback) callback({ success: true, roomCode, playerSymbol: "O" });
      }
    );
  },

  /**
   * JOIN EXISTING ROOM - Player reconnects to room after page navigation
   */
  handleJoinExistingRoom: (io, socket) => {
    socket.on("join_existing_room", async (data, callback) => {
      const { roomCode, playerName, playerSymbol, token } = data;

      // Authenticate user if token provided
      const user = await authenticateSocket(token);
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
        // Update socket ID and ensure userId is set
        existingPlayer.id = socket.id;
        existingPlayer.userId = user ? user._id : null;
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

      callback({ success: false, error: "Player not found in room" });
    });
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
          // Create moves array from game state (simplified for now)
          const moves = [];
          room.gameState.board.forEach((cell, index) => {
            if (cell) {
              moves.push({
                player: cell,
                position: index,
                timestamp: new Date(),
              });
            }
          });

          await updateGameSessionInDatabase(
            room,
            winner,
            isDraw,
            room.gameState.board,
            moves
          );

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
    socket.on("disconnect", async () => {
      console.log("Player disconnected:", socket.id);

      // Find and handle disconnection from active rooms
      for (const [roomCode, room] of gameRooms.entries()) {
        const playerIndex = room.players.findIndex((p) => p.id === socket.id);
        if (playerIndex !== -1) {
          // Remove player from room
          room.players.splice(playerIndex, 1);

          // Notify remaining player if any
          if (room.players.length > 0) {
            socket.to(roomCode).emit("player_disconnected");
            console.log(
              `Player ${socket.id} disconnected from room ${roomCode}. ${room.players.length} players remaining.`
            );
          } else {
            // Room is empty - clean up immediately
            console.log(`Room ${roomCode} is now empty. Cleaning up...`);

            // Clean up GameSession if no rounds were played
            // This prevents database clutter from abandoned game sessions
            // where players joined but never actually played any rounds
            if (room.gameSessionId) {
              try {
                const gameSession = await GameSession.findById(
                  room.gameSessionId
                );
                if (gameSession && gameSession.totalRounds === 0) {
                  await GameSession.findByIdAndDelete(room.gameSessionId);
                  console.log(
                    `Deleted empty GameSession: ${room.gameSessionId}`
                  );
                }
              } catch (error) {
                console.error(
                  `Failed to cleanup GameSession ${room.gameSessionId}:`,
                  error
                );
              }
            }

            // Remove room
            gameRooms.delete(roomCode);
            console.log(`Cleaned up empty room: ${roomCode}`);
          }

          break;
        }
      }
    });
  },
};

/**
 * Clean up empty GameSession records from database
 * Run once on server start to clean existing empty records
 */
const cleanupEmptyGameSessions = async () => {
  try {
    const result = await GameSession.deleteMany({ totalRounds: 0 });
    if (result.deletedCount > 0) {
      console.log(
        `Cleaned up ${result.deletedCount} empty GameSession records on startup`
      );
    }
  } catch (error) {
    console.error("Failed to cleanup empty GameSessions on startup:", error);
  }
};

/**
 * Room Cleanup Service - Removes inactive rooms periodically
 * Simple cleanup for old rooms only
 */
const startRoomCleanup = () => {
  // Clean up existing empty records on startup
  cleanupEmptyGameSessions();

  setInterval(
    async () => {
      const now = new Date();
      for (const [roomCode, room] of gameRooms.entries()) {
        // Clean up rooms older than 30 minutes
        if (now - room.createdAt > 30 * 60 * 1000) {
          // Clean up GameSession if no rounds were played
          if (room.gameSessionId) {
            try {
              const gameSession = await GameSession.findById(
                room.gameSessionId
              );
              if (gameSession && gameSession.totalRounds === 0) {
                await GameSession.findByIdAndDelete(room.gameSessionId);
                console.log(`Deleted empty GameSession: ${room.gameSessionId}`);
              }
            } catch (error) {
              console.error(
                `Failed to cleanup GameSession ${room.gameSessionId}:`,
                error
              );
            }
          }

          gameRooms.delete(roomCode);
          console.log(`Cleaned up inactive room: ${roomCode}`);
        }
      }

      // Also clean up any empty GameSessions that might have been missed
      try {
        const result = await GameSession.deleteMany({ totalRounds: 0 });
        if (result.deletedCount > 0) {
          console.log(
            `Cleaned up ${result.deletedCount} empty GameSession records during periodic cleanup`
          );
        }
      } catch (error) {
        console.error(
          "Failed to cleanup empty GameSessions during periodic cleanup:",
          error
        );
      }
    },
    5 * 60 * 1000
  ); // Run cleanup every 5 minutes
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
