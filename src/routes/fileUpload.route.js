import express from "express";
import { uploadSingleFile } from "../middleware/fileUpload.middleware.js";
import {
  fileUploaderController,
  getJobStatusController,
} from "../controllers/fileUpload.controller.js";
import authUser from "../middleware/auth.middleware.js";
const fileUploadRouter = express.Router();

fileUploadRouter.post(
  "/upload-medical-report",
  authUser,
  uploadSingleFile("medicalReport"),
  fileUploaderController,
);

fileUploadRouter.get("/medical-report/status/:jobId", authUser, getJobStatusController);

export default fileUploadRouter;
