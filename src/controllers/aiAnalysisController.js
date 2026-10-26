  import AIAnalysis, { calculateAnalysisStatus } from "../models/aIAnalysis.model.js";
  import MedicalRecord from "../models/medicalReport.js";
  import { reportAiGenerate } from "../services/reportAi.service.js";
  import path from "path";
  import mongoose from "mongoose";

  function getSupportedMimeType(record) {
    const fileType = record.fileType?.toLowerCase();
    if (["application/pdf", "image/png", "image/jpeg"].includes(fileType)) {
      return fileType;
    }

    const ext = path.extname(record.fileName || record.fileUrl).toLowerCase();
    if (ext === ".pdf") return "application/pdf";
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    return null;
  }

  async function aiAnalysisController(req, res) {
    try {
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: "Invalid medical record id" });
      }

      // Match the record through a member owned by the authenticated Family Head.
      const record = await MedicalRecord.findById(id).populate({
        path: "member",
        match: { familyHead: req.user },
        select: "_id",
      });
      if (!record || !record.member) {
        return res.status(404).json({ success: false, message: "Medical record not found" });
      }

      if (["pending", "extracting"].includes(record.aiStatus)) {
        return res.status(409).json({ success: false, message: "Report processing is not complete" });
      }

      let aiAnalysisResult;
      if (record.extractedText?.trim()) {
        aiAnalysisResult = await reportAiGenerate({ fileText: record.extractedText });
      } else if (record.fileUrl) {
        const determinedMime = getSupportedMimeType(record);
        if (!determinedMime) {
          return res.status(415).json({ success: false, message: "Unsupported report file type" });
        }
        aiAnalysisResult = await reportAiGenerate({
          fileUrl: record.fileUrl,
          mimeType: determinedMime,
        });
      } else {
        return res.status(400).json({ success: false, message: "No text or file data found to analyze." });
      }

      const analysisData = {
        reportType: aiAnalysisResult.reportType,
        summary: aiAnalysisResult.summary,
        findings: aiAnalysisResult.findings,
        observations: aiAnalysisResult.observations,
        doctorDiscussionPoints: aiAnalysisResult.doctorDiscussionPoints,
      };
      const status = calculateAnalysisStatus(analysisData);
      let analysis;
      try {
        analysis = await AIAnalysis.findOneAndUpdate(
          { medicalRecord: record._id },
          { $set: { ...analysisData, status }, $setOnInsert: { medicalRecord: record._id } },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        );
      } catch (error) {
        // A concurrent upsert can race on the unique medicalRecord index.
        if (error.code !== 11000) throw error;
        analysis = await AIAnalysis.findOneAndUpdate(
          { medicalRecord: record._id },
          { $set: { ...analysisData, status } },
          { new: true, runValidators: true },
        );
      }

      await MedicalRecord.updateOne({ _id: record._id }, { $set: { aiStatus: "done" } });

      return res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (error) {
    console.error("AI analysis failed:", {
      name: error.name,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    if (error.code === "AI_CONFIG_MISSING") {
      return res.status(503).json({
        success: false,
        message: "AI analysis is not configured on the server",
      });
    }
    if (error.code === "AI_INVALID_OUTPUT") {
      return res.status(502).json({
        success: false,
        message: "The AI provider returned an invalid analysis. Please retry.",
      });
    }
      return res.status(500).json({
        success: false,
      message: "AI analysis failed. Check the backend log for the request error.",
      });
    }
  }

  export { aiAnalysisController };
