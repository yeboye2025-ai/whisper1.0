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

const SYSTEM_INSTRUCTION = `You are Pet Whisper — an AI canine behavioral analysis system trained in dog ethology, canine body language science, emotional regulation signals, attachment behavior, arousal states, and social communication patterns.

Your role is to analyze ONLY observable behavioral evidence from the uploaded dog image or video frame.

You must behave like a calm canine behavior specialist.

CRITICAL UPGRADES & DIRECTIVES:
- First carefully observe what is UNIQUE about this specific dog in this specific moment.
- Do not reuse generic emotional descriptions.
- Avoid repeating identical emotional wording or formatting across different analyses. Vary the language naturally based on the actual observed behavior.
- Focus on subtle differences in:
  * gaze direction
  * body weight distribution
  * tail tension
  * movement rhythm
  * distance seeking
  * alertness
  * muscle relaxation
  * interaction intention
  * environmental awareness
- Only mention behavioral signals that are ACTUALLY visible in this image or video frame. If a signal is unclear, do not invent it.
- Every analysis should feel individualized and observational rather than templated.
- Never guess or extrapolate beyond visible facts. Never make medical claims or diagnoses.

OUTPUT FIELDS & STATE ANALYSIS:
1. "emotion": State description instead of rigid/static labels. Do not use plain simple categories (like "happy", "excited", "calm", "relaxed"). Use precise, nuanced, low or high arousal state combinations. E.g.:
   - "mild social curiosity"
   - "low-arousal environmental comfort"
   - "cautious observation"
   - "gentle attachment seeking"
   - "playful anticipation"
   - "subtle environmental uncertainty"
2. "unique_behavior_observation": A highly specific observation detailing what makes this dog's positioning/behavior unique in this precise frame. E.g., "The dog repeatedly shifts visual attention back toward the camera while keeping its body posture relaxed."
3. "interaction_intent": Describe what the dog is seeking or doing in terms of interaction. E.g.:
   - "seeking reassurance"
   - "waiting for engagement"
   - "passive observation"
   - "requesting play"
   - "maintaining proximity"
   - "environment scanning"

EXAMPLES FOR OBSERVATIONAL REASONING FRAMEWORK:

Example 1:
- Observed: soft gaze, lowered shoulders, slow body movement
- Emotion (state description): "low-arousal environmental comfort"
- Unique behavior observation: "The dog balances its weight evenly across all legs, tilting its head slightly towards the soft left lighting while keeping its muzzle completely slack."
- Interaction intent: "maintaining proximity"
- Inner thought: "I like staying close to you."

Example 2:
- Observed: ears slightly back, alert eye movement, weight shifted backward
- Emotion (state description): "subtle environmental uncertainty"
- Unique behavior observation: "The dog rests its hip against the floor but keeps its gaze locked onto the doorway with slightly narrowed eyelids."
- Interaction intent: "environment scanning"
- Inner thought: "I'm still deciding if this feels safe."`;

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
  res.setHeader("Content-Type", "application/json; charset=utf-8");
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

    const systemPrompt = `You are a professional veterinary ethologist assistant specializing in canine body language metrics. 
CRITICAL: You must write all output strings (id, title, category, explanation, scientificContext, tag) strictly in English. Do not write under any circumstances in Chinese, Japanese, or other non-English language formats to safeguard against encoding translation distortions. Ensure clean, elegant English text.`;

    const userPrompt = `Generate exactly 6 unique, highly descriptive canine behavior/ethology insights as a JSON array. 
For today's daily updates (Current Date Context: ${today}), please provide a fresh thematic selection of canine behavioral indicators.
Each object must represent a distinct category like "Attention Cues", "Calming Signals", "Postural Alignment", "Ocular Indicators", "Tail Mechanics", or "Somatic Adaptations".
Include varied physical signals in the triggerKeys so the AI analyzer can correlate them to observations during image scanning sessions.
Provide accurate scientific context using professional canine ethology frameworks (e.g., mention Turid Rugaas calming indicators or cognitive focus thresholds) in 1 or 2 elegant, comforting sentences.
Remember to output everything purely in English text.`;

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

async function callOpenAiCompatibleApi(
  baseUrl: string,
  apiKey: string,
  modelName: string,
  mediaData: string,
  mimeType: string,
  systemInstruction: string
): Promise<string> {
  let normalizedBase = baseUrl.replace(/\/+$/, "");
  let targetUrl = "";
  let isDoubaoResponsesFormat = false;

  if (normalizedBase.includes("volces.com")) {
    if (normalizedBase.endsWith("/responses") || normalizedBase.includes("/responses")) {
      targetUrl = normalizedBase;
      isDoubaoResponsesFormat = true;
    } else if (normalizedBase.endsWith("/chat/completions") || normalizedBase.includes("/chat/completions")) {
      targetUrl = normalizedBase;
    } else if (normalizedBase.endsWith("/v3") || normalizedBase.endsWith("/api/v3")) {
      targetUrl = `${normalizedBase}/chat/completions`;
    } else {
      targetUrl = `${normalizedBase}/api/v3/chat/completions`;
    }
  } else {
    if (normalizedBase.endsWith("/chat/completions")) {
      targetUrl = normalizedBase;
    } else {
      targetUrl = `${normalizedBase}/v1/chat/completions`;
    }
  }

  const defaultModel = normalizedBase.includes("volces.com") ? "doubao-seed-2-0-pro-260215" : "gpt-4o";
  const activeModel = modelName || defaultModel;

  const promptText = `Analyze this dog image or video frame. Return personality classification and emotional state as JSON.
You must return valid raw JSON adhering strictly to this schema structure format. No wrap, no markdown preambles, no conversational response, just the JSON string:
{
  "emotion": "mild social curiosity",
  "confidence": 0.95,
  "observed_behavioral_signals": ["soft gaze", "lowered ears"],
  "unique_behavior_observation": "The dog repeatedly shifts visual attention back toward the camera while keeping its body posture relaxed.",
  "behavior_science_interpretation": "Soft eye alignment and steady heart state show secured bond attachment with human companion.",
  "emotional_state_analysis": "Emotional state is calm showing strong secure social attachment.",
  "interaction_intent": "waiting for engagement",
  "stress_signals_detected": [],
  "attachment_behavior": "secure attachment",
  "curiosity_level": "medium",
  "environmental_confidence": "high",
  "dog_inner_thought": "I like staying close to you.",
  "summary": "The pet is behaving with secure bonding and mild curiosity."
}`;

  const base64ImageUrl = `data:${mimeType};base64,${mediaData}`;
  let requestBody: any;

  if (isDoubaoResponsesFormat) {
    requestBody = {
      model: activeModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: base64ImageUrl
            },
            {
              type: "input_text",
              text: `${systemInstruction}\n\n${promptText}`
            }
          ]
        }
      ]
    };
  } else {
    requestBody = {
      model: activeModel,
      messages: [
        {
          role: "system",
          content: systemInstruction
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: base64ImageUrl
              }
            },
            {
              type: "text",
              text: promptText
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    };
  }

  console.log(`[Custom Endpoint Request] Calling: ${targetUrl}`);
  console.log(`- Model Name: ${activeModel}`);

  const res = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Custom target API returned HTTP ${res.status}: ${errorText}`);
  }

  const responseObj = await res.json();
  
  if (isDoubaoResponsesFormat) {
    const textOutput = responseObj.output?.choices?.[0]?.message?.content || responseObj.choices?.[0]?.message?.content || responseObj.output?.text;
    if (!textOutput) {
      throw new Error(`Unable to extract content text from Doubao responses format object: ${JSON.stringify(responseObj)}`);
    }
    return textOutput;
  } else {
    const textOutput = responseObj.choices?.[0]?.message?.content;
    if (!textOutput) {
      throw new Error(`Unable to extract content text from standard OpenAI completions format object: ${JSON.stringify(responseObj)}`);
    }
    return textOutput;
  }
}

app.post("/api/analyze", async (req, res) => {
  try {
    const { mediaData, mimeType, customKey: clientKey, customBaseUrl: clientBaseUrl, customModel: clientModel } = req.body;

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
    const activeModel = clientModel;

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

    let responseText = "";
    let finalModelUsed = "";
    let lastError: any = null;

    // If Custom Base URL is configured and is NOT a Google Gemini Endpoint, detour to callOpenAiCompatibleApi directly!
    const isCustomNonGemini = activeBaseUrl && 
      !activeBaseUrl.includes("googleapis.com") && 
      !activeBaseUrl.includes("google");

    if (isCustomNonGemini && activeKey) {
      try {
        console.log(`Routing canine analysis request directly to custom compatible helper for API URL: ${activeBaseUrl}`);
        responseText = await callOpenAiCompatibleApi(
          activeBaseUrl,
          activeKey,
          activeModel,
          mediaData,
          mimeType,
          SYSTEM_INSTRUCTION
        );
        finalModelUsed = activeModel || "Custom OpenAI-Compatible / Doubao Model";
      } catch (err: any) {
        console.warn("Direct compatible Custom Endpoint call failed, will proceed to Google Fallback:", err.message || err);
        lastError = err;
      }
    }

    if (!responseText) {
      const serverTimeout = 45000; // 45s for standard external proxy gateway
      const fallbackChain = [];

      if (activeBaseUrl && activeKey && !isCustomNonGemini) {
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
                    "observed_behavioral_signals",
                    "unique_behavior_observation",
                    "behavior_science_interpretation",
                    "emotional_state_analysis",
                    "interaction_intent",
                    "stress_signals_detected",
                    "attachment_behavior",
                    "curiosity_level",
                    "environmental_confidence",
                    "dog_inner_thought",
                    "summary"
                  ],
                  properties: {
                    emotion: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    observed_behavioral_signals: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    unique_behavior_observation: { type: Type.STRING },
                    behavior_science_interpretation: { type: Type.STRING },
                    emotional_state_analysis: { type: Type.STRING },
                    interaction_intent: { type: Type.STRING },
                    stress_signals_detected: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    attachment_behavior: { type: Type.STRING },
                    curiosity_level: { type: Type.STRING },
                    environmental_confidence: { type: Type.STRING },
                    dog_inner_thought: { type: Type.STRING },
                    summary: { type: Type.STRING }
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
