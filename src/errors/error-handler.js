const errorHandler = (err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details || undefined,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Invalid data",
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
};

module.exports = errorHandler;