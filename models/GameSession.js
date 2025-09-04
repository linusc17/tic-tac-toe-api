const mongoose = require("mongoose");

const gameSessionSchema = new mongoose.Schema(
  {
    player1Name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    player2Name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    player1Wins: {
      type: Number,
      default: 0,
      min: 0,
    },
    player2Wins: {
      type: Number,
      default: 0,
      min: 0,
    },
    draws: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRounds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

gameSessionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("GameSession", gameSessionSchema);
