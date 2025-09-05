const Games = require("./games.route");
const Auth = require("./auth.route");
const Leaderboard = require("./leaderboard.route");
const Avatar = require("./avatar.route");

const setupRoutes = (app) => {
  // Health check route
  app.get("/", (req, res) => {
    res.json({
      message: "Tic Tac Toe API Server",
      status: "running",
      timestamp: new Date().toISOString(),
    });
  });

  // Load authentication routes
  const authRoute = new Auth(app);
  authRoute.load();

  // Load leaderboard routes
  const leaderboardRoute = new Leaderboard(app);
  leaderboardRoute.load();

  // Load avatar routes
  const avatarRoute = new Avatar(app);
  avatarRoute.load();

  // Load game routes
  const gamesRoute = new Games(app);
  gamesRoute.load();
};

module.exports = setupRoutes;
