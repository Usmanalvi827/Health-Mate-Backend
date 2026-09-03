import express from "express";
import fileUploaderController from "../controllers/fileUpload.controller.js";
import upload from "../middleware/fileUpload.middleware.js";
const fileUploadRouter = express.Router();

fileUploadRouter.post(
  "/upload-medical-report",
  upload.single("medicalReport"),
  fileUploaderController,
);

export default fileUploadRouter;
