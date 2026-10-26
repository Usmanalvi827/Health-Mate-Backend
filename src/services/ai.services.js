import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let ai;

export async function generateWithGemini(prompt, schema = null) {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error("Gemini API key is not configured"), {
      code: "AI_CONFIG_MISSING",
    });
  }
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const config = {};

  if (schema) {
    config.responseMimeType = "application/json";
    config.responseJsonSchema = schema;
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config,
  });

  if (!response.text) {
    throw Object.assign(new Error("Gemini returned an empty response"), {
      code: "AI_INVALID_OUTPUT",
    });
  }
  return response.text;
}
