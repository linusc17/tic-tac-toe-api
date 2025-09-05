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
    player1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    player2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
    gameHistory: [
      {
        winner: {
          type: String,
          enum: ["player1", "player2", "draw"],
          required: true,
        },
        board: {
          type: [String],
          required: true,
        },
        moves: [
          {
            player: {
              type: String,
              enum: ["X", "O"],
              required: true,
            },
            position: {
              type: Number,
              required: true,
              min: 0,
              max: 8,
            },
            timestamp: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        completedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    sessionType: {
      type: String,
      enum: ["guest", "authenticated", "mixed"],
      default: "guest",
    },
  },
  {
    timestamps: true,
  }
);

gameSessionSchema.index({ createdAt: -1 });
gameSessionSchema.index({ player1Id: 1 });
gameSessionSchema.index({ player2Id: 1 });
gameSessionSchema.index({ isActive: 1 });
gameSessionSchema.index({ sessionType: 1 });

gameSessionSchema.methods.determineSessionType = function () {
  if (this.player1Id && this.player2Id) {
    this.sessionType = "authenticated";
  } else if (!this.player1Id && !this.player2Id) {
    this.sessionType = "guest";
  } else {
    this.sessionType = "mixed";
  }
};

gameSessionSchema.methods.addGameResult = function (winner, board, moves) {
  this.gameHistory.push({
    winner,
    board,
    moves,
    completedAt: new Date(),
  });

  if (winner === "player1") {
    this.player1Wins += 1;
  } else if (winner === "player2") {
    this.player2Wins += 1;
  } else {
    this.draws += 1;
  }

  this.totalRounds += 1;
};

gameSessionSchema.pre("save", function (next) {
  if (this.isModified("player1Id") || this.isModified("player2Id")) {
    this.determineSessionType();
  }
  next();
});

module.exports = mongoose.model("GameSession", gameSessionSchema);
