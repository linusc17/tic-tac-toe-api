const { validationResult } = require("express-validator");
const GameStatsService = require("../services/gameStatsService");

const getLeaderboard = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      sortBy = "wins",
      order = "desc",
      page = 1,
      limit = 50,
      minGames = 0,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const options = {
      sortBy,
      order,
      limit: parseInt(limit),
      skip,
      minGames: parseInt(minGames),
    };

    const result = await GameStatsService.getLeaderboard(options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching leaderboard",
    });
  }
};

const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const stats = await GameStatsService.getUserStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user statistics",
    });
  }
};

const getUserRank = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const rankData = await GameStatsService.getUserRank(userId);

    res.json({
      success: true,
      data: rankData,
    });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.error("Get user rank error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user rank",
    });
  }
};

const getMyStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const stats = await GameStatsService.getUserStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get my stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching your statistics",
    });
  }
};

const getMyRank = async (req, res) => {
  try {
    const userId = req.user._id;
    const rankData = await GameStatsService.getUserRank(userId);

    res.json({
      success: true,
      data: rankData,
    });
  } catch (error) {
    console.error("Get my rank error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching your rank",
    });
  }
};

module.exports = {
  getLeaderboard,
  getUserStats,
  getUserRank,
  getMyStats,
  getMyRank,
};
