import dotenv from "dotenv";
dotenv.config();
import { Worker } from "bullmq";
import MedicalRecord from "../models/medicalReport.js";
import FamilyMember from "../models/familymember.models.js";
import redis from "../config/redis.db.js";
import connectDB from "../config/db.js";
import axios from "axios";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import path from "path";
import { createWorker } from "tesseract.js";

await connectDB();
console.log("🚀 Worker DB Connected");

async function downloadBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: 15 * 1024 * 1024,
    maxBodyLength: 15 * 1024 * 1024,
  });
  return Buffer.from(response.data);
}

export const reportWorker = new Worker(
  "medicalReportQueue",
  async (job) => {
    const {
      cloudinaryUrl,
      publicId,
      originalname,
      fileType,
      member,
      familyHead,
      recordType,
      recordDate,
    } = job.data;

    const ext = path.extname(originalname).toLowerCase();
    const isPdf = ext === ".pdf";
    const isImage = [".jpg", ".jpeg", ".png"].includes(ext) || fileType?.startsWith("image/");

    const ownedMember = await FamilyMember.exists({ _id: member, familyHead });
    if (!ownedMember) {
      throw new Error("The selected family member was not found for this account");
    }

    const newRecord = await MedicalRecord.create({
      member,
      fileName: originalname,
      fileUrl: cloudinaryUrl,
      cloudinaryPublicId: publicId,
      fileType,
      recordType,
      recordDate,
      aiStatus: "extracting",
    });

    try {
      const buffer = await downloadBuffer(cloudinaryUrl);
      let text = "";

      if (isPdf) {
        const result = await pdfParse(buffer);
        text = result.text.trim();
      } else if (isImage) {
        // OCR for images
        const worker = await createWorker('eng');
        const { data: { text: ocrText } } = await worker.recognize(buffer);
        await worker.terminate();
        text = ocrText.trim();
      } else {
        throw new Error(`Unsupported file type: ${ext} / ${fileType}`);
      }

      // If still empty, don't mark as extracted - keep it usable for Vision API later
      if (!text) {
        text = ""; // keep empty, but we will still allow Vision fallback in aiAnalysisController
      }

      newRecord.extractedText = text;
      newRecord.aiStatus = "extracted";
      await newRecord.save();

      return {
        recordId: newRecord._id,
        status: "ready",
        type: isPdf ? "pdf" : "image",
      };
    } catch (err) {
      console.error("Extraction error:", err.message);
      newRecord.aiStatus = "failed";
      newRecord.aiError = err.message.slice(0, 500);
      await newRecord.save();
      throw err;
    }
  },
  { connection: redis, concurrency: 3, limiter: { max: 10, duration: 10000 } },
);

reportWorker.on("failed", (job, err) => console.error(`💥 Job ${job?.id} Failed: ${err.message}`));
reportWorker.on("completed", (job) => console.log(`🎯 Job ${job.id} Completed`));
reportWorker.on("error", (err) => console.error("Report worker error:", err.message));