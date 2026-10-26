import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // console.log("--- DEBUG ---");
    // console.log("originalname:", file.originalname);
    // console.log("mimetype:", file.mimetype);
    // console.log("ext:", path.extname(file.originalname).toLowerCase());

    const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, PNG, and PDF files are allowed."));
    }
  },
});

// Middleware Wrapper Function to handle Multer errors gracefully
export const uploadSingleFile = (fieldName) => (req, res, next) => {
  const uploadHandler = upload.single(fieldName);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer specific errors (e.g. File size limit exceeded)
      const message = err.code === "LIMIT_FILE_SIZE"
        ? "File exceeds the 10 MB upload limit."
        : `Upload error: ${err.message}`;
      return res.status(400).json({ success: false, message });
    } else if (err) {
      // Custom errors (e.g. Invalid file type)
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

export default upload;
