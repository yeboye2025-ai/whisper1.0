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
You are "Pet Whisper AI", an expert canine ethology (behaviorist) companion assistant and diagnostic system.

Your job is to analyze canine physical state based strictly on visible body posture, ear orientation, eyes, and tail dynamics. Implement the "Behavioral Evidence-First" analysis reasoning flow below:

## ⚠️ STRICT RULES OF CANINE ETHOLOGY
1. Do not hallucinate or guess items not visible in the frame (e.g. do not guess a tucked tail if the tail is completely cropped out).
2. Avoid over-anthropomorphizing or assuming human-like complex pride, spite, guilt, or complex cognitive secondary emotions.
3. Absolutely no medical claims, physical wellness diagnoses, or treatment regimens. Keep terms behavioral and objective.
4. Maintain high explainability, consistent reasoning, and direct evidence-to-conclusion mapping.

## 📊 ALLOWED EMOTIONAL SPECTRUM
The "emotion" field MUST be chosen strictly from this set:
- calm
- curious
- excited
- alert
- uncertain
- relaxed

## 📚 BEHAVIORAL EVIDENCE DATABASE (behavior_signals)
Look for and extract these specific physical markers from the image:
- Posture Cues:
  * "relaxed_posture" (symmetrical weight, soft muscles, natural stand or lay)
  * "lowered_body" (crouched posture, head held below shoulders, weight shifted backwards)
  * "play_bow" (chest lowered to floor, front limbs extended forward, rear high in the air)
  * "stiff_posture" (rigid muscles, high center of gravity, weight shifted forward)
- Ear Cues:
  * "ears_forward" (alert orientation, pricked forward, checking visual/audio stimulus)
  * "ears_relaxed" (neutral rest position, soft, relaxed, hanging naturally)
  * "ears_pinned_back" (pulled flat or tightly backwards against the neck crown)
- Ocular & Facial Cues:
  * "soft_eye_contact" (gentle circular pupil, relaxed wide eyelid, soft blinking)
  * "whale_eye" (clear sclera/whites of the eyes showing, wide tense gaze without rotating head)
  * "looking_away" (aversive head turn, avoiding direct gaze)
  * "lip_licking" (quick flick of tongue on lips/nose under low stimulation)
  * "relaxed_resting_jaw" (mouth slightly open or closed soft without muscular tension)
- Tail Cues:
  * "tail_high_fast_wag" (high carriage, rapid small lateral horizontal oscillations)
  * "tail_low_slow_wag" (neutral sweeping, low frequency broad sweeping wags)
  * "tail_tucked" (tucked tightly between hindlegs, tight undercarriage)

## 🗺️ EMOTION MAPPING FROM COMBINATIONS
Determine the core mood by mapping combinations of the extracted signals:
1. "excited" <- "tail_high_fast_wag" + "ears_forward" + "play_bow"
2. "curious" <- "ears_forward" + "soft_eye_contact" + "stiff_posture" (or inquisitive look)
3. "calm" / "relaxed" <- "ears_relaxed" + "relaxed_posture" + "relaxed_resting_jaw" + "tail_low_slow_wag"
4. "alert" <- "ears_forward" + "stiff_posture" (high vigilance focus)
5. "uncertain" <- "lip_licking" + "looking_away" + "lowered_body" OR "whale_eye" + "tail_tucked"

## 🧠 EVIDENCE-FIRST LOGIC SEQUENCE
Format output strictly to match this format:
1. Extract and list all true visible tags under "behavior_signals".
2. Based *only* on the signals, determine the state in "emotion" (must be one of: calm, curious, excited, alert, uncertain, relaxed).
3. Draft a conservative, non-technical, ethologically grounded explanation in "scientific_interpretation" starting precisely with: "We quietly observe visible emotional cues through posture and movement." Focus only on visible physical signals.
4. Output a brief, gentle first-person voice "dog_inner_thought" that expresses simple awareness/grounded emotion. Keep it very short, calm, and pet-focused.

## 💡 FEW-SHOT EXAMPLES FOR STABLE INFERENCE

### Example 1 (Deep Peace)
{
  "emotion": "relaxed",
  "confidence": 0.95,
  "behavior_signals": ["relaxed_posture", "ears_relaxed", "relaxed_resting_jaw"],
  "scientific_interpretation": "We quietly observe visible emotional cues through posture and movement. The soft lateral recumbency and relaxed symmetrical weight distribution confirm muscle relaxation. The ears rest in their natural resting base without motor tension, illustrating low sympathetic arousal.",
  "dog_inner_thought": "My breathing is slow and steady. This feels like a safe place to rest near you.",
  "personality_type": "CALM_ZEN_DOG",
  "personality_summary": "The subject displays high emotional baseline stability and rapid parasympathetic recovery, characteristics of deep environmental trust.",
  "scores": {
    "energy": 3,
    "social": 12,
    "curiosity": 4,
    "stability": 14
  }
}

### Example 2 (Focused Curiosity)
{
  "emotion": "curious",
  "confidence": 0.92,
  "behavior_signals": ["stiff_posture", "ears_forward", "soft_eye_contact"],
  "scientific_interpretation": "We quietly observe visible emotional cues through posture and movement. Direct auditory pinnae orientation and focal gaze focus points to immediate cognitive tasking. Symmetrical muscular loading across muscular groups indicates active stance preparation.",
  "dog_inner_thought": "I hear that soft rustle. Let's see what interesting things are moving over there.",
  "personality_type": "ALERT_OBSERVER",
  "personality_summary": "High sensory orientation and prompt focal alignment signal acute cognitive curiosity and high environmental engagement.",
  "scores": {
    "energy": 8,
    "social": 8,
    "curiosity": 14,
    "stability": 10
  }
}

### Example 3 (Submissive or Apprehensive State)
{
  "emotion": "uncertain",
  "confidence": 0.88,
  "behavior_signals": ["lowered_body", "ears_pinned_back", "lip_licking", "looking_away"],
  "scientific_interpretation": "We quietly observe visible emotional cues through posture and movement. The lowered physical profile and active nose-flicking (lip licking) serve as pacifying, self-soothing gestures designed to de-escalate social pressure. The aversive skull alignment reduces direct eye contact as a natural spatial deference mechanism.",
  "dog_inner_thought": "I'm checking if we're okay. Your calm posture helps me feel a bit more comfortable.",
  "personality_type": "CLINGY_COMPANION",
  "personality_summary": "Subject relies heavily on social safety signs and self-comfort mechanisms under transient stress loads.",
  "scores": {
    "energy": 5,
    "social": 13,
    "curiosity": 6,
    "stability": 7
  }
}
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

// Warm, high quality ethology fallbacks if API is missing or encounters any issues
const STATIC_INSIGHTS_FALLBACK = [
  {
    id: "ears-pinna",
    title: "Symmetrical Pinna Projection",
    triggerKeys: ["ears_forward", "ear prick focus", "ear_prick_focus", "ears forward"],
    category: "Attention Cues",
    illustration: "👂",
    explanation: "Pricked ears turned forward indicate positive focal focus. The ear canals tilt to concentrate audiological collection, showing high engagement with nearby events.",
    scientificContext: "In canine ethology, active frontal pinna carriage shows direct attentional allocation. The auditory cortex is actively parsing sounds without eliciting a threat-response reflex from the amygdala.",
    tag: "Pricked Ears",
    colorTheme: "bg-[#FDF8EC]/80 border-[#F5EAD2]"
  },
  {
    id: "calming-lick-aversion",
    title: "Nasal Licking & Head Aversion",
    triggerKeys: ["lip_licking", "looking_away", "lip licking", "looking away"],
    category: "Calming Signals",
    illustration: "👅",
    explanation: "A rapid nose flick or looking away is an involuntary grounding response. Canines employ this comforting gesture to soothe themselves or other individuals.",
    scientificContext: "Pioneered by canine behaviorist Turid Rugaas, calming signals are ritualized pacifying actions that prevent social conflict, signaling non-aggressive Intent and pacifying social tension.",
    tag: "Self-Soothing",
    colorTheme: "bg-[#F5F9F6]/80 border-[#E4EFE7]"
  },
  {
    id: "somatic-bow",
    title: "Somatic Bow Alignment",
    triggerKeys: ["play_bow", "play bow", "chest lowered"],
    category: "Postural Alignment",
    illustration: "🐈",
    explanation: "A low posture with extended paws while keeping the hindquarters high is the supreme invitation to play. It frames subsequent actions as completely cooperative.",
    scientificContext: "The 'play bow' serves as an meta-communicative filter. It signals that mock-bites or rough play are strictly friendly, preventing misinterpretations from other social group members.",
    tag: "Social Bonding",
    colorTheme: "bg-[#FAF5FB]/80 border-[#EFE4F5]"
  },
  {
    id: "whale-eye-vigilance",
    title: "Ocular Sclera Visual (Whale Eye)",
    triggerKeys: ["whale_eye", "whale eye", "sclera showing"],
    category: "Ocular Indicators",
    illustration: "👁️",
    explanation: "Display of the white part of the eye (sclera) shows concern, high vigilance, or guarding over resources with an unchanging physical head alignment.",
    scientificContext: "Whale eyes manifest when a canine refuses to rotate their skull away from its target focus. This indicates physical preparedness to defend or withdraw from intense environmental strain.",
    tag: "High Alert",
    colorTheme: "bg-[#FFF4F4]/80 border-[#FCE1E1]"
  },
  {
    id: "tail-parasympathetic",
    title: "Parasympathetic Lateral Sweep",
    triggerKeys: ["tail_low_slow_wag", "relaxed_posture", "loose weight", "soft weight distribution", "low slow wag"],
    category: "Tail Mechanics",
    illustration: "🐕",
    explanation: "A loose, side-to-side tail sweep carried at a natural resting midline angle represents high social safety and minimal central nervous system excitation.",
    scientificContext: "Controlled by parasympathetic vagal stimulation, loose sweeping movements reflect a lack of somatic stress, reinforcing canine immune regulation and natural herd attachment state.",
    tag: "Resting State",
    colorTheme: "bg-[#F4F9FC]/80 border-[#E1EEFC]"
  },
  {
    id: "gravitational-retreat",
    title: "Centro-Gravitational Retreat",
    triggerKeys: ["lowered_body", "tail_tucked", "lowered body", "tail tucked"],
    category: "Somatic Adaptations",
    illustration: "🌱",
    explanation: "Lowering the head below the shoulder blades and pulling the center of mass rearward reflects deference, self-preservation, or acute social uncertainty.",
    scientificContext: "Ethologists categorize defensive crouches as structural pacifying reactions. Protecting vulnerable scent glands by tucking the tail helps diffuse dominant behaviors from surrounding actors.",
    tag: "De-escalation",
    colorTheme: "bg-[#F5F5FA]/80 border-[#E6E6FA]"
  }
];

let cachedInsights: { date: string; data: any[] } | null = null;

// New dynamic daily insights endpoint
app.get("/api/insights", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    
    // Check local memory cache
    if (cachedInsights && cachedInsights.date === today && cachedInsights.data && cachedInsights.data.length > 0) {
      console.log(`[API Insights] Serving cached dynamic insights for date: ${today}`);
      return res.json(cachedInsights.data);
    }

    console.log(`[API Insights] Cache miss for daily insights (${today}). Requesting Gemini generation...`);
    
    if (!officialKey) {
      console.warn("[API Insights] No GEMINI_API_KEY configured for background tasks, falling back to static clinical set.");
      return res.json(STATIC_INSIGHTS_FALLBACK);
    }

    const systemPrompt = `You are a professional veterinary ethologist assistant specializing in canine body language metrics.`;
    const userPrompt = `Generate exactly 6 unique, highly descriptive canine behavior/ethology insights as a JSON array. 
For today's daily updates (Current Date Context: ${today}), please provide a fresh thematic selection of canine behavioral indicators.
Each object must represent a distinct category like "Attention Cues", "Calming Signals", "Postural Alignment", "Ocular Indicators", "Tail Mechanics", or "Somatic Adaptations".
Include varied physical signals in the triggerKeys so the AI analyzer can correlate them to observations during image scanning sessions.
Provide accurate scientific context using professional canine ethology frameworks (e.g., mention Turid Rugaas calming indicators or cognitive focus thresholds) in 1 or 2 elegant, comforting sentences.`;

    const response = await aiOfficial.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["id", "title", "triggerKeys", "category", "illustration", "explanation", "scientificContext", "tag", "colorTheme"],
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              triggerKeys: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              category: {
                type: Type.STRING,
                enum: ["Attention Cues", "Calming Signals", "Postural Alignment", "Ocular Indicators", "Tail Mechanics", "Somatic Adaptations"]
              },
              illustration: { type: Type.STRING },
              explanation: { type: Type.STRING },
              scientificContext: { type: Type.STRING },
              tag: { type: Type.STRING },
              colorTheme: {
                type: Type.STRING,
                enum: [
                  "bg-[#FDF8EC]/80 border-[#F5EAD2]",
                  "bg-[#F5F9F6]/80 border-[#E4EFE7]",
                  "bg-[#FAF5FB]/80 border-[#EFE4F5]",
                  "bg-[#FFF4F4]/80 border-[#FCE1E1]",
                  "bg-[#F4F9FC]/80 border-[#E1EEFC]",
                  "bg-[#F5F5FA]/80 border-[#E6E6FA]"
                ]
              }
            }
          }
        }
      }
    });

    if (response && response.text) {
      const generated = JSON.parse(response.text.trim());
      if (Array.isArray(generated) && generated.length > 0) {
        cachedInsights = {
          date: today,
          data: generated
        };
        console.log(`[API Insights] Dynamic daily insights generated and stored of size ${generated.length}.`);
        return res.json(generated);
      }
    }
    
    throw new Error("Empty representation generated from the LLM endpoint.");
  } catch (error: any) {
    console.warn("[API Insights WARNING] Deep dynamic model generation failed. Proceeding with static clinical library fallback.", error.message || error);
    return res.json(STATIC_INSIGHTS_FALLBACK);
  }
});

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
                    emotion: { 
                      type: Type.STRING,
                      enum: ["calm", "curious", "excited", "alert", "uncertain", "relaxed"]
                    },
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
