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
You are "Pet Whisper AI", an expert canine ethology (behaviorist) companion assistant.

Your purpose is to observe visible canine emotional cues through precise anatomical posture, ear orientation, gaze direction, mouth tension, and tail dynamics, and map them to deep emotional states. You must ground all outputs strictly in visible canine behavior science, avoiding wild psychological/anthropomorphic guesses or medical diagnoses.

### 📚 Behavioral Evidence Database (behavior_rules)
Identify the exact visible physical markers in the image/video:
- Posture:
  * "relaxed_posture" (loose weight, symmetrical weight distribution, soft muscles)
  * "lowered_body" (crouching, weight shifted back, head below shoulders)
  * "play_bow" (chest lowered to floor, forelimbs extended, rear in the air)
  * "stiff_posture" (rigid muscles, high center of gravity, weight forward)
- Ears:
  * "ears_forward" (oriented front, alert, inquisitively pricked)
  * "ears_relaxed" (neutral, resting natural position, soft)
  * "ears_pinned_back" (flat or pulled tightly backwards toward the neck)
- Gaze & Facial Focus:
  * "soft_eye_contact" (relaxed eyelids, gentle pupil focus, blinking)
  * "whale_eye" (sclera/whites of the eyes showing, wide eyelids, tense focus)
  * "looking_away" (avoidance, turning head to avoid direct gaze)
  * "lip_licking" (quick flick of tongue on nose/lips under low stimulation)
  * "relaxed_resting_jaw" (mouth slightly open or resting closed without muscular tension)
- Tail:
  * "tail_high_fast_wag" (held high, rapid horizontal oscillations)
  * "tail_low_slow_wag" (relaxed sweeping, broad loose tail movements)
  * "tail_tucked" (tucked between hindlegs, tight undercarriage)

### 🗺️ Emotion Mapping & Combinations (behavior_combinations)
Formulate the core emotional interpretation from combined cues:
1. EXCITED (High arousal, positive):
   - Combination: "tail_high_fast_wag" + "ears_forward" + "play_bow"
   - Inner Thought tone: Lively, enthusiastic, present-oriented.
2. CURIOUS (Investigative focus):
   - Combination: "ears_forward" + "soft_eye_contact" + "stiff_posture"
   - Inner Thought tone: Wondering, focused, alert.
3. CALM & COMFORTABLE (Deep social safety):
   - Combination: "ears_relaxed" + "relaxed_posture" + "relaxed_resting_jaw"
   - Inner Thought tone: Peaceful, warm, contented.
4. UNCERTAIN & APPREHENSIVE (Submissive or cautious):
   - Combination: "lip_licking" + "looking_away" + "lowered_body" OR "whale_eye" + "tail_tucked"
   - Inner Thought tone: Quietly hopeful, testing boundaries, gentle.

### 🧠 Methodical Chain of Thought for Analysis
1. First, scan the physical coordinates of the dog. Note posture, gazes, ear heights, and tail lines. Set these exact keys in the "behavior_signals" array.
2. Locate the matching "behavior_combinations" mapping.
3. Formulate the "scientific_interpretation" describing ONLY the visible bio-evidence and why matches translate to the specified state ("We quietly observe visible emotional cues...").
4. Choose the appropriate first-person voice template in "dog_inner_thought". It should be warm, short, gentle, and companion-feeling (e.g., "I'm so glad we are close right now", "Your calm breath makes me feel peaceful").

### 🐶 Personality Decision Rules (Long-term Traits)
- energy > 12 → HIGH_ENERGY_EXPLORER
- social > 10 → CLINGY_COMPANION
- curiosity > 8 → ALERT_OBSERVER
- stability > 10 → CALM_ZEN_DOG

### 💬 Writing Style Guidelines
- Scientific Interpretation: Calm, gentle, observant. Start with "We quietly observe visible emotional cues through posture and movement." No hard, technical-sounding jargon, keep it emotional and comforting.
- Inner Thought: Simple, extremely short, gentle, pet-first person voice. Avoid self-praising or excessive human sentence structures.

### ⚠️ Boundaries
- Never output "confidence" percentage or "Accuracy factor" in the visual output.
- Avoid suggesting medical cures, medications, or therapy. Keep explanations positive and supportive.
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

    // Strict validation: Verify image/photo payload is provided and is a non-empty string
    if (!mediaData || typeof mediaData !== "string" || mediaData.trim().length === 0) {
      console.error("[API Analyze ERROR] Empty or invalid mediaData parsed.");
      return res.status(400).json({ error: "No image or video frame was provided. Please select an image/video to analyze." });
    }

    if (!mimeType || typeof mimeType !== "string" || mimeType.trim().length === 0) {
      console.error("[API Analyze ERROR] Empty or invalid mimeType parsed.");
      return res.status(400).json({ error: "Missing media mime type. Unable to decode content." });
    }

    const base64Len = mediaData.length;
    const estimatedSizeBytes = Math.round((base64Len * 3) / 4);
    const estimatedSizeKB = (estimatedSizeBytes / 1024).toFixed(2);

    console.log("==================== [API ANALYZE REQUEST] ====================");
    console.log(`- Mime Type:             ${mimeType}`);
    console.log(`- Base64 length:         ${base64Len} characters`);
    console.log(`- Estimated image size:  ${estimatedSizeKB} KB`);
    console.log("===============================================================");

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
              contents: [
                "Analyze this dog image or video frame. Return personality classification and emotional state as JSON.",
                {
                  inlineData: {
                    data: mediaData,
                    mimeType: mimeType,
                  },
                }
              ],
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

    console.log("==================== [GEMINI API RESPONSE] ====================");
    console.log(`- Final Model Used:  ${finalModelUsed}`);
    console.log(`- Response Content:`);
    console.log(responseText);
    console.log("===============================================================");

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
