import MedicalRecord from "../models/medicalReport.js";

async function fileUploaderController(req, res) {
  try {
    // console.log(req.file);
    // console.log(req.body); // will have member, recordType, recordDate

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const { member, recordType, recordDate } = req.body;

    if (!member) {
      return res
        .status(400)
        .json({ success: false, message: "member id is required" });
    }

    // Detect fileType for your enum
    const mimeType = req.file.mimetype; // e.g. image/png, application/pdf
    const fileType = mimeType.includes("pdf") ? "pdf" : "image";

    const newRecord = await MedicalRecord.create({
      member: member, // send memberId from frontend
      fileName: req.file.originalname,
      fileUrl: req.file.path, // Cloudinary URL
      cloudinaryPublicId: req.file.filename, // Cloudinary public_id
      fileType: fileType,
      recordType: recordType || "Other", // optional from frontend
      recordDate: recordDate || new Date(),
      aiStatus: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Medical record saved",
      data: newRecord,
    });
  } catch (error) {
    console.log("Error ==>>>", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default fileUploaderController;
