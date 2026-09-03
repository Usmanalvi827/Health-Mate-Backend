import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "HealthMate/medical-reports", // folder name in cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "pdf"],
    resource_type: "auto",
  },
});

const upload = multer({ storage });
export default upload;