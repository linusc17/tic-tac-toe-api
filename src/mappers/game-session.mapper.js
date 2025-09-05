"use strict";

class GameSessionMapper {
  constructor(params, total) {
    if (Array.isArray(params)) {
      return {
        data: params.map(
          (param) =>
            new GameSessionMapper(param.toObject ? param.toObject() : param)
        ),
        total: total || params.length,
      };
    }

    const data = params.toObject ? params.toObject() : params;

    this.id = data._id || data.id;
    this.player1Name = data.player1Name;
    this.player2Name = data.player2Name;
    this.player1Id = data.player1Id;
    this.player2Id = data.player2Id;
    this.player1Wins = data.player1Wins;
    this.player2Wins = data.player2Wins;
    this.draws = data.draws;
    this.totalRounds = data.totalRounds;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;

    return this.object();
  }

  object() {
    return {
      id: this.id,
      player1Name: this.player1Name,
      player2Name: this.player2Name,
      player1Id: this.player1Id,
      player2Id: this.player2Id,
      player1Wins: this.player1Wins,
      player2Wins: this.player2Wins,
      draws: this.draws,
      totalRounds: this.totalRounds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = GameSessionMapper;
