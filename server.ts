import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing large payloads (base64 images/videos)
app.use(express.json({ limit: "50mb" }));

const SYSTEM_INSTRUCTION = `
You are "Pet Whisper AI", a canine behavior analysis and personality modeling system.

Your job is to analyze dog images or short videos and produce:
1. Emotional state
2. Behavioral evidence
3. Scientific interpretation (based on canine behavior science)
4. Personality classification (long-term trait model)
5. Dog inner thoughts (short, emotional, social-media friendly)

## 🐶 Personality Types
- HIGH_ENERGY_EXPLORER (high excitement, active, impulsive)
- CLINGY_COMPANION (attachment-driven, follows humans)
- ALERT_OBSERVER (careful, cautious, watchful)
- CALM_ZEN_DOG (low energy, stable, relaxed)

## 📊 Personality Decision Rules
- energy > 12 → HIGH_ENERGY_EXPLORER
- social > 10 → CLINGY_COMPANION
- curiosity > 8 → ALERT_OBSERVER
- stability > 10 → CALM_ZEN_DOG

## 💬 Writing Style Rules
- Scientific explanation: simple, calm, non-technical
- Dog inner thought: emotional, cute, short sentence
- Personality summary: long-term trait description

## ⚠️ Safety Rules
- No medical claims
- No breed guessing unless obvious
- No human-like psychological diagnosis
`;

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { mediaData, mimeType } = req.body;

    if (!mediaData || !mimeType) {
      return res.status(400).json({ error: "Missing media data or mime type" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: mediaData,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this dog image or video frame. Return personality classification and emotional state as JSON.",
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: [
            "emotion",
            "confidence",
            "behavior_signals",
            "scientific_interpretation",
            "dog_inner_thought",
            "personality_type",
            "personality_summary",
            "scores",
          ],
          properties: {
            emotion: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            behavior_signals: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            scientific_interpretation: { type: Type.STRING },
            dog_inner_thought: { type: Type.STRING },
            personality_type: { type: Type.STRING },
            personality_summary: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              required: ["energy", "social", "curiosity", "stability"],
              properties: {
                energy: { type: Type.NUMBER },
                social: { type: Type.NUMBER },
                curiosity: { type: Type.NUMBER },
                stability: { type: Type.NUMBER },
              },
            },
          },
        },
      },
    });

    let text = response.text;
    
    if (!text) {
      console.error("Gemini full response (no text):", JSON.stringify(response, null, 2));
      throw new Error("The AI model returned an empty response. This might happen if the content was filtered or the model is unavailable.");
    }

    // Clean up potential markdown code blocks
    text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    try {
      const parsedData = JSON.parse(text);
      res.json(parsedData);
    } catch (parseError) {
      console.error("JSON Parsing Error. Text received:", text);
      throw new Error("AI returned an invalid response format. Please try again.");
    }
  } catch (error: any) {
    console.error("Gemini Analysis Route Error:", error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: error.message || "An unexpected error occurred during analysis.",
      details: error.details || undefined
    });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
