const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

let gfsBucket;

// Initialize GridFS bucket
const initGridFS = () => {
  if (mongoose.connection.readyState === 1) {
    gfsBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: "avatars",
    });
    console.log("GridFS initialized for avatars");
  } else {
    mongoose.connection.once("open", () => {
      gfsBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "avatars",
      });
      console.log("GridFS initialized for avatars");
    });
  }
};

// Get GridFS bucket
const getGridFSBucket = () => {
  if (!gfsBucket) {
    initGridFS();
  }
  return gfsBucket;
};

// Upload file to GridFS
const uploadToGridFS = (fileBuffer, filename, contentType, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return reject(new Error("GridFS not initialized"));
    }

    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        ...metadata,
        originalName: filename,
        uploadDate: new Date(),
      },
    });

    uploadStream.on("error", (error) => {
      reject(error);
    });

    uploadStream.on("finish", () => {
      resolve({
        _id: uploadStream.id,
        filename: filename,
        contentType: contentType,
        metadata: uploadStream.options.metadata,
      });
    });

    // Write buffer to stream
    uploadStream.end(fileBuffer);
  });
};

// Delete file from GridFS
const deleteFromGridFS = async (fileId) => {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error("GridFS not initialized");
  }

  try {
    await bucket.delete(new mongoose.Types.ObjectId(fileId));
    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Get file stream from GridFS
const getFileStream = (fileId) => {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error("GridFS not initialized");
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new Error("Invalid file ID format");
  }

  return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
};

// Find file by filename
const findFileByFilename = async (filename) => {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error("GridFS not initialized");
  }

  const files = await bucket.find({ filename }).toArray();
  return files.length > 0 ? files[0] : null;
};

// Find file by ID
const findFileById = async (fileId) => {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error("GridFS not initialized");
  }

  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return null;
    }

    const files = await bucket
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();

    return files.length > 0 ? files[0] : null;
  } catch (error) {
    console.error("Error finding file by ID:", error);
    return null;
  }
};

module.exports = {
  initGridFS,
  getGridFSBucket,
  uploadToGridFS,
  deleteFromGridFS,
  getFileStream,
  findFileByFilename,
  findFileById,
};
