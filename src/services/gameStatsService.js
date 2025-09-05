const User = require("../../models/User");
const GameSession = require("../../models/GameSession");
const mongoose = require("mongoose");

class GameStatsService {
  static async updateUserStats(gameSession, gameResult) {
    try {
      const { winner, board, moves } = gameResult;

      // Add game result to session
      gameSession.addGameResult(winner, board, moves);
      await gameSession.save();

      // Update user stats without transactions for development compatibility
      const promises = [];

      if (gameSession.player1Id) {
        const updateData = { $inc: { totalGames: 1 } };

        if (winner === "player1") {
          updateData.$inc.wins = 1;
        } else if (winner === "player2") {
          updateData.$inc.losses = 1;
        } else {
          updateData.$inc.draws = 1;
        }

        promises.push(
          User.findByIdAndUpdate(gameSession.player1Id, updateData, {
            new: true,
          })
        );
      }

      if (gameSession.player2Id) {
        const updateData = { $inc: { totalGames: 1 } };

        if (winner === "player2") {
          updateData.$inc.wins = 1;
        } else if (winner === "player1") {
          updateData.$inc.losses = 1;
        } else {
          updateData.$inc.draws = 1;
        }

        promises.push(
          User.findByIdAndUpdate(gameSession.player2Id, updateData, {
            new: true,
          })
        );
      }

      await Promise.all(promises);

      console.log(
        "User stats updated successfully for game session:",
        gameSession._id
      );
      return { success: true };
    } catch (error) {
      console.error("Error updating user stats:", error);
      throw new Error("Failed to update user statistics");
    }
  }

  static async getUserStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const recentGames = await GameSession.find({
        $or: [{ player1Id: userId }, { player2Id: userId }],
      })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate("player1Id player2Id", "username avatar");

      const headToHeadStats = await this.getHeadToHeadStats(userId);

      return {
        user: user.toPublicProfile(),
        recentGames: recentGames.map((game) => ({
          _id: game._id,
          opponent: this.getOpponentInfo(game, userId),
          result: this.getUserGameResult(game, userId),
          totalRounds: game.totalRounds,
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
        })),
        headToHeadStats,
      };
    } catch (error) {
      console.error("Error getting user stats:", error);
      throw error;
    }
  }

  static async getHeadToHeadStats(userId) {
    try {
      const pipeline = [
        {
          $match: {
            $or: [
              { player1Id: new mongoose.Types.ObjectId(userId) },
              { player2Id: new mongoose.Types.ObjectId(userId) },
            ],
            sessionType: { $in: ["authenticated", "mixed"] },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$player1Id", new mongoose.Types.ObjectId(userId)] },
                "$player2Id",
                "$player1Id",
              ],
            },
            wins: {
              $sum: {
                $cond: [
                  { $eq: ["$player1Id", new mongoose.Types.ObjectId(userId)] },
                  "$player1Wins",
                  "$player2Wins",
                ],
              },
            },
            losses: {
              $sum: {
                $cond: [
                  { $eq: ["$player1Id", new mongoose.Types.ObjectId(userId)] },
                  "$player2Wins",
                  "$player1Wins",
                ],
              },
            },
            draws: { $sum: "$draws" },
            totalGames: { $sum: "$totalRounds" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "opponent",
          },
        },
        {
          $unwind: "$opponent",
        },
        {
          $project: {
            opponent: {
              _id: "$opponent._id",
              username: "$opponent.username",
              avatar: "$opponent.avatar",
            },
            wins: 1,
            losses: 1,
            draws: 1,
            totalGames: 1,
            winRate: {
              $cond: [
                { $eq: ["$totalGames", 0] },
                0,
                { $multiply: [{ $divide: ["$wins", "$totalGames"] }, 100] },
              ],
            },
          },
        },
        { $sort: { totalGames: -1 } },
      ];

      const headToHeadStats = await GameSession.aggregate(pipeline);
      return headToHeadStats;
    } catch (error) {
      console.error("Error getting head-to-head stats:", error);
      return [];
    }
  }

  static getOpponentInfo(gameSession, userId) {
    if (
      gameSession.player1Id &&
      gameSession.player1Id.toString() === userId.toString()
    ) {
      return gameSession.player2Id
        ? {
            _id: gameSession.player2Id._id,
            username: gameSession.player2Id.username,
            avatar: gameSession.player2Id.avatar,
          }
        : { username: gameSession.player2Name, isGuest: true };
    } else {
      return gameSession.player1Id
        ? {
            _id: gameSession.player1Id._id,
            username: gameSession.player1Id.username,
            avatar: gameSession.player1Id.avatar,
          }
        : { username: gameSession.player1Name, isGuest: true };
    }
  }

  static getUserGameResult(gameSession, userId) {
    const isPlayer1 =
      gameSession.player1Id &&
      gameSession.player1Id.toString() === userId.toString();
    const userWins = isPlayer1
      ? gameSession.player1Wins
      : gameSession.player2Wins;
    const opponentWins = isPlayer1
      ? gameSession.player2Wins
      : gameSession.player1Wins;

    if (userWins > opponentWins) {
      return "win";
    } else if (opponentWins > userWins) {
      return "loss";
    } else {
      return "draw";
    }
  }

  static async getLeaderboard(options = {}) {
    try {
      const {
        sortBy = "wins",
        order = "desc",
        limit = 50,
        skip = 0,
        minGames = 0,
      } = options;

      const sortOrder = order === "desc" ? -1 : 1;
      const sortOptions = {};
      let rankSortBy = {};

      switch (sortBy) {
        case "totalGames":
          sortOptions.totalGames = sortOrder;
          rankSortBy = { totalGames: sortOrder };
          break;
        case "wins":
          sortOptions.wins = sortOrder;
          sortOptions.totalGames = -1; // Secondary sort by total games
          rankSortBy = { wins: sortOrder };
          break;
        case "winRate":
        default:
          // Competitive ranking: Win rate first, then activity, then absolute wins
          sortOptions.winRate = sortOrder;
          sortOptions.totalGames = -1; // Secondary: Activity/credibility
          sortOptions.wins = -1; // Tertiary: Absolute performance
          rankSortBy = { winRate: sortOrder };
          break;
      }

      const matchStage = {
        isActive: true,
        ...(minGames > 0 && { totalGames: { $gte: minGames } }),
      };

      const pipeline = [
        { $match: matchStage },
        {
          $addFields: {
            winRate: {
              $cond: [
                { $eq: ["$totalGames", 0] },
                0,
                { $multiply: [{ $divide: ["$wins", "$totalGames"] }, 100] },
              ],
            },
          },
        },
        { $sort: sortOptions },
        {
          $setWindowFields: {
            sortBy: rankSortBy,
            output: {
              rank: {
                $denseRank: {},
              },
              position: {
                $rowNumber: {},
              },
            },
          },
        },
        {
          $addFields: {
            rank: "$position",
          },
        },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            username: 1,
            wins: 1,
            losses: 1,
            draws: 1,
            totalGames: 1,
            winRate: { $round: ["$winRate", 1] },
            avatar: 1,
            bio: 1,
            createdAt: 1,
            rank: 1,
          },
        },
      ];

      const [leaderboard, totalUsers] = await Promise.all([
        User.aggregate(pipeline),
        User.countDocuments(matchStage),
      ]);

      return {
        leaderboard,
        pagination: {
          total: totalUsers,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalUsers / limit),
          hasNext: skip + limit < totalUsers,
          hasPrev: skip > 0,
        },
      };
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      throw error;
    }
  }

  static async getUserRank(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const betterUsers = await User.countDocuments({
        $or: [
          { wins: { $gt: user.wins } },
          {
            wins: user.wins,
            totalGames: { $gt: user.totalGames },
          },
        ],
        isActive: true,
      });

      return {
        rank: betterUsers + 1,
        user: user.toPublicProfile(),
      };
    } catch (error) {
      console.error("Error getting user rank:", error);
      throw error;
    }
  }
}

module.exports = GameStatsService;
