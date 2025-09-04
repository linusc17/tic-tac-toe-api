const mongoose = require("mongoose");

const connectDatabase = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully");
    console.log(`Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  } catch (error) {
    console.error("Error closing MongoDB connection:", error);
    throw error;
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase
};