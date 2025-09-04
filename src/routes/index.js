const Games = require("./games.route");

const setupRoutes = (app) => {
  // Health check route
  app.get("/", (req, res) => {
    res.json({
      message: "Tic Tac Toe API Server",
      status: "running",
      timestamp: new Date().toISOString(),
    });
  });

  // Load game routes
  const gamesRoute = new Games(app);
  gamesRoute.load();
};

module.exports = setupRoutes;