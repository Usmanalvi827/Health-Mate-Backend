import dotenv from "dotenv";
dotenv.config();

import { Worker } from "bullmq";
import MedicalRecord from "../models/medicalReport.js";
import redis from "../config/redis.db.js";
import connectDB from "../config/db.js";

await connectDB();
console.log("🚀 Worker DB Connected");

export const reportWorker = new Worker(
  "medicalReportQueue", // <-- IMPORTANT: Ye naam queues.js wale se same hona chahiye
  async (job) => {
    // Ab job.data mein sirf halki phulki cheezen hain, poora buffer nahi
    const {
      cloudinaryUrl,
      publicId,
      originalname,
      fileType,
      member,
      recordType,
      recordDate,
    } = job.data;

    // console.log(`📦 Job ${job.id} | Member: ${member} | File: ${originalname}`);


    // 1. DB save
    const newRecord = await MedicalRecord.create({
      member,
      fileName: originalname,
      fileUrl: cloudinaryUrl,
      cloudinaryPublicId: publicId,
      fileType,
      recordType,
      recordDate,
      aiStatus: "pending",
    });

    // 2. (Next Step) Yahan se tu AI wali queue ko trigger karega
    // await aiQueue.add("extract-text", { recordId: newRecord._id, url: cloudinaryUrl })

    // console.log(`✅ DB Saved: ${newRecord._id}`);
    return { recordId: newRecord._id, url: cloudinaryUrl };
  },
  {
    connection: redis,
    concurrency: 3, // Shuru mein 3 rakho, server khush rahega
    limiter: { max: 10, duration: 10000 }, // 10 sec mein max 10 jobs, Cloudinary ko DDOS nahi karna
  }
);

// reportWorker.on("completed", (job) => {
//   console.log(`🎯 Job ${job.id} Done`);
// });

reportWorker.on("failed", (job, err) => {
  console.error(`💥 Job ${job?.id} Failed: ${err.message}`);
  // Yahan tu Cloudinary se file delete bhi kar sakta hai agar DB save fail ho jaye
});

console.log("👷 Worker listening...");