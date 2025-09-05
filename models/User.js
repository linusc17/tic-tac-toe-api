const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, underscores and hyphens",
      ],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    wins: {
      type: Number,
      default: 0,
      min: 0,
    },
    losses: {
      type: Number,
      default: 0,
      min: 0,
    },
    draws: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalGames: {
      type: Number,
      default: 0,
      min: 0,
    },
    avatar: {
      type: String,
      default: null,
    },
    avatarId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [200, "Bio cannot exceed 200 characters"],
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual("winRate").get(function () {
  if (this.totalGames === 0) return 0;
  return Math.round((this.wins / this.totalGames) * 100);
});

userSchema.virtual("rank").get(function () {
  return this._rank || null;
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre("save", function (next) {
  this.totalGames = this.wins + this.losses + this.draws;
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    wins: this.wins,
    losses: this.losses,
    draws: this.draws,
    totalGames: this.totalGames,
    winRate: this.winRate,
    avatar: this.avatar,
    bio: this.bio,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ wins: -1 });
userSchema.index({ winRate: -1 });
userSchema.index({ totalGames: -1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
