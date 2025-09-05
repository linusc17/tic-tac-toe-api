const BaseRoute = require("./_base.route");
const multer = require("multer");
const { auth } = require("../middleware/auth");
const {
  uploadAvatar,
  getAvatar,
  deleteAvatar,
} = require("../controllers/avatarController");

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

class AvatarRoute extends BaseRoute {
  load() {
    // Upload avatar (POST /api/avatar)
    this.app.post(
      "/api/avatar",
      auth,
      upload.single("avatar"),
      this.uploadAvatar.bind(this)
    );

    // Get avatar (GET /api/avatar/:fileId)
    this.app.get("/api/avatar/:fileId", this.getAvatar.bind(this));

    // Delete avatar (DELETE /api/avatar)
    this.app.delete("/api/avatar", auth, this.deleteAvatar.bind(this));
  }

  async uploadAvatar(req, res, next) {
    try {
      await uploadAvatar(req, res);
    } catch (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File too large. Maximum size is 5MB.",
          });
        }
      }
      next(error);
    }
  }

  async getAvatar(req, res, next) {
    try {
      await getAvatar(req, res);
    } catch (error) {
      next(error);
    }
  }

  async deleteAvatar(req, res, next) {
    try {
      await deleteAvatar(req, res);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AvatarRoute;
