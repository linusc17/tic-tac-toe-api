"use strict";

class GameSessionValidator {
  static validate(type, data) {
    switch (type) {
      case "create":
        return this.validateCreate(data);
      default:
        throw new Error(`Unknown validation type: ${type}`);
    }
  }

  static validateCreate(data) {
    const errors = [];

    if (!data.player1Name || typeof data.player1Name !== "string") {
      errors.push("player1Name is required and must be a string");
    } else if (data.player1Name.trim().length === 0) {
      errors.push("player1Name cannot be empty");
    } else if (data.player1Name.length > 50) {
      errors.push("player1Name must be 50 characters or less");
    }

    if (!data.player2Name || typeof data.player2Name !== "string") {
      errors.push("player2Name is required and must be a string");
    } else if (data.player2Name.trim().length === 0) {
      errors.push("player2Name cannot be empty");
    } else if (data.player2Name.length > 50) {
      errors.push("player2Name must be 50 characters or less");
    }

    if (
      data.player1Name &&
      data.player2Name &&
      data.player1Name.trim() === data.player2Name.trim()
    ) {
      errors.push("Player names must be different");
    }

    if (
      data.player1Wins !== undefined &&
      (typeof data.player1Wins !== "number" || data.player1Wins < 0)
    ) {
      errors.push("player1Wins must be a non-negative number");
    }

    if (
      data.player2Wins !== undefined &&
      (typeof data.player2Wins !== "number" || data.player2Wins < 0)
    ) {
      errors.push("player2Wins must be a non-negative number");
    }

    if (
      data.draws !== undefined &&
      (typeof data.draws !== "number" || data.draws < 0)
    ) {
      errors.push("draws must be a non-negative number");
    }

    if (
      data.totalRounds !== undefined &&
      (typeof data.totalRounds !== "number" || data.totalRounds < 0)
    ) {
      errors.push("totalRounds must be a non-negative number");
    }

    if (errors.length > 0) {
      const error = new Error("Validation failed");
      error.statusCode = 400;
      error.details = errors;
      throw error;
    }

    return true;
  }
}

module.exports = GameSessionValidator;
