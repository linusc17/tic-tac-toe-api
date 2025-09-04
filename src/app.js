const express = require("express");
const config = require("./config");
const {
  connectDatabase,
  disconnectDatabase,
} = require("./database/connection");
const setupMiddleware = require("./middleware");
const setupRoutes = require("./routes");
const { errorHandler, notFoundHandler } = require("./errors");

const createApp = () => {
  const app = express();
  setupMiddleware(app);
  setupRoutes(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const startServer = async () => {
  try {
    await connectDatabase(config.MONGODB_URI);
    const app = createApp();

    app.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
      console.log(`API available at: http://localhost:${config.PORT}`);
      console.log(`Health check: http://localhost:${config.PORT}`);
      console.log(`Games API: http://localhost:${config.PORT}/api/games`);
      console.log(`Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT, shutting down gracefully...");

  try {
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

module.exports = { createApp, startServer };
