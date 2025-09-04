const GameSession = require("../../../models/GameSession");

class CreateGameController {
  static async execute(data) {
    const {
      player1Name,
      player2Name,
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

    const gameSession = new GameSession({
      player1Name: player1Name.trim(),
      player2Name: player2Name.trim(),
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
