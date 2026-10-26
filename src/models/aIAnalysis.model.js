import mongoose from "mongoose";

const aiAnalysisSchema = new mongoose.Schema(
  {
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
      unique: true,
    },

    reportType: {
      type: String,
      trim: true,
      default: "",
    },

    summary: {
      english: { type: String, trim: true, default: "" },
      romanUrdu: { type: String, trim: true, default: "" },
    },

    findings: [
      {
        name: { type: String, trim: true },
        value: { type: String, trim: true },
        unit: { type: String, trim: true },
        status: {
          type: String,
          enum: ["normal", "high", "low", "abnormal", "unknown"],
          default: "unknown",
        },
        explanation: { type: String, trim: true },
      },
    ],

    observations: {
      type: [String],
      default: [],
    },

    doctorDiscussionPoints: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["draft", "in-progress", "completed"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

// --- PitchCraft Automation Engine applied on fields inside the same collection ---
const SECTION_CHECKS = {
  reportType: (doc) => !!doc?.reportType,
  englishSummary: (doc) => !!doc?.summary?.english,
  romanUrduSummary: (doc) => !!doc?.summary?.romanUrdu,
  findings: (doc) => Array.isArray(doc?.findings),
};

export function calculateAnalysisStatus(analysisDoc) {
  const completed = Object.entries(SECTION_CHECKS).filter(([key, isGenerated]) =>
    isGenerated(analysisDoc)
  ).length;

  if (completed === Object.keys(SECTION_CHECKS).length) return "completed";
  if (completed > 0) return "in-progress";
  return "draft";
}

const AIAnalysis = mongoose.model("AIAnalysis", aiAnalysisSchema);
export default AIAnalysis;
