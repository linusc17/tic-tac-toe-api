const GameSession = require("../../../models/GameSession");
const GameStatsService = require("../../services/gameStatsService");

class UpdateGameController {
  static async execute(id, updates) {
    if (!id) {
      const error = new Error("Game session ID is required");
      error.statusCode = 400;
      throw error;
    }

    const gameSession = await GameSession.findById(id);
    if (!gameSession) {
      const error = new Error("Game session not found");
      error.statusCode = 404;
      throw error;
    }

    // Handle game result updates (when a game is completed)
    if (updates.gameResult) {
      const { winner, board, moves } = updates.gameResult;

      if (!winner || !board) {
        const error = new Error("Game result must include winner and board");
        error.statusCode = 400;
        throw error;
      }

      try {
        await GameStatsService.updateUserStats(gameSession, {
          winner,
          board,
          moves: moves || [],
        });

        return await GameSession.findById(id);
      } catch (error) {
        console.error("Error updating game stats:", error);
        throw error;
      }
    }

    // Handle regular session updates
    const allowedUpdates = [
      "player1Wins",
      "player2Wins",
      "draws",
      "totalRounds",
      "isActive",
    ];
    const updateData = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        if (key === "isActive") {
          updateData[key] = Boolean(updates[key]);
        } else {
          updateData[key] = Math.max(0, Number(updates[key]) || 0);
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      const error = new Error("No valid updates provided");
      error.statusCode = 400;
      throw error;
    }

    const updatedSession = await GameSession.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return updatedSession;
  }
}

module.exports = UpdateGameController;
