import { reportQueue } from "../queues/queues.js";
import cloudinary from "../config/cloudinary.js"; 

const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: "auto" }, // auto = image bhi, pdf bhi
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer); // balti ko cloudinary ki taraf ulta diya
  });
};

export async function fileUploaderController(req, res) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    // console.log("File aayi:", {
    //   name: req.file.originalname,
    //   sizeKB: (req.file.size / 1024).toFixed(2),
    // });

    const { member, recordType, recordDate } = req.body;
    if (!member) {
      return res
        .status(400)
        .json({ success: false, message: "member id is required" });
    }

    const cloudResult = await uploadBufferToCloudinary(
      req.file.buffer,
      "medical-reports",
    );

    const job = await reportQueue.add(
      "process-medical-report",
      {
        cloudinaryUrl: cloudResult.secure_url,
        publicId: cloudResult.public_id,
        originalname: req.file.originalname,
        fileType: cloudResult.resource_type, // image / raw / pdf
        member,
        recordType: recordType || "Other",
        recordDate: recordDate || new Date(),
      },
      {
        attempts: 4,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100, 
        removeOnFail: 50,
      },
    );

    return res.status(202).json({
      success: true,
      message: "Medical record queued for processing",
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
    // console.log("Checking status for jobId:", jobId);
    const job = await reportQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const state = await job.getState();
    const result = job.returnvalue;

    return res.json({
      success: true,
      jobId,
      state, // "completed", "failed", "delayed", "active", "waiting"
      result: result || null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
