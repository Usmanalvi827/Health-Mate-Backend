import mongoose from "mongoose";

const medicalRecordSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "familymembers",
      required: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    fileUrl: {
      type: String,
      required: true,
    },

    cloudinaryPublicId: {
      type: String,
      required: true,
    },

    fileType: {
      type: String,
      required: true,
      enum: ["pdf", "image"],
    },

    recordType: {
      type: String,
      enum: [
        "Lab Report",
        "Prescription",
        "X-Ray",
        "CT Scan",
        "MRI",
        "Ultrasound",
        "Other",
      ],
      default: "Other",
    },

    recordDate: {
      type: Date,
    },

    aiStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const MedicalRecord = mongoose.model(
  "MedicalRecord",
  medicalRecordSchema
);

export default MedicalRecord;