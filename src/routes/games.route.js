const BaseRoute = require("./_base.route");

const GameSessionMapper = require("../mappers/game-session.mapper");
const GameSessionValidator = require("../validations/game-session.validation");
const gameController = require("../controllers/games");
const { optionalAuth } = require("../middleware/auth");
const {
  validateCreateGame,
  validateUpdateGame,
  validateGetGame,
  validateListGames,
} = require("../middleware/validation");

class Games extends BaseRoute {
  load() {
    this.app.get("/api/games", validateListGames, this.listGames.bind(this));
    this.app.post(
      "/api/games",
      optionalAuth,
      validateCreateGame,
      this.createGame.bind(this)
    );
    this.app.get("/api/games/:id", validateGetGame, this.getGame.bind(this));
    this.app.put(
      "/api/games/:id",
      optionalAuth,
      validateUpdateGame,
      this.updateGame.bind(this)
    );
  }

  async listGames(req, res, next) {
    try {
      const result = await gameController.ListGames.execute(req.query);
      res.json({
        data: new GameSessionMapper(result.sessions, result.sessions.length),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async createGame(req, res, next) {
    try {
      const gameSession = await gameController.CreateGame.execute(
        req.body,
        req.user
      );
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

  async updateGame(req, res, next) {
    try {
      const { id } = req.params;
      const gameSession = await gameController.UpdateGame.execute(
        id,
        req.body,
        req.user
      );
      res.json(new GameSessionMapper(gameSession));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = Games;
