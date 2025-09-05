const GameSession = require("../../../models/GameSession");
const User = require("../../../models/User");

class CreateGameController {
  static async execute(data, user = null) {
    const {
      player1Name,
      player2Name,
      player1Id,
      player2Id,
      player1Wins,
      player2Wins,
      draws,
      totalRounds,
    } = data;

    if (!player1Name || !player2Name) {
      const error = new Error("Player names are required");
      error.statusCode = 400;
      throw error;
    }

    if (player1Name.trim() === player2Name.trim()) {
      const error = new Error("Player names must be different");
      error.statusCode = 400;
      throw error;
    }

    // Validate user IDs if provided
    if (player1Id) {
      const player1 = await User.findById(player1Id);
      if (!player1) {
        const error = new Error("Player 1 not found");
        error.statusCode = 400;
        throw error;
      }
    }

    if (player2Id) {
      const player2 = await User.findById(player2Id);
      if (!player2) {
        const error = new Error("Player 2 not found");
        error.statusCode = 400;
        throw error;
      }
    }

    const gameSession = new GameSession({
      player1Name: player1Name.trim(),
      player2Name: player2Name.trim(),
      player1Id: player1Id || null,
      player2Id: player2Id || null,
      player1Wins: player1Wins || 0,
      player2Wins: player2Wins || 0,
      draws: draws || 0,
      totalRounds: totalRounds || 0,
    });

    const savedSession = await gameSession.save();
    return savedSession;
  }
}

module.exports = CreateGameController;
