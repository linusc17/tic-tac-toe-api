const GameSession = require("../../../models/GameSession");

class ListGamesController {
  static async execute(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = {};
    if (
      query.sessionType &&
      ["guest", "authenticated", "mixed"].includes(query.sessionType)
    ) {
      filter.sessionType = query.sessionType;
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === "true";
    }

    const [sessions, total] = await Promise.all([
      GameSession.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("player1Id", "username avatar")
        .populate("player2Id", "username avatar"),
      GameSession.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null,
      },
    };
  }
}

module.exports = ListGamesController;
