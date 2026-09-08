import dotenv from "dotenv";
dotenv.config();
import { Worker } from "bullmq";
import MedicalRecord from "../models/medicalReport.js";
import redis from "../config/redis.db.js";
import connectDB from "../config/db.js";
import axios from "axios";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import path from "path";

await connectDB();
console.log("🚀 Worker DB Connected");

export const reportWorker = new Worker(
  "medicalReportQueue",
  async (job) => {
    const {
      cloudinaryUrl,
      publicId,
      originalname,
      fileType,
      member,
      recordType,
      recordDate,
    } = job.data;
    const ext = path.extname(originalname).toLowerCase();
    const isPdf = ext === ".pdf";
    const isImage =
      [".jpg", ".jpeg", ".png"].includes(ext) || fileType?.startsWith("image/");

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

    console.log(
      "====================>>> Text Extracting Worker ==>>",
      cloudinaryUrl,
    );
    try {
      if (isPdf) {
        console.log(`⬇ PDF hai, downloading...`);
        const response = await axios.get(cloudinaryUrl, {
          responseType: "arraybuffer",
          timeout: 30000,
        });

        const result = await pdfParse(response.data); // direct buffer
        console.log(`✅ Text parsed (${result.text.length} chars)`);

        newRecord.extractedText = result.text.trim();
        newRecord.aiStatus = "extracted";
        await newRecord.save();
      } else if (isImage) {
        console.log(`🖼 Image hai: ${originalname}, skip extraction.`);
        newRecord.extractedText = "";
        newRecord.aiStatus = "extracted"; //
        await newRecord.save();
      } else {
        throw new Error(`Unsupported file type: ${ext} / ${fileType}`);
      }

      return {
        recordId: newRecord._id,
        status: "ready",
        type: isPdf ? "pdf" : "image",
      };
    } catch (err) {
      console.error("❌ Extract Failed:", err.message);
      newRecord.aiStatus = "failed";
      newRecord.aiError = err.message;
      await newRecord.save();
      throw err;
    }
  },
  { connection: redis, concurrency: 3, limiter: { max: 10, duration: 10000 } },
);

reportWorker.on("failed", (job, err) =>
  console.error(`💥 Job ${job?.id} Failed: ${err.message}`),
);
reportWorker.on("completed", (job) =>
  console.log(`🎯 Job ${job.id} Completed`),
);
