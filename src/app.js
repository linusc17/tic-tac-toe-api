const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const config = require("./config");
const {
  connectDatabase,
  disconnectDatabase,
} = require("./database/connection");
const setupMiddleware = require("./middleware");
const setupRoutes = require("./routes");
const { errorHandler, notFoundHandler } = require("./errors");
const { initializeSocketHandlers } = require("./services/socketService");

const createApp = () => {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: config.CORS_ORIGINS,
      methods: ["GET", "POST", "PUT"],
      credentials: true,
    },
  });

  setupMiddleware(app);
  setupRoutes(app);
  initializeSocketHandlers(io);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, server, io };
};

const startServer = async () => {
  try {
    await connectDatabase(config.MONGODB_URI);
    const { server } = createApp();

    server.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
      console.log(`API available at: http://localhost:${config.PORT}`);
      console.log(`Health check: http://localhost:${config.PORT}`);
      console.log(`Games API: http://localhost:${config.PORT}/api/games`);
      console.log(`WebSocket available for real-time multiplayer`);
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
