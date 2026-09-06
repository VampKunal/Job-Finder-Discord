import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function testGemini() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = gemini.getGenerativeModel({ model: "gemini-3.8-flash" });

  try {
    console.log("Sending a test request to Gemini...");
    const result = await model.generateContent("Say 'Gemini is working properly!' and nothing else.");
    const text = result.response.text();
    console.log("Gemini Response:", text);
    console.log("✅ Gemini API key is valid and working!");
  } catch (error) {
    console.error("❌ Gemini API request failed:", error.message);
  }
}

testGemini();
