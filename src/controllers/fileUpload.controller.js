import { reportQueue } from "../queues/queues.js";
import cloudinary from "../config/cloudinary.js";
import path from "path";
import mongoose from "mongoose";
import FamilyMember from "../models/familymember.models.js";

const recordTypes = [
  "Lab Report",
  "Prescription",
  "X-Ray",
  "CT Scan",
  "MRI",
  "Ultrasound",
  "Other",
];

function hasAllowedFileSignature(buffer, extension) {
  if (extension === ".pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (extension === ".png") {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

const uploadBufferToCloudinary = (buffer, folder, extension) => {
  return new Promise((resolve, reject) => {
    const isPdf = extension === ".pdf";

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: isPdf ? "raw" : "auto",
        type: "upload",
        access_mode: "public",
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
    const familyHead = req.user?._id || req.user?.id || req.user;
    if (!familyHead) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const { member, recordType = "Other", recordDate } = req.body;
    if (!member || !mongoose.isValidObjectId(member))
      return res
        .status(400)
        .json({ success: false, message: "A valid member id is required" });

    if (!recordTypes.includes(recordType)) {
      return res.status(400).json({ success: false, message: "Invalid recordType" });
    }

    const parsedRecordDate = recordDate ? new Date(recordDate) : new Date();
    if (Number.isNaN(parsedRecordDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid recordDate" });
    }

    const extension = path.extname(req.file.originalname).toLowerCase();
    const acceptedMimeTypes = {
      ".jpg": ["image/jpeg", "image/jpg", "image/pjpeg", "application/octet-stream"],
      ".jpeg": ["image/jpeg", "image/jpg", "image/pjpeg", "application/octet-stream"],
      ".png": ["image/png", "image/x-png", "application/octet-stream"],
      ".pdf": ["application/pdf", "application/octet-stream"],
    };
    if (
      !acceptedMimeTypes[extension]?.includes(req.file.mimetype) ||
      !hasAllowedFileSignature(req.file.buffer, extension)
    ) {
      return res.status(400).json({
        success: false,
        message: "File content does not match an allowed file type",
      });
    }

    const ownedMember = await FamilyMember.exists({ _id: member, familyHead });
    if (!ownedMember) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    // console.log("===>>>>>>>>>>>", req.file.buffer);
    // return

    const cloudResult = await uploadBufferToCloudinary(
      req.file.buffer,
      "medical-reports",
      extension,
    );
    let job;
    try {
      job = await reportQueue.add(
        "medicalReportQueue",
        {
          cloudinaryUrl: cloudResult.secure_url,
          publicId: cloudResult.public_id,
          originalname: path.basename(req.file.originalname).replace(/[\\/]/g, ""),
          fileType: req.file.mimetype,
          member,
          familyHead: String(familyHead),
          recordType,
          recordDate: parsedRecordDate,
        },
        {
          attempts: 1,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    } catch (queueError) {
      await cloudinary.uploader.destroy(cloudResult.public_id, {
        resource_type: extension === ".pdf" ? "raw" : "image",
      }).catch((cleanupError) => console.error("Cloudinary cleanup failed:", cleanupError.message));
      throw queueError;
    }

    return res.status(202).json({
      success: true,
      message: "Queued for processing.",
      jobId: job.id,
      status: "pending",
    });
  } catch (error) {
    console.error("Error ==>>>", error);
    return res.status(500).json({ success: false, message: "Unable to upload medical report" });
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

    const familyHead = req.user?._id || req.user?.id || req.user;
    if (!familyHead || String(job.data.familyHead) !== String(familyHead)) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const state = await job.getState();
    const result = job.returnvalue;
    const failedReason = state === "failed" ? job.failedReason : null;

    return res.json({
      success: true,
      jobId,
      state, // "completed", "failed", "delayed", "active", "waiting"
      result: result ? { recordId: result.recordId, status: result.status, type: result.type } : null,
      ...(failedReason && { error: "Report processing failed" }),
    });
  } catch (error) {
    console.error("Error fetching job status:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch processing status" });
  }
}
