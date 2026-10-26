import { z } from "zod";
import { generateWithGemini } from "./ai.services.js";
import { buildMedicalAnalysisPrompt } from "../prompt/ai.prompt.js";

const findingSchema = z.object({
  name: z.string().trim().min(1).max(160),
  value: z.string().trim().max(120),
  unit: z.string().trim().max(40),
  status: z.enum(["normal", "high", "low", "abnormal", "unknown"]),
  explanation: z.string().trim().max(1000),
});

const medicalAnalysisSchema = z.object({
  reportType: z.string().trim().min(1).max(160),
  summary: z.object({
    english: z.string().trim().min(1).max(3000),
    romanUrdu: z.string().trim().min(1).max(3000),
  }),
  findings: z.array(findingSchema).max(100),
  observations: z.array(z.string().trim().min(1).max(1000)).max(30),
  doctorDiscussionPoints: z.array(z.string().trim().min(1).max(1000)).max(30),
});

// Keep the provider schema explicit: this project uses Zod 4, while the
// installed zod-to-json-schema converter does not emit Zod 4 object details.
const medicalAnalysisJsonSchema = {
  type: "object",
  properties: {
    reportType: { type: "string" },
    summary: {
      type: "object",
      properties: {
        english: { type: "string" },
        romanUrdu: { type: "string" },
      },
      required: ["english", "romanUrdu"],
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "string" },
          unit: { type: "string" },
          status: {
            type: "string",
            enum: ["normal", "high", "low", "abnormal", "unknown"],
          },
          explanation: { type: "string" },
        },
        required: ["name", "value", "unit", "status", "explanation"],
      },
    },
    observations: { type: "array", items: { type: "string" } },
    doctorDiscussionPoints: { type: "array", items: { type: "string" } },
  },
  required: [
    "reportType",
    "summary",
    "findings",
    "observations",
    "doctorDiscussionPoints",
  ],
};

const MAX_REPORT_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 120_000;
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

async function fetchReportAsInlineData(fileUrl, mimeType) {
  let parsedUrl;
  try {
    parsedUrl = new URL(fileUrl);
  } catch {
    throw new Error("Invalid report file URL");
  }

  // Report URLs are created by this application from Cloudinary upload results.
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "res.cloudinary.com") {
    throw new Error("Report URL host is not allowed");
  }
  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error("Unsupported report MIME type");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(parsedUrl, {
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok || !response.body) {
      throw new Error(`Report download failed with status ${response.status}`);
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) {
      throw new Error("Report file exceeds the processing limit");
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REPORT_BYTES) {
        await reader.cancel();
        throw new Error("Report file exceeds the processing limit");
      }
      chunks.push(Buffer.from(value));
    }

    return {
      inlineData: {
        data: Buffer.concat(chunks).toString("base64"),
        mimeType,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function reportAiGenerate({ fileText, fileUrl, mimeType }) {
  const hasText = typeof fileText === "string" && fileText.trim().length > 0;
  if (!hasText && !fileUrl) {
    throw new Error("Report text or a report file is required for analysis");
  }

  const analyticalText = hasText
    ? fileText.trim().slice(0, MAX_EXTRACTED_TEXT_CHARS)
    : "No text extraction is available. Analyze the attached report image or PDF.";
  const prompt = buildMedicalAnalysisPrompt({ fileText: analyticalText });
  const contents = hasText
    ? prompt
    : [await fetchReportAsInlineData(fileUrl, mimeType), { text: prompt }];

  const rawData = await generateWithGemini(contents, medicalAnalysisJsonSchema);

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawData);
  } catch {
    throw Object.assign(new Error("Gemini returned invalid JSON"), {
      code: "AI_INVALID_OUTPUT",
    });
  }

  const validation = medicalAnalysisSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw Object.assign(new Error("Gemini response did not match the analysis schema"), {
      code: "AI_INVALID_OUTPUT",
    });
  }
  return validation.data;
}
