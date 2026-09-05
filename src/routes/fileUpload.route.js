import express from "express";
import { uploadSingleFile } from "../middleware/fileUpload.middleware.js";
import {
  fileUploaderController,
  getJobStatusController,
} from "../controllers/fileUpload.controller.js";
const fileUploadRouter = express.Router();

// fieldName "medicalReport" Postman key name se EXACT match hona chahiye
fileUploadRouter.post(
  "/upload-medical-report",
  uploadSingleFile("medicalReport"),
  fileUploaderController,
);

// 2. YE WALA ROUTE ADD KARO - status check ke liye
fileUploadRouter.get("/medical-report/status/:jobId", getJobStatusController);

export default fileUploadRouter;
