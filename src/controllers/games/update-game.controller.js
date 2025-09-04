const GameSession = require("../../../models/GameSession");

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

    const allowedUpdates = [
      "player1Wins",
      "player2Wins",
      "draws",
      "totalRounds",
    ];
    const updateData = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        updateData[key] = Math.max(0, Number(updates[key]) || 0);
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
