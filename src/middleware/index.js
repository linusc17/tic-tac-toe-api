const express = require("express");
const cors = require("cors");
const config = require("../config");

const setupMiddleware = (app) => {
  app.use(
    cors({
      origin: config.CORS_ORIGINS,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
};

module.exports = setupMiddleware;
