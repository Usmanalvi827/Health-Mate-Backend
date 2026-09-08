import { reportQueue } from "../queues/queues.js";
import cloudinary from "../config/cloudinary.js";

const uploadBufferToCloudinary = (buffer, folder, mimetype) => {
  return new Promise((resolve, reject) => {
    const isPdf =
      mimetype === "application/pdf" || mimetype === "application/octet-stream";

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: isPdf ? "raw" : "auto",
        type: "upload",
        access_mode: "public", // 401 fix
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
};

export async function fileUploaderController(req, res) {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    const { member, recordType, recordDate } = req.body;
    if (!member)
      return res
        .status(400)
        .json({ success: false, message: "member id is required" });

    // console.log("===>>>>>>>>>>>", req.file.buffer);
    // return

    const cloudResult = await uploadBufferToCloudinary(
      req.file.buffer,
      "medical-reports",
      req.file.mimetype,
    );
    console.log("Cloudinary Upload Result:", cloudResult.secure_url);

    const job = await reportQueue.add(
      "medicalReportQueue",
      {
        cloudinaryUrl: cloudResult.secure_url,
        publicId: cloudResult.public_id,
        originalname: req.file.originalname,
        fileType: req.file.mimetype,
        member,
        recordType: recordType || "Other",
        recordDate: recordDate || new Date(),
      },
      {
        attempts: 1,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return res.status(202).json({
      success: true,
      message: "Queued for processing.",
      jobId: job.id,
      url: cloudResult.secure_url,
      status: "pending",
    });
  } catch (error) {
    console.error("Error ==>>>", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getJobStatusController(req, res) {
  try {
    const { jobId } = req.params;
    const job = await reportQueue.getJob(jobId);

    // 1. Move the null check BEFORE accessing any properties on 'job'
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Safe to log now
    console.log("Job data:", job.data);

    const state = await job.getState();
    console.log("Job state:", state);

    // In BullMQ, returnvalue holds the result, but you can also check failed reasons
    const result = job.returnvalue;
    const failedReason = state === "failed" ? job.failedReason : null;

    return res.json({
      success: true,
      jobId,
      state, // "completed", "failed", "delayed", "active", "waiting"
      result: result || null,
      ...(failedReason && { error: failedReason }), // Dynamically adds error message if failed
    });
  } catch (error) {
    console.error("Error fetching job status:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
