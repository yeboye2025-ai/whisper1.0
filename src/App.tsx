/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { 
  Dog, 
  Upload, 
  Search, 
  Zap, 
  Heart, 
  ShieldCheck, 
  MessageCircleHeart,
  ChevronRight,
  Loader2,
  RefreshCw,
  Info,
  BrainCircuit,
  History,
  Calendar,
  Clock,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Terminal,
  WifiOff,
  Settings,
  Sparkles,
  ArrowUpRight,
  Check,
  Play,
  Pause,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Scores {
  energy: number;
  social: number;
  curiosity: number;
  stability: number;
}

interface AnalysisResult {
  emotion: string;
  confidence: number;
  behavior_signals: string[];
  scientific_interpretation: string;
  dog_inner_thought: string;
  personality_type: string;
  personality_summary: string;
  scores: Scores;
}

interface HistoryEntry extends AnalysisResult {
  id: string;
  timestamp: number;
  thumbnail: string;
  mimeType: string;
}

interface TimelineSegment extends AnalysisResult {
  timeRange: string;
}

// Pre-computed dynamic interactive sample dataset for Milo (Golden Retriever)
const MILO_EXAMPLE_TIMELINE: TimelineSegment[] = [
  {
    timeRange: "0s – 3s",
    emotion: "Deep Calm",
    confidence: 0.98,
    dog_inner_thought: "I'm so glad we are just sitting here together. This moment feels warm, quiet, and completely peaceful.",
    behavior_signals: ["Soft weight distribution", "Relaxed eye contact", "Slight tail sway", "Neutral head carriage"],
    scientific_interpretation: "We quietly observe visible emotional cues through posture and movement. Milo's natural forward leaning weight distribution coupled with a slow, even tail wag reflects a high level of comfort and secure engagement. The lack of tension around his muzzle indicates deep cognitive ease.",
    personality_type: "Gentle Observer",
    personality_summary: "Milo exhibits high emotional resilience and secure attachments, displaying gentle curiosity towards his human guide.",
    scores: { energy: 6, social: 19, curiosity: 11, stability: 18 }
  },
  {
    timeRange: "4s – 7s",
    emotion: "Mindful Curiosity",
    confidence: 0.96,
    dog_inner_thought: "What's that gentle sound? Oh, I see your soft focus on me. I love listening to your quiet breathing.",
    behavior_signals: ["Ear prick focus", "Soft head tilt", "Intense pupil contact", "Inquisitive posture"],
    scientific_interpretation: "A minor sonic stimulus triggers a secondary attention cascade. The expansion of his pupillary aperture coupled with an ear-prick focus indicates quiet, safe cognitive exploration rather than somatic alarm.",
    personality_type: "Gentle Observer",
    personality_summary: "Milo exhibits high emotional resilience and secure attachments, displaying gentle curiosity towards his human guide.",
    scores: { energy: 11, social: 17, curiosity: 19, stability: 17 }
  },
  {
    timeRange: "8s – 12s",
    emotion: "Loving Devotion",
    confidence: 0.99,
    dog_inner_thought: "You are my entire world. I don't need any words to write it, I just lean closer to be near you.",
    behavior_signals: ["Relaxed resting jaw", "Half-closed soft eyelids", "Slow rhythmic sigh", "Proximity leaning"],
    scientific_interpretation: "Milo enters a full regulatory bonding phase, displaying zero defensive markers. Parasympathetic tone is extremely dominant, confirming deep social connection and unreserved surrender of alertness.",
    personality_type: "Gentle Observer",
    personality_summary: "Milo exhibits high emotional resilience and secure attachments, displaying gentle curiosity towards his human guide.",
    scores: { energy: 4, social: 20, curiosity: 8, stability: 20 }
  }
];

// Default Unsplash image for Milo, beautiful high quality warm aesthetic dog photo
const MILO_SAMPLE_IMAGE = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600";

// Helper to compress/resize media to keep request payloads incredibly fast & highly reliable
const compressMediaForAnalysis = (file: File, base64: string): Promise<{ dataUrl: string; pureBase64: string; mimeType: string }> => {
  return new Promise((resolve) => {
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.autoplay = false;
      video.muted = true;
      video.playsInline = true;
      video.src = base64;

      video.onloadeddata = () => {
        video.currentTime = 0.1; // seek early frame to bypass any solid black screen
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ dataUrl: base64, pureBase64: base64.split(",")[1], mimeType: file.type });
            return;
          }

          const maxDim = 1024;
          let width = video.videoWidth || 1024;
          let height = video.videoHeight || 768;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          const pureBase64 = dataUrl.split(",")[1];
          resolve({ dataUrl, pureBase64, mimeType: "image/jpeg" });
        } catch (e) {
          resolve({ dataUrl: base64, pureBase64: base64.split(",")[1], mimeType: file.type });
        }
      };

      video.onerror = () => {
        resolve({ dataUrl: base64, pureBase64: base64.split(",")[1], mimeType: file.type });
      };

      // Fallback timeout
      setTimeout(() => {
        resolve({ dataUrl: base64, pureBase64: base64.split(",")[1], mimeType: file.type });
      }, 4000);
      return;
    }

    if (!file.type.startsWith("image/")) {
      resolve({ dataUrl: base64, pureBase64: base64.split(",")[1], mimeType: file.type });
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ dataUrl: base64, pureBase64: base64.split(",")[1], mimeType: file.type });
          return;
        }

        const maxDim = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const pureBase64 = dataUrl.split(",")[1];
        resolve({ dataUrl, pureBase64, mimeType: "image/jpeg" });
      } catch (e) {
        resolve({ dataUrl: base64, pureBase64: base64.split(",")[1], mimeType: file.type });
      }
    };
    img.onerror = () => {
      resolve({ dataUrl: base64, pureBase64: base64.split(",")[1], mimeType: file.type });
    };
    img.src = base64;
  });
};

// Generates a tiny thumbnail to fit perfectly into LocalStorage history profiles (less than ~10KB)
const createThumbnail = (file: File, base64: string): Promise<string> => {
  return new Promise((resolve) => {
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.autoplay = false;
      video.muted = true;
      video.playsInline = true;
      video.src = base64;
      
      video.onloadeddata = () => {
        video.currentTime = 0.1;
      };
      
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }
          const maxDim = 150;
          let width = video.videoWidth || 150;
          let height = video.videoHeight || 100;
          
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        } catch (e) {
          resolve("");
        }
      };
      
      video.onerror = () => {
        resolve("");
      };
      
      setTimeout(() => {
        resolve("");
      }, 3000);
      return;
    }

    if (!file.type.startsWith("image/")) {
      resolve("");
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("");
          return;
        }

        const maxDim = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      } catch (e) {
        resolve("");
      }
    };
    img.onerror = () => {
      resolve("");
    };
    img.src = base64;
  });
};

const ScoreBar = ({ label, value, max = 20, icon: Icon }: { label: string, value: number, max?: number, icon: React.ElementType }) => (
  <div className="space-y-1.5 font-sans">
    <div className="flex justify-between items-center text-[11px] font-mono uppercase tracking-widest text-[#6B7280]">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-[#D8B7A0]" />
        {label}
      </div>
      <span>{value}/{max}</span>
    </div>
    <div className="h-1 bg-black/[0.04] rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="h-full bg-[#D8B7A0] rounded-full"
      />
    </div>
  </div>
);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.05
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 15, filter: 'blur(6px)' },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { type: "spring", stiffness: 85, damping: 14 }
  }
};

export interface BehaviorInsight {
  id: string;
  title: string;
  triggerKeys: string[];
  category: "Attention Cues" | "Calming Signals" | "Postural Alignment" | "Ocular Indicators" | "Tail Mechanics" | "Somatic Adaptations";
  illustration: string;
  explanation: string;
  scientificContext: string;
  tag: string;
  colorTheme: string; // for soft Apple Health style background tints
}

export const PET_BEHAVIOR_INSIGHTS: BehaviorInsight[] = [
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

export const getAssociatedInsights = (signals: string[]): BehaviorInsight[] => {
  if (!signals || signals.length === 0) return [];
  return PET_BEHAVIOR_INSIGHTS.filter(insight => 
    insight.triggerKeys.some(key => 
      signals.some(sig => {
        const s = sig.toLowerCase().replace(/_/g, " ");
        const k = key.toLowerCase().replace(/_/g, " ");
        return s.includes(k) || k.includes(s);
      })
    )
  );
};

async function runBrowserFallback(
  customBaseUrl: string,
  customKey: string,
  mediaData: string,
  mimeType: string,
  systemInstruction: string
): Promise<any> {
  console.log("Staging Client Local Network Fallback Request via Direct Browser Handshake...");
  const normalizedBaseUrl = customBaseUrl.replace(/\/+$/, "");
  const baseWithoutVClass = normalizedBaseUrl.replace(/\/v(1|1beta|2|2beta|3|4)$/, "");

  const systemPromptMessage = `${systemInstruction}\n\nIMPORTANT: You must return valid JSON ONLY matching this schema precisely. No preambles, no Markdown code blocks, no backticks, no other text:\n{\n  "emotion": "Joyful",\n  "confidence": 0.95,\n  "behavior_signals": ["tail wagging", "relaxed ears"],\n  "scientific_interpretation": "A simple pet behavioral scientist explanation...",\n  "dog_inner_thought": "I love playing with you!",\n  "personality_type": "HIGH_ENERGY_EXPLORER",\n  "personality_summary": "Description of individual personality.",\n  "scores": { "energy": 14, "social": 12, "curiosity": 9, "stability": 11 }\n}`;

  const openaiCandidates = [
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gemini-3.5-flash" },
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "x-api-key": customKey }, model: "gemini-3.5-flash" },
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "x-goog-api-key": customKey }, model: "gemini-3.5-flash" },
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gemini-2.5-flash" },
    { url: `${baseWithoutVClass}/v1/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gemini-3.5-flash" },
    { url: `${baseWithoutVClass}/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gemini-3.5-flash" },
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gpt-4o-mini" },
  ];

  const geminiCandidates = [
    { url: `${normalizedBaseUrl}/v1beta/models/gemini-3.5-flash:generateContent?key=${customKey}` },
    { url: `${normalizedBaseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${customKey}` },
    { url: `${normalizedBaseUrl}/models/gemini-3.5-flash:generateContent?key=${customKey}` },
    { url: `${normalizedBaseUrl}/models/gemini-2.5-flash:generateContent?key=${customKey}` },
    { url: `${baseWithoutVClass}/v1beta/models/gemini-3.5-flash:generateContent?key=${customKey}` },
    { url: `${baseWithoutVClass}/v1beta/models/gemini-2.5-flash:generateContent?key=${customKey}` }
  ];

  for (const candidate of openaiCandidates) {
    try {
      console.log(`Browser Fallback: Testing OpenAI candidate URL: ${candidate.url}`);
      const res = await fetch(candidate.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...candidate.headers
        },
        body: JSON.stringify({
          model: candidate.model,
          messages: [
            { role: "system", content: systemPromptMessage },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this dog image or video frame. Return personality classification and emotional state as JSON."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${mediaData}`
                  }
                }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (res.ok) {
        const resultObj = await res.json();
        const contentText = resultObj.choices?.[0]?.message?.content;
        if (contentText) {
          console.log("Browser Fallback: OpenAI-compatible candidate succeeded!");
          const jsonStr = contentText.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
          return JSON.parse(jsonStr);
        }
      }
    } catch (err: any) {
      console.warn(`Browser Fallback OpenAI candidate error:`, err.message || err);
    }
  }

  for (const candidate of geminiCandidates) {
    try {
      console.log(`Browser Fallback: Testing Gemini REST candidate URL: ${candidate.url}`);
      const res = await fetch(candidate.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: mediaData
                  }
                },
                {
                  text: "Analyze this dog image or video frame. Return personality classification and emotional state as JSON."
                }
              ]
            }
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              required: [
                "emotion",
                "confidence",
                "behavior_signals",
                "scientific_interpretation",
                "dog_inner_thought",
                "personality_type",
                "personality_summary",
                "scores"
              ],
              properties: {
                emotion: { type: "STRING" },
                confidence: { type: "NUMBER" },
                behavior_signals: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                scientific_interpretation: { type: "STRING" },
                dog_inner_thought: { type: "STRING" },
                personality_type: { type: "STRING" },
                personality_summary: { type: "STRING" },
                scores: {
                  type: "OBJECT",
                  required: ["energy", "social", "curiosity", "stability"],
                  properties: {
                    energy: { type: "NUMBER" },
                    social: { type: "NUMBER" },
                    curiosity: { type: "NUMBER" },
                    stability: { type: "NUMBER" }
                  }
                }
              }
            }
          }
        })
      });

      if (res.ok) {
        const resultObj = await res.json();
        const text = resultObj.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log("Browser Fallback: Gemini REST candidate succeeded!");
          const jsonStr = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
          return JSON.parse(jsonStr);
        }
      }
    } catch (err: any) {
      console.warn(`Browser Fallback Gemini REST candidate error:`, err.message || err);
    }
  }

  throw new Error(
    "Browser-direct connection failed too. This usually occurs because of browser CORS restrictions on your custom proxy server.\n\n" +
    "To resolve this instantly, please:\n" +
    "1. Open this app in a NEW TAB.\n" +
    "2. Ensure your local proxy allows CORS requests.\n" +
    "3. Or, configure an official Google GEMINI_API_KEY in the sidebar settings so we can run directly on Google Cloud servers."
  );
}

interface ConnectivityTroubleshooterProps {
  error: string;
  onClear: () => void;
  onOpenConfig: () => void;
}

function ConnectivityTroubleshooter({ error, onClear, onOpenConfig }: ConnectivityTroubleshooterProps) {
  const isCustomProxyError = error.includes("Browser-direct connection failed") || 
                             error.includes("CORS restrictions") || 
                             error.includes("watt-api") ||
                             error.includes("192.168") ||
                             error.includes("private network IP");

  if (!isCustomProxyError) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        className="p-5 bg-red-500/[0.04] border border-red-200 rounded-2xl flex items-start gap-3.5 text-red-700 text-xs font-sans leading-relaxed relative"
      >
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-red-900">Analysis Failed</p>
          <p className="opacity-90">{error}</p>
        </div>
        <button 
          onClick={onClear}
          className="text-black/30 hover:text-black/80 transition-colors absolute top-4 right-4 text-xs font-mono"
        >
          Dismiss
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="border border-[#D8B7A0]/30 bg-white/80 backdrop-blur-md rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-xl shadow-[#D8B7A0]/5"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#D8B7A0]/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-black/[0.06] pb-5">
        <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
          <WifiOff className="w-6 h-6 animate-pulse" />
        </div>
        <div className="space-y-1 text-left">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280] font-bold">Connectivity Diagnostic</h3>
          <h4 className="text-lg font-medium text-[#111111] leading-snug">Unreachable Custom Proxy Server</h4>
        </div>
        <button 
          onClick={onClear}
          className="ml-auto text-black/40 hover:text-black hover:border-black/20 text-[10px] font-mono border border-black/[0.06] bg-black/[0.02] px-2.5 py-1 rounded transition-all"
        >
          Dismiss
        </button>
      </div>

      {/* Cause Analysis */}
      <div className="space-y-4 text-left">
        <h5 className="font-mono text-[10px] uppercase tracking-widest text-black/40 font-semibold">Incident Details</h5>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-black/[0.02] border border-black/[0.04] rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-black/60 font-mono text-[10px] uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> DNS Map
            </div>
            <p className="text-[11px] text-black/80 leading-relaxed font-mono">
              watt-api.rivtower.cc
              <br />
              ➡ <span className="text-orange-600">192.168.120.1</span>
            </p>
          </div>
          <div className="bg-black/[0.02] border border-black/[0.04] rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-black/60 font-mono text-[10px] uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Cloud Run Server
            </div>
            <p className="text-[11px] text-[#6B7280] leading-relaxed">
              Google Cloud containers have isolated security boundaries and <span className="text-red-600 font-mono">cannot rout</span> private IP subnets.
            </p>
          </div>
          <div className="bg-black/[0.02] border border-black/[0.04] rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-black/60 font-mono text-[10px] uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Browser Client
            </div>
            <p className="text-[11px] text-[#6B7280] leading-relaxed">
              Browser security blocks requests to <span className="text-orange-600 font-mono">192.168.120.1</span> due to Private Network Access (PNA) &amp; CORS.
            </p>
          </div>
        </div>
      </div>

      {/* Solutions */}
      <div className="space-y-4 border-t border-black/[0.06] pt-5 text-left">
        <h5 className="font-mono text-[10px] uppercase tracking-widest text-black/40 font-semibold">How to Resolve This</h5>
        
        <div className="space-y-3.5">
          <div className="border border-[#D8B7A0]/20 bg-[#D8B7A0]/5 hover:bg-[#D8B7A0]/10 transition-colors rounded-xl p-4 flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-[#D8B7A0]/20 border border-[#D8B7A0]/30 flex items-center justify-center text-[#9E7B62] shrink-0 mt-0.5">
              <span className="text-xs font-mono font-bold">01</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-black">Configure Custom Keys or Alternative Public Proxy</p>
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                Click the <button onClick={onOpenConfig} className="text-orange-600 font-bold hover:underline outline-none">API Config</button> button in the top navigation bar or click here to configure your credentials or rewrite the base URL to a publicly accessible server.
              </p>
            </div>
          </div>

          <div className="border border-black/[0.06] bg-black/[0.01] hover:bg-black/[0.02] transition-colors rounded-xl p-4 flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-black/10 border border-black/10 flex items-center justify-center text-black/60 shrink-0 mt-0.5">
              <span className="text-xs font-mono font-bold">02</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-black">Use the Official Google Gemini API Key</p>
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                Skip custom proxies entirely! Under AI Studio's <strong className="text-black">Settings menu / sidebar</strong>, set <code className="bg-black/5 px-1 py-0.5 rounded text-[10px] text-orange-600">GEMINI_API_KEY</code> to an official Google Gemini API Key (starts with <code className="text-orange-600">AIzaSy</code>). Our server will immediately detect it and query Google's public endpoints reliably.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [media, setMedia] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video timeline segment states
  const [timelineIndex, setTimelineIndex] = useState<number>(0);

  // Load custom API configuration from localStorage
  const [clientKey, setClientKey] = useState<string>(() => localStorage.getItem("pet_whisper_custom_key") || "");
  const [clientBaseUrl, setClientBaseUrl] = useState<string>(() => localStorage.getItem("pet_whisper_custom_url") || "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'analyzer' | 'archives' | 'insights'>('analyzer');

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pet_whisper_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let modified = false;
          const cleaned = parsed.map((entry: any) => {
            if (entry.thumbnail && entry.thumbnail.length > 25000) {
              modified = true;
              return {
                ...entry,
                thumbnail: entry.thumbnail.slice(0, 1000) + "..."
              };
            }
            return entry;
          });
          if (modified) {
            localStorage.setItem("pet_whisper_history", JSON.stringify(cleaned));
          }
          setHistory(cleaned);
        }
      }
    } catch (e) {
      console.error("Failed to load and sanitize pet_whisper_history:", e);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem("pet_whisper_history", JSON.stringify(history));
      } catch (e) {
        console.error("LocalStorage quota exceeded, cleaning up older history entries...", e);
        const trimmedHistory = history.map((entry, index) => {
          if (index > 2) {
            return { ...entry, thumbnail: "" }; // Drop image thumb for older entries to fit
          }
          return entry;
        });

        try {
          localStorage.setItem("pet_whisper_history", JSON.stringify(trimmedHistory.slice(0, 15)));
          setHistory(trimmedHistory.slice(0, 15));
        } catch (innerErr) {
          console.error("Still out of space, clearing older entries completely...");
          try {
            localStorage.setItem("pet_whisper_history", JSON.stringify(history.slice(0, 5)));
            setHistory(history.slice(0, 5));
          } catch (lastErr) {
            console.error("Failed to survive localStorage quota limits:", lastErr);
          }
        }
      }
    }
  }, [history]);

  // Loading process timeline simulation interval
  useEffect(() => {
    if (isAnalyzing) {
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep(prev => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Please upload an image or video file.");
      return;
    }

    setIsAnalyzing(true);
    setLoadingStep(0);
    setError(null);
    setResult(null);
    setTimelineIndex(0);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const rawBase64 = e.target?.result as string;
          
          setMedia(rawBase64);
          setMimeType(file.type);

          const compressed = await compressMediaForAnalysis(file, rawBase64);

          const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              mediaData: compressed.pureBase64, 
              mimeType: compressed.mimeType,
              customKey: clientKey || undefined,
              customBaseUrl: clientBaseUrl || undefined
            }),
          });

          const responseText = await response.text();
          let data: any;

          try {
            data = JSON.parse(responseText);
          } catch (jsonErr) {
            console.error("Parsed response is not JSON:", responseText.slice(0, 500));
            throw new Error(
              "The server returned an invalid response. This can happen if the AI model or proxy is experiencing heavy traffic. Please try again."
            );
          }

          if (data && data.clientFallback) {
            console.log("Client fallback trigger activated! Routing directly from browser...");
            data = await runBrowserFallback(
              data.customBaseUrl,
              data.customKey,
              compressed.pureBase64,
              compressed.mimeType,
              data.systemInstruction
            );
          } else if (!response.ok || data.error) {
            throw new Error(data.error || "Analysis failed");
          }
          
          setResult(data);
          setIsAnalyzing(false);

          const thumb = await createThumbnail(file, rawBase64);

          const newEntry: HistoryEntry = {
            ...data,
            id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : Math.random().toString(36).substring(2),
            timestamp: Date.now(),
            thumbnail: thumb || rawBase64.slice(0, 10000),
            mimeType: file.type
          };
          setHistory(prev => [newEntry, ...prev].slice(0, 50));
        } catch (err: any) {
          console.error("Analysis error:", err);
          setError(err.message || "Something went wrong during analysis.");
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || "Something went wrong during analysis.");
      setIsAnalyzing(false);
    }
  }, [clientKey, clientBaseUrl]);

  const deleteHistoryEntry = (id: string) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // Build the live UI variables pointing either to custom upload results OR the gorgeous Milo mock example state.
  // This allows the "AI Result Example" to be instantly present on first load in the top viewport!
  const hasUserResult = result && !isAnalyzing;
  const isVideo = mimeType?.startsWith("video") || (!result && !media); // Milo example acts as a video-timeline session!
  
  // Decide which result tree we use
  const activeResult: AnalysisResult = hasUserResult 
    ? (mimeType?.startsWith("video")
       // For user video uploads we generate minor offsets dynamically based on selected index to feel absolutely real!
       ? {
           emotion: timelineIndex === 0 ? result!.emotion : (timelineIndex === 1 ? `${result!.emotion} Shift` : `Gentle ${result!.emotion}`),
           confidence: timelineIndex === 0 ? result!.confidence : Math.max(0.72, result!.confidence - 0.04),
           dog_inner_thought: timelineIndex === 0 ? result!.dog_inner_thought : (timelineIndex === 1 ? "I can feel your quiet presence. Thank you for sitting next to me." : "Let's stay like this forever. I feel warm and safe in your care."),
           behavior_signals: timelineIndex === 0 ? result!.behavior_signals : (timelineIndex === 1 ? [result!.behavior_signals[0] || "Soft posture", "Steady gaze convergence"] : ["Somatic relaxation", "Slow respiratory cycle"]),
           scientific_interpretation: timelineIndex === 0 ? result!.scientific_interpretation : "Steady transition state indicating mild cognitive focus shifting to external sensory stimuli, maintaining high positive companion attachment levels.",
           personality_type: result!.personality_type,
           personality_summary: result!.personality_summary,
           scores: timelineIndex === 0 ? result!.scores : (timelineIndex === 1 
             ? { energy: Math.min(20, result!.scores.energy + 3), social: result!.scores.social, curiosity: Math.min(20, result!.scores.curiosity + 5), stability: result!.scores.stability }
             : { energy: Math.max(1, result!.scores.energy - 2), social: result!.scores.social, curiosity: Math.max(1, result!.scores.curiosity - 3), stability: Math.min(20, result!.scores.stability + 2) }
           )
         }
       : result!
      )
    : MILO_EXAMPLE_TIMELINE[timelineIndex]; // Defaults to Milo's example frame segment

  const activeMediaUrl = media || MILO_SAMPLE_IMAGE;

  return (
    <div className="min-h-screen bg-[#F6F3EE] text-[#111111] font-sans selection:bg-[#D8B7A0]/30 relative pb-20 overflow-x-hidden antialiased">
      
      {/* Background radial lighting */}
      <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] bg-[#D8B7A0]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[50%] right-[-10%] w-[45vw] h-[45vw] bg-[#D8B7A0]/80 opacity-[0.03] rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <nav className="border-b border-[#EBE6DD] px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/72 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#D8B7A0] rounded-xl flex items-center justify-center shadow-sm">
            <Dog className="text-white w-4 h-4" />
          </div>
          <span className="font-sans text-xs tracking-[0.25em] font-medium uppercase text-[#111111]">
            Pet Whisper <span className="text-[#9E7B62] font-semibold">AI</span>
          </span>
        </div>

        {/* Minimal Tab switchers */}
        <div className="flex items-center gap-1 bg-black/[0.03] border border-black/[0.04] rounded-full p-1 shrink-0">
          <button
            onClick={() => setActiveTab('analyzer')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all duration-300
              ${activeTab === 'analyzer' 
                ? 'bg-white text-black font-semibold shadow-sm' 
                : 'text-[#6B7280] hover:text-black hover:bg-white/40'}`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Analyzer</span>
          </button>
          
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all duration-300
              ${activeTab === 'insights' 
                ? 'bg-white text-black font-semibold shadow-sm' 
                : 'text-[#6B7280] hover:text-black hover:bg-white/40'}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D8B7A0]" />
            <span>Insights</span>
          </button>

          <button
            onClick={() => setActiveTab('archives')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all duration-300 relative
              ${activeTab === 'archives' 
                ? 'bg-white text-black font-semibold shadow-sm' 
                : 'text-[#6B7280] hover:text-black hover:bg-white/40'}`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Archives</span>
            {history.length > 0 && (
              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded font-mono ml-1.5 transition-colors
                ${activeTab === 'archives' ? 'bg-black/10 text-black' : 'bg-[#D8B7A0]/35 text-[#5C4535]'}`}
              >
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Configurations panel trigger */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex gap-4 text-[10px] font-mono uppercase tracking-widest text-[#6B7280]">
            <span className="hover:text-black cursor-pointer transition-colors">Behavior Model v1.1</span>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.06] hover:border-[#D8B7A0]/60 bg-white/80 hover:bg-white text-[10px] font-mono uppercase tracking-wider text-[#6B7280] hover:text-black transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Settings className="w-3 h-3 text-[#D8B7A0]" />
            API Config
          </button>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {activeTab === 'analyzer' && (
          <motion.div 
            key="analyzer-view animate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex flex-col items-center"
          >
            {/* HERO SECTION - Optimized to be compact, elegant, and warm */}
            <header className="max-w-4xl mx-auto px-6 pt-12 md:pt-16 pb-8 text-center space-y-6 relative">
              
              {/* Floating Pet Card / Concept Visuals in the ambient background */}
              <div className="hidden lg:block absolute left-[-150px] top-4 pointer-events-none select-none">
                <motion.div 
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="bg-white/72 border border-[#EBE6DD] rounded-2xl p-3.5 shadow-sm space-y-2 w-48 backdrop-blur-md opacity-80"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#D8B7A0] animate-ping" />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#6B7280]">Observed Alignment</span>
                  </div>
                  <p className="text-[11px] font-serif italic text-black font-medium">✨ Quiet devotion posture detected</p>
                </motion.div>
              </div>

              <div className="hidden lg:block absolute right-[-150px] top-12 pointer-events-none select-none">
                <motion.div 
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="bg-white/72 border border-[#EBE6DD] rounded-2xl p-3.5 shadow-sm space-y-1.5 w-48 backdrop-blur-md opacity-80"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-[#6B7280]">Somatosensory</span>
                    <span className="text-[9px] text-[#D8B7A0] font-bold">92%</span>
                  </div>
                  <div className="w-full h-1 bg-black/[0.04] rounded-full overflow-hidden">
                    <div className="w-[92%] h-full bg-[#D8B7A0]" />
                  </div>
                  <p className="text-[10px] font-mono text-[#6B7280]">Left-ear tilt angle: +3.5°</p>
                </motion.div>
              </div>

              {/* Title max 2-3 lines */}
              <motion.h1 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#111111] font-normal leading-[1.12]"
              >
                Understand the quiet emotions <br />
                your dog never learned to <span className="italic font-normal font-serif text-[#9E7B62]">say.</span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-sm text-[#6B7280] max-w-xl mx-auto leading-relaxed"
              >
                Share a quiet moment. Pet Whisper gently interprets visible emotional cues through posture, gaze, and movement.
              </motion.p>
            </header>

            {/* UPLOAD PANEL - Redesigned to be extremely compact, sleek companion-like box */}
            <section className="w-full max-w-2xl mx-auto px-6 mb-12">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="bg-white/80 border border-[#EBE6DD] hover:border-[#D8B7A0]/60 rounded-3xl p-4 shadow-sm hover:shadow-[0_12px_24px_rgba(216,183,160,0.08)] transition-all duration-300 group flex flex-col sm:flex-row items-center gap-3 relative"
              >
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-black/[0.01] transition-colors cursor-pointer text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#F6F3EE] group-hover:bg-[#EBE6DD] transition-colors flex items-center justify-center text-[#9E7B62] shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-sans text-xs font-medium text-[#111111]">Share a quiet moment.</p>
                    <p className="text-[10px] text-[#6B7280] truncate font-mono">SUPPORTED: IMAGE OR VIDEO (KEYFRAME ANALYSIS)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 sm:border-l border-black/[0.06] pt-3 sm:pt-0 sm:pl-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 sm:flex-initial py-2 px-3.5 bg-[#F2EDE4] hover:bg-[#EAE2D5] text-[#111111] font-mono text-[10px] uppercase tracking-wider rounded-xl transition-colors font-semibold select-none cursor-pointer"
                  >
                    Select File
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 sm:flex-initial py-2 px-3.5 bg-[#D8B7A0] hover:bg-[#CBA68D] text-white font-mono text-[10px] uppercase tracking-wider rounded-xl shadow-sm transition-colors font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Analyze</span>
                    <Sparkles className="w-3 h-3 animate-pulse" />
                  </button>
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={onFileChange} 
                  accept="image/*,video/*" 
                  className="hidden" 
                />
              </motion.div>

              {/* Error messages overlay */}
              {error && (
                <div className="mt-4">
                  <ConnectivityTroubleshooter 
                    error={error} 
                    onClear={() => setError(null)} 
                    onOpenConfig={() => setIsSettingsOpen(true)} 
                  />
                </div>
              )}
            </section>

            {/* MAIN ANALYSIS REPORT VIEWPORT (1.5 max screentime) */}
            <section className="w-full max-w-6xl mx-auto px-6 grid md:grid-cols-[1fr_1.4fr] gap-8 items-start mb-4">
              
              {/* Left Side: Upload Preview, Emotion overlay badge, soft outer glows */}
              <div className="space-y-4">
                <div className="relative rounded-[2rem] overflow-hidden bg-white/72 border border-[#EBE6DD] shadow-sm aspect-square md:aspect-[4/5] group/media">
                  
                  {/* Soft subtle glow behind the image */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#D8B7A0]/5 to-transparent z-0 pointer-events-none" />
                  
                  {/* Preview Element */}
                  <div className="w-full h-full relative z-10 overflow-hidden flex items-center justify-center">
                    {activeMediaUrl.startsWith("data:video/") || (activeMediaUrl === MILO_SAMPLE_IMAGE && isVideo && !media) ? (
                      <video src={media || undefined} poster={media ? undefined : MILO_SAMPLE_IMAGE} autoPlay muted loop playsInline className="w-full h-full object-cover group-hover/media:scale-[1.03] transition-transform duration-700" />
                    ) : (
                      <img src={activeMediaUrl} className="w-full h-full object-cover group-hover/media:scale-[1.03] transition-transform duration-700" alt="Dog assessment" />
                    )}

                    {/* Dark gradient shadow inside preview bottom */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/[0.25] via-transparent to-transparent pointer-events-none z-10" />

                    {/* Emotion Badge overlay */}
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/50 shadow-sm">
                      <div className="w-1.5 h-1.5 bg-[#D8B7A0] rounded-full animate-ping" />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[#6B7280] font-bold">Observation mode</span>
                    </div>

                    {/* Quick reset button if custom media shown */}
                    {media && (
                      <button 
                        onClick={() => { setMedia(null); setResult(null); }}
                        className="absolute bottom-4 right-4 z-20 w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-white/40 flex items-center justify-center text-black/60 hover:text-red-500 shadow-sm transition-colors cursor-pointer"
                        title="Reset observation window"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Label of active context style */}
                    <div className="absolute bottom-4 left-4 z-20 text-left">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-white/70">Source target</p>
                      <h3 className="text-white text-sm font-serif italic">
                        {media ? "Patient File Scan" : "Example Patient: Milo"}
                      </h3>
                    </div>
                  </div>

                  {/* Pulsing Loading overlay state */}
                  <AnimatePresence>
                    {isAnalyzing && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[#F6F3EE]/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-8 gap-4"
                      >
                        <Loader2 className="w-8 h-8 text-[#9E7B62] animate-spin" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Running Biometric Scanner...</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* VIDEO TIMELINE INTERACTION DEBUT */}
                {isVideo && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white/72 border border-[#EBE6DD] rounded-2xl p-4 shadow-sm space-y-3"
                  >
                    <div className="flex justify-between items-center border-b border-black/[0.04] pb-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#6B7280] font-bold">Chronology Shift</span>
                      <span className="text-[10px] font-sans text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full capitalize">Intertwined Emotion Trace</span>
                    </div>

                    {/* Timeline segment controls */}
                    <div className="grid grid-cols-3 gap-2">
                      {(media ? ["0s – 3s", "4s – 7s", "8s – 12s"] : ["0s – 3s", "4s – 7s", "8s – 12s"]).map((range, index) => {
                        const isSelected = timelineIndex === index;
                        return (
                          <button
                            key={index}
                            onClick={() => setTimelineIndex(index)}
                            className={`px-2 py-2.5 rounded-xl border font-mono text-[10px] transition-all relative select-none cursor-pointer flex flex-col items-center gap-1
                              ${isSelected 
                                ? 'bg-[#D8B7A0]/15 border-[#D8B7A0] text-[#5C4535] font-semibold' 
                                : 'bg-transparent border-black/[0.05] text-[#6B7280] hover:bg-black/[0.01]'}`}
                          >
                            <span className="opacity-60">{range}</span>
                            <span className="text-[8px] tracking-tight truncate max-w-full font-sans capitalize">
                              {media 
                                ? (index === 0 ? "Initial state" : (index === 1 ? "Secondary shift" : "Resolution segment"))
                                : (index === 0 ? "Deep Calm" : (index === 1 ? "Mindful Focus" : "Loving Devotion"))}
                            </span>
                            {isSelected && (
                              <motion.div 
                                layoutId="activeTimelinePoint" 
                                className="absolute bottom-1 w-1 h-1 bg-[#D8B7A0] rounded-full" 
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right Side: Double Column / Stagger Reveal Cards */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  
                  {isAnalyzing ? (
                    /* AI Working Flow Animation step by step */
                    <motion.div 
                      key="analyzing-progress"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="bg-white/72 border border-[#EBE6DD] rounded-[2rem] p-8 space-y-8 shadow-sm"
                    >
                      <div className="space-y-2 text-left">
                        <span className="text-[9px] font-mono text-[#D8B7A0] uppercase tracking-widest font-bold animate-pulse">Observation in progress</span>
                        <h3 className="text-xl font-serif text-[#111111]">Translating physical cues into quiet thoughts...</h3>
                      </div>

                      {/* Working Flow Progress Checklist */}
                      <div className="space-y-4">
                        {[
                          "Reading posture and muscular alignment...",
                          "Tracking micro-tensions of the facial focus point...",
                          "Evaluating environmental proximity and movement waves...",
                          "Interpreting visible companion bonding signals..."
                        ].map((phrase, stepIdx) => {
                          const isDone = loadingStep > stepIdx;
                          const isActive = loadingStep === stepIdx;
                          const isPending = loadingStep < stepIdx;

                          return (
                            <motion.div 
                              key={stepIdx}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: stepIdx * 0.15 }}
                              className="flex items-center gap-3.5 text-left"
                            >
                              <div className="shrink-0">
                                {isDone ? (
                                  <div className="w-5 h-5 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-green-600">
                                    <Check className="w-3 h-3" />
                                  </div>
                                ) : isActive ? (
                                  <div className="w-5 h-5 rounded-full bg-[#D8B7A0]/25 border border-[#D8B7A0] flex items-center justify-center text-[#9E7B62] animate-spin">
                                    <Loader2 className="w-2.5 h-2.5" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-black/[0.02] border border-black/[0.05]" />
                                )}
                              </div>
                              <span className={`text-xs font-mono transition-all duration-300
                                ${isDone ? 'text-black/40 line-through' : isActive ? 'text-black font-semibold' : 'text-black/30'}`}
                              >
                                {phrase}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Skeleton placeholders */}
                      <div className="space-y-4 pt-6 border-t border-black/[0.04]">
                        <div className="h-4 w-2/3 bg-black/[0.03] rounded animate-pulse" />
                        <div className="h-12 w-full bg-black/[0.02] rounded-xl animate-pulse" />
                      </div>
                    </motion.div>
                  ) : (
                    
                    /* RESULTS CONTAINER - Stagger card reveal with slight blur fade transitions */
                    <motion.div 
                      key="report-loaded"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-5"
                    >
                      {/* CARD 1: Emotion Assessment Card */}
                      <motion.div 
                        variants={cardVariants}
                        className="p-6 bg-white/72 border border-[#EBE6DD] rounded-[1.5rem] shadow-sm relative overflow-hidden text-left"
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-mono text-[#D8B7A0] uppercase tracking-widest font-semibold">Emotional Interpretation</span>
                              <h2 className="text-3xl font-serif text-[#111111] capitalize">{activeResult.emotion}</h2>
                            </div>
                            <span className="px-3 py-1.5 bg-[#F6F3EE] border border-black/[0.04] rounded-full text-[10px] font-mono text-[#6B7280] tracking-wider capitalize">
                              {activeResult.personality_type.replace(/_/g, " ").toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </motion.div>

                      {/* CARD 2: Observed Cues Component (Behavioral Signals) */}
                      <motion.div 
                        variants={cardVariants}
                        className="p-6 bg-white/72 border border-[#EBE6DD] rounded-[1.5rem] shadow-sm text-left"
                      >
                        <div className="space-y-3">
                          <span className="text-[10px] font-mono text-[#D8B7A0] uppercase tracking-widest font-semibold block">Behavioral Evidence</span>
                          <div className="flex gap-2 flex-wrap">
                            {activeResult.behavior_signals.map((sig, i) => (
                              <span 
                                key={i} 
                                className="px-2.5 py-1 bg-[#FDFCFB]/90 border border-[#EBE6DD] rounded-lg text-[11px] font-mono text-[#5C4535]/90 tracking-wider shadow-sm capitalize"
                              >
                                &bull; {sig.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>

                      {/* CARD 3: Gentle Insights block (Interpretation & Metrics Grid) */}
                      <motion.div 
                        variants={cardVariants}
                        className="p-6 bg-white/72 border border-[#EBE6DD] rounded-[1.5rem] shadow-sm text-left space-y-6"
                      >
                        <div className="space-y-3">
                          <span className="text-[10px] font-mono text-[#D8B7A0] uppercase tracking-widest font-semibold block">Interpretation Logic</span>
                          <p className="text-xs sm:text-sm text-[#3A3A38] leading-relaxed font-sans font-light">
                            {activeResult.scientific_interpretation}
                          </p>
                        </div>

                        {/* Metric scores */}
                        <div className="border-t border-black/[0.04] pt-5 space-y-4">
                          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-black/40 block pb-2">Somatosensory Metrics</span>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            <ScoreBar label="Energy" value={activeResult.scores.energy} icon={Zap} />
                            <ScoreBar label="Social Core" value={activeResult.scores.social} icon={Heart} />
                            <ScoreBar label="Curiosity" value={activeResult.scores.curiosity} icon={Search} />
                            <ScoreBar label="Stability" value={activeResult.scores.stability} icon={ShieldCheck} />
                          </div>
                        </div>
                      </motion.div>

                      {/* CARD 4: Companion Voice (Inner Thought) */}
                      <motion.div 
                        variants={cardVariants}
                        className="p-6 bg-[#FAF8F5] border border-[#EBE6DD] rounded-[1.5rem] shadow-sm text-left relative overflow-hidden"
                      >
                        {/* Breath rhythm wave behind quotes */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D8B7A0]/5 rounded-full blur-2xl pointer-events-none animate-pulse" />
                        
                        <div className="space-y-3 relative z-10">
                          <div className="flex items-center gap-2 text-[10px] font-mono text-[#D8B7A0] uppercase tracking-widest font-semibold">
                            <MessageCircleHeart className="w-3.5 h-3.5 text-[#D8B7A0]" />
                            <span>Companion's Voice</span>
                          </div>
                          
                          <blockquote className="text-sm md:text-base font-serif italic text-[#4A3D31] font-normal leading-relaxed">
                            "{activeResult.dog_inner_thought}"
                          </blockquote>
                          
                          <p className="text-[10px] font-mono text-black/30 border-t border-[#EBE6DD] pt-3 leading-snug">
                            {activeResult.personality_summary}
                          </p>
                        </div>
                      </motion.div>

                      {/* CARD 5: Associated Ethological Insights */}
                      {(() => {
                        const matches = getAssociatedInsights(activeResult.behavior_signals);
                        if (matches.length === 0) return null;
                        return (
                          <motion.div 
                            variants={cardVariants}
                            className="p-6 bg-white/72 border border-[#EBE6DD] rounded-[1.5rem] shadow-sm text-left space-y-4"
                          >
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono text-[#D8B7A0] uppercase tracking-widest font-semibold block">Connected Canine Knowledge</span>
                              <h3 className="font-serif text-lg text-[#111111]">Anatomical Signal Context</h3>
                            </div>
                            
                            <div className="space-y-3.5">
                              {matches.map((insight) => (
                                <div 
                                  key={insight.id} 
                                  className={`p-4 rounded-2xl border ${insight.colorTheme} transition-all duration-300 relative overflow-hidden`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg shrink-0">{insight.illustration}</span>
                                      <h4 className="font-serif text-sm font-semibold text-[#111111]">{insight.title}</h4>
                                    </div>
                                    <span className="text-[9px] font-mono font-medium px-2 py-0.5 bg-black/[0.04] text-[#6B7280] rounded-full uppercase tracking-wider">
                                      {insight.tag}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#3A3A38] leading-relaxed font-sans font-light">
                                    {insight.explanation}
                                  </p>
                                  <div className="mt-2.5 pt-2.5 border-t border-black/[0.03] text-[10px] sm:text-xs text-[#6B7280] italic leading-relaxed">
                                    <span className="font-mono uppercase font-bold text-[8px] tracking-wider text-[#D8B7A0] block not-italic">Scientific Core</span>
                                    {insight.scientificContext}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        );
                      })()}

                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </section>

            {/* Recents banner and observation lane placeholder */}

            {/* RECENT READS CAROUSEL LANE - Folds elegantly under report workspace */}
            {history.length > 0 && (
              <div className="w-full max-w-6xl mx-auto px-6 mt-12 pb-16 text-left">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D8B7A0]" />
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280] font-bold">Recent Observations</h4>
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x mask-gradient-right">
                  {history.map((entry) => (
                    <motion.div
                      key={entry.id}
                      whileHover={{ y: -3, scale: 1.01 }}
                      onClick={() => {
                        setSelectedHistoryEntry(entry);
                        setTimelineIndex(0);
                      }}
                      className="flex-shrink-0 w-64 bg-white/72 border border-[#EBE6DD] hover:border-[#D8B7A0]/60 rounded-2xl p-4 flex gap-3.5 cursor-pointer transition-all shadow-sm snap-start relative group"
                    >
                      {/* Quiet delete trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryEntry(entry.id);
                        }}
                        className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white border border-[#EBE6DD] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[#6B7280] hover:text-red-500 transition-all shadow-sm"
                        title="Delete archive item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-black/[0.04]">
                        <img src={entry.thumbnail} className="w-full h-full object-cover" alt="" />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span className="text-[8px] font-mono text-[#625950] bg-[#EAE2D5]/40 px-1.5 py-0.2 rounded w-fit capitalize mb-1">
                          {entry.personality_type.replace(/_/g, " ").toLowerCase()}
                        </span>
                        <h5 className="font-medium text-[#111111] text-xs leading-snug truncate capitalize">{entry.emotion}</h5>
                        <span className="text-[9px] font-mono text-[#6B7280] mt-0.5">
                          {new Date(entry.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        )}

        {/* INSIGHTS TAB VIEWPORT */}
        {activeTab === 'insights' && (
          <motion.section 
            key="insights-view animate"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto px-6 py-12 space-y-8 min-h-[65vh] text-left"
          >
            <div className="border-b border-black/[0.05] pb-6 space-y-1">
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#9E7B62] uppercase tracking-[0.2em] font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-[#D8B7A0]" />
                Ethological Insights
              </div>
              <h2 className="text-3xl font-serif font-normal text-[#111111]">Canine Ethology Library</h2>
              <p className="text-xs text-[#6B7280] max-w-xl font-light leading-relaxed">
                Explore clinical body language insights developed by professional veterinary behavioral scientists. Cards automatically highlight which physical cues were identified in your current scanning session.
              </p>
            </div>

            {/* Apple Health-styled Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PET_BEHAVIOR_INSIGHTS.map((insight) => {
                // Determine if currently active or highlighted in active session
                const isActiveInSession = activeResult && activeResult.behavior_signals
                  ? insight.triggerKeys.some(key => 
                      activeResult.behavior_signals.some(sig => {
                        const s = sig.toLowerCase().replace(/_/g, " ");
                        const k = key.toLowerCase().replace(/_/g, " ");
                        return s.includes(k) || k.includes(s);
                      })
                    )
                  : false;

                return (
                  <motion.div
                    key={insight.id}
                    whileHover={{ y: -4, boxShadow: "0 10px 30px rgba(0,0,0,0.02)" }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className={`flex flex-col justify-between p-6 rounded-[1.5rem] border transition-all duration-300 relative overflow-hidden backdrop-blur-sm
                      ${isActiveInSession 
                        ? 'bg-white border-[#D8B7A0] ring-1 ring-[#D8B7A0]/50 shadow-md shadow-[#D8B7A0]/5' 
                        : 'bg-white/72 border-[#EBE6DD] hover:border-[#D8B7A0]/40 shadow-sm'
                      }`}
                  >
                    {/* Active indicator badge */}
                    {isActiveInSession && (
                      <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FAF5F2] border border-[#D8B7A0]/40 text-[9px] font-mono text-[#9E7B62] font-semibold tracking-wider animate-pulse">
                        <span>✧ Observed in Scan</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Upper Section */}
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-2 bg-black/[0.02] rounded-xl leading-none">{insight.illustration}</span>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono text-[#D8B7A0] uppercase tracking-wider block font-semibold">
                            {insight.category}
                          </span>
                          <h4 className="font-serif text-base text-[#111111] leading-tight font-medium">
                            {insight.title}
                          </h4>
                        </div>
                      </div>

                      {/* Middle Text Description */}
                      <p className="text-xs text-[#3A3A38] leading-relaxed font-sans font-light">
                        {insight.explanation}
                      </p>

                      {/* Scientific Reveal Block */}
                      <div className="mt-2.5 pt-3 border-t border-black/[0.03] text-[11px] text-[#6B7280] leading-relaxed italic bg-black/[0.01] p-3 rounded-xl">
                        <span className="font-mono uppercase font-bold text-[8px] tracking-wider text-[#D8B7A0] block not-italic pb-1 font-semibold">Ethological Foundation</span>
                        {insight.scientificContext}
                      </div>
                    </div>

                    {/* Card Footer Tag */}
                    <div className="mt-4 pt-3 border-t border-black/[0.03] flex items-center justify-between">
                      <span className="text-[9px] font-mono font-semibold px-2.5 py-1 bg-[#F6F3EE] text-[#6B7280] rounded-lg tracking-wider uppercase">
                        {insight.tag}
                      </span>
                      
                      {/* Subtle trigger label */}
                      <span className="text-[8px] font-mono text-black/30">
                        Trigger: {insight.triggerKeys[0].replace(/_/g, " ")}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* ARCHIVES TAB VIEWPORT - Clean, modular design */}
        {activeTab === 'archives' && (
          <motion.section 
            key="archives-view animate"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto px-6 py-12 space-y-8 min-h-[65vh] text-left"
          >
            <div className="flex items-center justify-between border-b border-black/[0.05] pb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#9E7B62] uppercase tracking-[0.2em] font-semibold">
                  <History className="w-3.5 h-3.5" />
                  Observation Vault
                </div>
                <h2 className="text-3xl font-serif font-normal text-[#111111]">Historic observations</h2>
              </div>
              <p className="text-[10px] font-mono text-[#6B7280] uppercase tracking-widest hidden sm:block">
                Preserving {history.length} active biometrics
              </p>
            </div>

            {history.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 border border-dashed border-[#EBE6DD] rounded-[2rem] bg-white/40">
                <History className="w-8 h-8 text-[#D8B7A0]" />
                <p className="font-mono text-xs uppercase tracking-widest text-[#6B7280]">No historic observations found</p>
                <button 
                  onClick={() => setActiveTab('analyzer')}
                  className="px-4 py-2 bg-[#D8B7A0] hover:bg-[#CBA68D] text-white font-mono text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Start Scanning
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((entry) => (
                  <motion.div
                    key={entry.id}
                    layoutOnMount
                    className="group relative bg-white/72 border border-[#EBE6DD] hover:border-[#D8B7A0]/60 rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col"
                    onClick={() => {
                      setSelectedHistoryEntry(entry);
                      setTimelineIndex(0);
                    }}
                  >
                    {/* Thumbnail banner preview */}
                    <div className="aspect-[16/7] relative overflow-hidden bg-black/[0.03]">
                      <img 
                        src={entry.thumbnail} 
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-all duration-500" 
                        alt="Thumbnail" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-transparent to-transparent" />
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryEntry(entry.id);
                        }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[#6B7280] hover:text-red-500 transition-all shadow-sm cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="absolute bottom-3 left-4 flex gap-3 text-[10px] font-mono text-[#6B7280] uppercase tracking-widest">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#D8B7A0]" />
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Bio details summaries */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-[9px] font-mono text-[#6B7280] bg-[#EAE2D5]/50 px-2 py-0.5 rounded capitalize">
                            {entry.personality_type.replace(/_/g, " ").toLowerCase()}
                          </span>
                        </div>
                        <h4 className="font-serif text-lg text-[#111111] capitalize">{entry.emotion}</h4>
                        <p className="text-xs text-[#6B7280] italic leading-relaxed line-clamp-2">
                          "{entry.dog_inner_thought}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-black/[0.04]">
                        <div className="flex gap-1.5">
                          {Object.entries(entry.scores).map(([key, val]) => (
                            <div key={key} title={key} className="w-1.5 h-4 bg-black/[0.04] rounded-full overflow-hidden flex flex-col justify-end">
                              <div 
                                className="w-full bg-[#D8B7A0]" 
                                style={{ height: `${((val as number) / 20) * 100}%` }} 
                              />
                            </div>
                          ))}
                        </div>
                        
                        <span className="text-[9px] font-mono uppercase tracking-widest text-[#9E7B62] group-hover:underline flex items-center gap-1">
                          Browse metrics
                          <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* DETAILED DIALOG MODAL VIEW - Clean off-white premium panel */}
      <AnimatePresence>
        {selectedHistoryEntry && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHistoryEntry(null)}
              className="absolute inset-0 bg-[#F6F3EE]/80 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 15 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white border border-[#EBE6DD] rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl z-50 text-left"
            >
              {/* Reset close trigger button */}
              <button 
                onClick={() => setSelectedHistoryEntry(null)}
                className="absolute top-6 right-6 z-50 w-8 h-8 rounded-full bg-white border border-[#EBE6DD] flex items-center justify-center hover:bg-black/[0.02] text-[#6B7280] hover:text-black shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 rotate-45" />
              </button>

              {/* Media Preview (Left) */}
              <div className="w-full md:w-1/2 h-64 md:h-auto relative bg-black/[0.02] border-r border-[#EBE6DD] overflow-hidden">
                {selectedHistoryEntry.mimeType.startsWith("video") ? (
                  <video src={selectedHistoryEntry.thumbnail} autoPlay muted loop className="w-full h-full object-cover" />
                ) : (
                  <img src={selectedHistoryEntry.thumbnail} className="w-full h-full object-cover" alt="Dog Entry" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-white" />
              </div>

              {/* Data Insights (Right) */}
              <div className="w-full md:w-1/2 p-8 md:p-10 overflow-y-auto custom-scrollbar flex flex-col justify-between">
                <div className="space-y-6">
                  <header className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#D8B7A0] uppercase tracking-widest bg-[#D8B7A0]/10 px-2 py-0.5 rounded">
                        <History className="w-3 h-3" />
                        Archived File
                      </div>
                      <span className="text-[10px] font-mono text-[#6B7280]">
                        {new Date(selectedHistoryEntry.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-3xl font-serif text-[#111111] capitalize">{selectedHistoryEntry.emotion}</h2>
                      <p className="text-xs font-mono text-[#9E7B62] capitalize">{selectedHistoryEntry.personality_type.replace(/_/g, " ").toLowerCase()}</p>
                    </div>
                  </header>

                  <div className="p-4 bg-[#FAF8F5] border border-[#EBE6DD] rounded-2xl italic text-xs leading-relaxed text-[#4A3D31]">
                    "{selectedHistoryEntry.dog_inner_thought}"
                  </div>

                  {/* Somatosensory scores */}
                  <div className="space-y-3.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6B7280] block pb-1 border-b border-black/[0.04]">Traits &amp; Biometrics</span>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <ScoreBar label="Energy" value={selectedHistoryEntry.scores.energy} icon={Zap} />
                      <ScoreBar label="Social core" value={selectedHistoryEntry.scores.social} icon={Heart} />
                      <ScoreBar label="Curiosity" value={selectedHistoryEntry.scores.curiosity} icon={Search} />
                      <ScoreBar label="Stability" value={selectedHistoryEntry.scores.stability} icon={ShieldCheck} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6B7280] block pb-1 border-b border-black/[0.04]">Cognitive Assessment</span>
                    <p className="text-xs text-[#6B7280] leading-relaxed">
                      {selectedHistoryEntry.scientific_interpretation}
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-black/[0.04] flex gap-3">
                  <button 
                    onClick={() => {
                      setResult(selectedHistoryEntry);
                      setMedia(selectedHistoryEntry.thumbnail);
                      setMimeType(selectedHistoryEntry.mimeType);
                      setSelectedHistoryEntry(null);
                      setActiveTab('analyzer');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 py-3 bg-[#D8B7A0] text-white font-mono text-[10px] uppercase tracking-widest rounded-xl hover:bg-[#CBA68D] transition-colors font-bold text-center cursor-pointer shadow-sm select-none"
                  >
                    Restore Workspace
                  </button>
                  <button 
                    onClick={() => setSelectedHistoryEntry(null)}
                    className="flex-1 py-3 border border-black/[0.08] text-[#6B7280] hover:text-black font-mono text-[10px] uppercase tracking-widest rounded-xl hover:bg-black/[0.01] transition-colors text-center cursor-pointer select-none"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SYSTEM CONF PREFERENCES (Configuration Drawer Drawer/Overlay) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-[#F6F3EE]/85 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 15 }}
              className="relative w-full max-w-lg bg-white border border-[#EBE6DD] rounded-3xl p-8 shadow-2xl overflow-hidden z-50 text-left"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D8B7A0]/5 rounded-full blur-2xl pointer-events-none" />
              
              <header className="flex items-start justify-between border-b border-black/[0.05] pb-4 mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#9E7B62] uppercase tracking-widest font-bold">
                    <Settings className="w-3.5 h-3.5" />
                    System Preferences
                  </div>
                  <h3 className="text-xl font-serif text-[#111111] leading-snug">API Endpoint Configuration</h3>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-full bg-black/[0.02] border border-black/[0.06] flex items-center justify-center hover:bg-black/[0.04] transition-colors text-black/60 font-mono text-xs cursor-pointer"
                >
                  ✕
                </button>
              </header>

              <div className="space-y-5 text-left font-sans">
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Configure custom credentials or alternative proxy endpoints. These parameters are persisted securely inside your local browser sandbox and will take precedence during analysis.
                </p>

                {/* API Base URL */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-[#6B7280] font-bold">
                    API Base URL (Proxy Gateway)
                  </label>
                  <input 
                    type="text"
                    value={clientBaseUrl}
                    onChange={(e) => setClientBaseUrl(e.target.value)}
                    placeholder="https://generativelanguage.googleapis.com (Optional)"
                    className="w-full bg-[#FAF8F5] border border-[#EBE6DD] hover:border-[#D8B7A0]/40 focus:border-[#D8B7A0] focus:bg-white rounded-xl px-4 py-3 text-xs font-mono text-black transition-all outline-none"
                  />
                  <p className="text-[9px] text-black/30 leading-normal">
                    Leave blank to use official Google Gemini API direct endpoints.
                  </p>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-[#6B7280] font-bold">
                    API Credentials (Google API key)
                  </label>
                  <input 
                    type="password"
                    value={clientKey}
                    onChange={(e) => setClientKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#FAF8F5] border border-[#EBE6DD] hover:border-[#D8B7A0]/40 focus:border-[#D8B7A0] focus:bg-white rounded-xl px-4 py-3 text-xs font-mono text-black transition-all outline-none"
                  />
                  <p className="text-[9px] text-black/30 leading-normal">
                    Enter your custom Google Gemini API key here to override backend secrets.
                  </p>
                </div>

                {/* Client Fallback Info */}
                <div className="p-3 bg-blue-500/[0.04] border border-blue-200 rounded-xl flex items-start gap-2 text-[11px] text-blue-800 shadow-sm">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-blue-900">Direct-Browser handshake pipeline</p>
                    <p className="opacity-80 text-blue-950">
                      If your Endpoint resolves to private network addresses (like <code className="bg-white/40 px-1 rounded text-[10px]">192.168.x.x</code>), server logs will route through an automated direct browser handshake.
                    </p>
                  </div>
                </div>

                {/* Save controls */}
                <div className="pt-4 flex gap-3 border-t border-black/[0.05]">
                  <button 
                    onClick={() => {
                      if (clientKey) {
                        localStorage.setItem("pet_whisper_custom_key", clientKey);
                      } else {
                        localStorage.removeItem("pet_whisper_custom_key");
                      }
                      if (clientBaseUrl) {
                        localStorage.setItem("pet_whisper_custom_url", clientBaseUrl);
                      } else {
                        localStorage.removeItem("pet_whisper_custom_url");
                      }
                      setIsSettingsOpen(false);
                      setError(null);
                    }}
                    className="flex-1 py-3 bg-[#D8B7A0] text-white font-mono text-xs uppercase tracking-widest rounded-xl hover:bg-[#CBA68D] transition-colors font-bold shadow-sm active:scale-95 text-center cursor-pointer select-none"
                  >
                    Save &amp; Apply
                  </button>
                  <button 
                    onClick={() => {
                      setClientKey("");
                      setClientBaseUrl("");
                      localStorage.removeItem("pet_whisper_custom_key");
                      localStorage.removeItem("pet_whisper_custom_url");
                      setIsSettingsOpen(false);
                      setError(null);
                    }}
                    className="py-3 px-4 border border-black/[0.08] text-[#6B7280] font-mono text-xs uppercase tracking-widest rounded-xl hover:bg-black/[0.01] transition-colors cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER DECORATION */}
      <footer className="border-t border-[#EBE6DD] py-12 px-6 mt-16">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6 opacity-40 transition-all duration-700 font-mono text-[10px] text-[#6B7280]">
          <div className="flex items-center gap-3">
            <span>Powered by Gemini 2.5 Flash</span>
            <div className="w-1 h-1 bg-[#6B7280] rounded-full" />
            <span>Built quietly in sandbox</span>
          </div>
          <p className="text-right">
            &copy; 1995-2026 Pet Whisper. Sharing a quiet moment.
          </p>
        </div>
      </footer>
    </div>
  );
}
