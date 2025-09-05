const BaseRoute = require("./_base.route");
const leaderboardController = require("../controllers/leaderboard.controller");
const { auth, optionalAuth } = require("../middleware/auth");
const {
  leaderboardValidation,
  userIdValidation,
} = require("../validations/leaderboard.validation");

class LeaderboardRoute extends BaseRoute {
  constructor(app) {
    super(app);
  }

  load() {
    // Public routes
    this.app.get(
      "/api/leaderboard",
      leaderboardValidation,
      leaderboardController.getLeaderboard
    );

    this.app.get(
      "/api/leaderboard/user/:userId/stats",
      userIdValidation,
      leaderboardController.getUserStats
    );

    this.app.get(
      "/api/leaderboard/user/:userId/rank",
      userIdValidation,
      leaderboardController.getUserRank
    );

    // Protected routes
    this.app.get(
      "/api/leaderboard/my/stats",
      auth,
      leaderboardController.getMyStats
    );

    this.app.get(
      "/api/leaderboard/my/rank",
      auth,
      leaderboardController.getMyRank
    );
  }
}

module.exports = LeaderboardRoute;
