const { query, param } = require("express-validator");

const leaderboardValidation = [
  query("sortBy")
    .optional()
    .isIn(["wins", "winRate", "totalGames"])
    .withMessage("sortBy must be one of: wins, winRate, totalGames"),

  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("order must be either asc or desc"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),

  query("minGames")
    .optional()
    .isInt({ min: 0 })
    .withMessage("minGames must be a non-negative integer"),
];

const userIdValidation = [
  param("userId").isMongoId().withMessage("Invalid user ID format"),
];

module.exports = {
  leaderboardValidation,
  userIdValidation,
};
