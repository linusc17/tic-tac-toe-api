const GameSession = require("../../../models/GameSession");

class ListGamesController {
  static async execute(query) {
    const sessions = await GameSession.find().sort({ createdAt: -1 }).limit(50);
    return { sessions };
  }
}

module.exports = ListGamesController;
