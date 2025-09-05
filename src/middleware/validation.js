const { body, param, query, validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed");
    error.statusCode = 400;
    error.data = errors.array();
    return next(error);
  }
  next();
};

const validateCreateGame = [
  body("player1Name")
    .trim()
    .notEmpty()
    .withMessage("Player 1 name is required")
    .isLength({ max: 50 })
    .withMessage("Player 1 name must be less than 50 characters"),
  body("player2Name")
    .trim()
    .notEmpty()
    .withMessage("Player 2 name is required")
    .isLength({ max: 50 })
    .withMessage("Player 2 name must be less than 50 characters")
    .custom((value, { req }) => {
      if (
        value.trim().toLowerCase() ===
        req.body.player1Name?.trim().toLowerCase()
      ) {
        throw new Error("Player names must be different");
      }
      return true;
    }),
  body("player1Wins")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Player 1 wins must be a non-negative integer"),
  body("player2Wins")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Player 2 wins must be a non-negative integer"),
  body("draws")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Draws must be a non-negative integer"),
  body("totalRounds")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Total rounds must be a non-negative integer"),
  handleValidationErrors,
];

const validateUpdateGame = [
  param("id").isMongoId().withMessage("Invalid game ID format"),
  body("player1Wins")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Player 1 wins must be a non-negative integer"),
  body("player2Wins")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Player 2 wins must be a non-negative integer"),
  body("draws")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Draws must be a non-negative integer"),
  body("totalRounds")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Total rounds must be a non-negative integer"),
  handleValidationErrors,
];

const validateGetGame = [
  param("id").isMongoId().withMessage("Invalid game ID format"),
  handleValidationErrors,
];

const validateListGames = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("sessionType")
    .optional()
    .isIn(["guest", "authenticated", "mixed"])
    .withMessage("Session type must be one of: guest, authenticated, mixed"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  handleValidationErrors,
];

module.exports = {
  validateCreateGame,
  validateUpdateGame,
  validateGetGame,
  validateListGames,
  handleValidationErrors,
};
