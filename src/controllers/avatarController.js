const User = require("../../models/User");
const {
  uploadToGridFS,
  deleteFromGridFS,
  getFileStream,
  findFileById,
} = require("../services/gridfsService");

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user._id;
    const file = req.file;

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only images are allowed.",
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    }

    // Get user to check for existing avatar
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete existing avatar if exists
    if (user.avatarId) {
      try {
        await deleteFromGridFS(user.avatarId);
      } catch (error) {
        console.log("Failed to delete old avatar:", error.message);
        // Continue with upload even if delete fails
      }
    }

    // Generate unique filename
    const filename = `avatar_${userId}_${Date.now()}.${file.originalname.split(".").pop()}`;

    // Upload to GridFS
    const uploadedFile = await uploadToGridFS(
      file.buffer,
      filename,
      file.mimetype,
      {
        userId: userId,
        type: "avatar",
      }
    );

    // Update user with new avatar ID
    user.avatarId = uploadedFile._id;
    user.avatar = `/api/avatar/${uploadedFile._id}`; // URL to retrieve avatar
    await user.save();

    res.json({
      success: true,
      message: "Avatar uploaded successfully",
      data: {
        avatarId: uploadedFile._id,
        avatarUrl: user.avatar,
        user: user.toPublicProfile(),
      },
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during avatar upload",
    });
  }
};

const getAvatar = async (req, res) => {
  try {
    const { fileId } = req.params;

    // Find file metadata
    const file = await findFileById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Avatar not found",
      });
    }

    // Set appropriate headers
    res.set("Content-Type", file.metadata?.contentType || "image/jpeg");
    res.set("Content-Length", file.length);

    // Cache headers for better performance
    res.set("Cache-Control", "public, max-age=31536000"); // 1 year
    res.set("ETag", file._id.toString());

    // Stream the file
    const downloadStream = getFileStream(fileId);

    downloadStream.on("error", (error) => {
      console.error("Error streaming avatar:", error);
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          message: "Avatar not found",
        });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error("Get avatar error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Server error retrieving avatar",
      });
    }
  }
};

const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.avatarId) {
      return res.status(400).json({
        success: false,
        message: "No avatar to delete",
      });
    }

    // Delete from GridFS
    await deleteFromGridFS(user.avatarId);

    // Update user
    user.avatarId = null;
    user.avatar = null;
    await user.save();

    res.json({
      success: true,
      message: "Avatar deleted successfully",
      data: {
        user: user.toPublicProfile(),
      },
    });
  } catch (error) {
    console.error("Delete avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting avatar",
    });
  }
};

module.exports = {
  uploadAvatar,
  getAvatar,
  deleteAvatar,
};
