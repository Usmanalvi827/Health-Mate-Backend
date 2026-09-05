import multer from "multer";
import path from "path"; // <-- ADD THIS

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

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/pjpeg",
      "image/x-png",
      "application/pdf",
      "application/octet-stream" // Postman sometimes sends this, allow it then check extension
    ];

    const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();

    // FIX: Use OR logic, not AND. If extension is valid, allow it even if mimetype is weird
    const isMimeValid = allowedMimeTypes.includes(file.mimetype);
    const isExtValid = allowedExtensions.includes(ext);

    // console.log("isMimeValid:", isMimeValid, "isExtValid:", isExtValid);

    if (isExtValid) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Got mimetype: ${file.mimetype} and ext: ${ext}`));
    }
  },
});

// Middleware Wrapper Function to handle Multer errors gracefully
export const uploadSingleFile = (fieldName) => (req, res, next) => {
  const uploadHandler = upload.single(fieldName);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer specific errors (e.g. File size limit exceeded)
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      // Custom errors (e.g. Invalid file type)
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

export default upload;