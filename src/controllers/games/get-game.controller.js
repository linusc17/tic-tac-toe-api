const mongoose = require("mongoose");
const GameSession = require("../../../models/GameSession");

class GetGameController {
  static async execute(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Invalid game session ID");
      error.statusCode = 400;
      throw error;
    }

    const session = await GameSession.findById(id);

    if (!session) {
      const error = new Error("Game session not found");
      error.statusCode = 404;
      throw error;
    }

    return session;
  }
}

module.exports = GetGameController;
