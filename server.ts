import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import dns from "node:dns/promises";

dotenv.config();

const app = express();
const PORT = 3000;

function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return true;
  }
  if (ip.startsWith("172.")) {
    const parts = ip.split(".");
    if (parts.length >= 2) {
      const secondPart = parseInt(parts[1], 10);
      if (secondPart >= 16 && secondPart <= 31) {
        return true;
      }
    }
  }
  return false;
}

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

// Initialize official standard Gemini API client with credentials injected by the platform
const officialKey = process.env.GEMINI_API_KEY || "";
const aiOfficial = new GoogleGenAI({
  apiKey: officialKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Optional proxy defaults (only used if environment variables are explicitly configured)
const customKey = process.env.GEMINI_API_KEY_PROXY || "";
const customBaseUrl = process.env.GEMINI_API_BASE_URL_PROXY || "";

app.post("/api/analyze", async (req, res) => {
  try {
    const { mediaData, mimeType, customKey: clientKey, customBaseUrl: clientBaseUrl } = req.body;

    if (!mediaData || !mimeType) {
      return res.status(400).json({ error: "Missing media data or mime type" });
    }

    const activeBaseUrl = clientBaseUrl || customBaseUrl;
    const activeKey = clientKey || customKey;

    // Proactively check if activeBaseUrl resolves to a private, non-routable IP (e.g. 192.168.x.x)
    let isPrivateHost = false;
    let dnsIp = "";
    if (activeBaseUrl) {
      try {
        const urlObj = new URL(activeBaseUrl);
        const host = urlObj.hostname;
        const lookupResult = await dns.lookup(host);
        dnsIp = lookupResult.address;
        if (isPrivateIp(dnsIp)) {
          isPrivateHost = true;
        }
      } catch (e: any) {
        console.warn("Pre-DNS lookup diagnostic logged (cannot resolve host, could be private/local only):", e.message || e);
      }
    }

    if (isPrivateHost && activeBaseUrl && activeKey) {
      console.log(`Note: Intercepted private host resolution (${dnsIp}) for ${activeBaseUrl}. Relaying configuration metadata to client for instant browser-direct execution.`);
      return res.json({
        clientFallback: true,
        customBaseUrl: activeBaseUrl,
        customKey: activeKey,
        isPrivateIp: true,
        dnsIp,
        systemInstruction: SYSTEM_INSTRUCTION,
        message: `Your backend API host resolves to a private intranet address (${dnsIp}) that our Cloud environment cannot access. We are securely routing this request directly from your browser!`,
      });
    }

    const serverTimeout = 45000; // 45s for standard external proxy gateway

    // Prepare fallback chain dynamically. If custom settings are provided, they take precedence.
    const fallbackChain = [];

    if (activeBaseUrl && activeKey) {
      const dynamicCustomClient = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          baseUrl: activeBaseUrl,
          headers: {
            "User-Agent": "aistudio-build",
          },
          timeout: serverTimeout,
        },
      });

      fallbackChain.push(
        { client: dynamicCustomClient, model: "gemini-3.5-flash", name: "Custom Proxy (gemini-3.5-flash)" },
        { client: dynamicCustomClient, model: "gemini-2.5-flash", name: "Custom Proxy (gemini-2.5-flash)" }
      );
    }

    // Always include direct Official Google Gemini API as primary default or direct fallback
    fallbackChain.push(
      { client: aiOfficial, model: "gemini-3.5-flash", name: "Official Gemini API (gemini-3.5-flash)" },
      { client: aiOfficial, model: "gemini-2.5-flash", name: "Official Gemini API (gemini-2.5-flash)" }
    );

    let lastError: any = null;
    let responseText = "";
    let finalModelUsed = "";

    for (const attempt of fallbackChain) {
      // Skip official API fallback if no official API Key is set in the sandbox env
      if (attempt.client === aiOfficial && !officialKey) {
        console.warn(`Skipping official fallback '${attempt.name}' because no standard Gemini API Key was found.`);
        continue;
      }

      try {
        console.log(`Attempting canine analysis with: ${attempt.name}`);
        
        // Retry logic for transient issues (spikes, high demand, timeout)
        for (let retry = 0; retry < 2; retry++) {
          try {
            const response = await attempt.client.models.generateContent({
              model: attempt.model,
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

            if (response && response.text) {
              responseText = response.text;
              finalModelUsed = attempt.name;
              break; // Success! Break out of retry loop
            } else {
              throw new Error("Model returned empty text response body");
            }
          } catch (err: any) {
            const errStr = String(err);
            const isTransient = err.status === 503 || err.status === 429 || errStr.includes("aborted") || errStr.includes("timeout") || errStr.includes("fetch failed");
            
            if (isTransient && retry === 0) {
              console.warn(`Transient error on ${attempt.name} during try #${retry + 1}: ${err.message || err}. Retrying in 1.5s...`);
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
            throw err; // Permanent or retry-exhausted error, escalate to fallback chain
          }
        }

        if (responseText) {
          break; // Completed successfully, break fallbackChain loop
        }
      } catch (err: any) {
        console.warn(`Canine analysis attempt failed with ${attempt.name}:`, err.message || err);
        lastError = err;
      }
    }

    if (!responseText) {
      console.warn("All server endpoint connections failed. Instigating client-side connection proxy...");
      return res.json({
        clientFallback: true,
        customBaseUrl: activeBaseUrl,
        customKey: activeKey,
        isPrivateIp: isPrivateHost,
        dnsIp: dnsIp || undefined,
        systemInstruction: SYSTEM_INSTRUCTION,
        message: `Direct backend connection to custom proxy at ${activeBaseUrl} failed. Switching to browser-direct connection.`,
        error: lastError?.message || "All server endpoints timed out/failed."
      });
    }

    console.log(`Canine behavior generation succeeded via: ${finalModelUsed}`);

    // Clean up potential markdown blocks returned by some models
    let text = responseText.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    try {
      const parsedData = JSON.parse(text);
      res.json(parsedData);
    } catch (parseError) {
      console.error("JSON Parsing Error. Text received:", text);
      throw new Error("AI returned an invalid behavior response format. Please try again.");
    }
  } catch (error: any) {
    console.error("Gemini Analysis Route Error:", error);
    // Return HTTP 400 or use standard user-facing error to prevent intercepting HTML responses by proxy front-ends (Nginx/Cloud Run)
    res.status(400).json({ 
      error: error.message || "An unexpected error occurred during analysis.",
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
