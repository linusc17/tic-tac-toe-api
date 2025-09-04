const BaseRoute = require("./_base.route");

const GameSessionMapper = require("../mappers/game-session.mapper");
const GameSessionValidator = require("../validations/game-session.validation");
const gameController = require("../controllers/games");

class Games extends BaseRoute {
  load() {
    this.app.get("/api/games", this.listGames.bind(this));
    this.app.post("/api/games", this.createGame.bind(this));
    this.app.get("/api/games/:id", this.getGame.bind(this));
  }

  async listGames(req, res, next) {
    try {
      const result = await gameController.ListGames.execute(req.query);
      res.json(new GameSessionMapper(result.sessions, result.sessions.length));
    } catch (error) {
      next(error);
    }
  }

  async createGame(req, res, next) {
    try {
      GameSessionValidator.validate("create", req.body);
      const gameSession = await gameController.CreateGame.execute(req.body);
      res.status(201).json(new GameSessionMapper(gameSession));
    } catch (error) {
      next(error);
    }
  }

  async getGame(req, res, next) {
    try {
      const { id } = req.params;
      const gameSession = await gameController.GetGame.execute(id);
      res.json(new GameSessionMapper(gameSession));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = Games;
