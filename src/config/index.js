require("dotenv").config();

const config = {
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGINS: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ],
};

module.exports = config;
