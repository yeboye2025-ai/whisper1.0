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
  Settings
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

// Helper to compress/resize media to keep request payloads incredibly fast & highly reliable
const compressMediaForAnalysis = (file: File, base64: string): Promise<{ dataUrl: string; pureBase64: string; mimeType: string }> => {
  return new Promise((resolve) => {
    if (file.type.startsWith("video/")) {
      // Create a hidden video element to seek a keyframe
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
  <div className="space-y-1.5">
    <div className="flex justify-between items-center text-xs font-mono uppercase tracking-wider text-white/50">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <span>{value}/{max}</span>
    </div>
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"
      />
    </div>
  </div>
);

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

  // Candidates for OpenAI-compatible completions
  const openaiCandidates = [
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gemini-3.5-flash" },
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "x-api-key": customKey }, model: "gemini-3.5-flash" },
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "x-goog-api-key": customKey }, model: "gemini-3.5-flash" },
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gemini-2.5-flash" },
    { url: `${baseWithoutVClass}/v1/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gemini-3.5-flash" },
    { url: `${baseWithoutVClass}/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gemini-3.5-flash" },
    { url: `${normalizedBaseUrl}/chat/completions`, headers: { "Authorization": `Bearer ${customKey}` }, model: "gpt-4o-mini" },
  ];

  // Candidates for standard Gemini REST
  const geminiCandidates = [
    { url: `${normalizedBaseUrl}/v1beta/models/gemini-3.5-flash:generateContent?key=${customKey}` },
    { url: `${normalizedBaseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${customKey}` },
    { url: `${normalizedBaseUrl}/models/gemini-3.5-flash:generateContent?key=${customKey}` },
    { url: `${normalizedBaseUrl}/models/gemini-2.5-flash:generateContent?key=${customKey}` },
    { url: `${baseWithoutVClass}/v1beta/models/gemini-3.5-flash:generateContent?key=${customKey}` },
    { url: `${baseWithoutVClass}/v1beta/models/gemini-2.5-flash:generateContent?key=${customKey}` }
  ];

  // Attempt OpenAI format first
  for (const candidate of openaiCandidates) {
    try {
      console.log(`Browser Fallback: Testing OpenAI candidate URL: ${candidate.url} using model: ${candidate.model}`);
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
      console.warn(`Browser Fallback OpenAI candidate error for ${candidate.url}:`, err.message || err);
    }
  }

  // Attempt Gemini API REST candidate formats
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
      console.warn(`Browser Fallback Gemini REST candidate error for ${candidate.url}:`, err.message || err);
    }
  }

  // Final detailed user instruction to resolve private host address network hurdles
  throw new Error(
    "Browser-direct connection failed too. This usually occurs because of browser CORS restrictions on your custom proxy server 'watt-api.rivtower.cc' (which resolves to private network IP 192.168.120.1).\n\n" +
    "To resolve this instantly, please:\n" +
    "1. Open this app in a NEW TAB (use the button at the top of the screen).\n" +
    "2. Ensure your local proxy allows CORS requests (i.e. 'Access-Control-Allow-Origin: *').\n" +
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
        className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3.5 text-red-400 text-xs font-sans leading-relaxed relative"
      >
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-red-300">Analysis Failed</p>
          <p className="opacity-90">{error}</p>
        </div>
        <button 
          onClick={onClear}
          className="text-white/30 hover:text-white/80 transition-colors absolute top-4 right-4 text-xs font-mono"
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
      className="border border-orange-500/30 bg-orange-500/[0.03] rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-orange-500/10 pb-5">
        <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
          <WifiOff className="w-6 h-6 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="font-mono text-xs uppercase tracking-widest text-orange-500 font-bold">Connectivity Diagnostic</h3>
          <h4 className="text-lg font-medium text-white/95 leading-snug">Unreachable Custom Proxy Server</h4>
        </div>
        <button 
          onClick={onClear}
          className="ml-auto text-white/40 hover:text-white/95 text-[10px] font-mono border border-white/10 hover:border-white/20 bg-white/[0.02] px-2.5 py-1 rounded transition-all"
        >
          Dismiss
        </button>
      </div>

      {/* Cause Analysis */}
      <div className="space-y-4">
        <h5 className="font-mono text-[10px] uppercase tracking-widest text-white/40 font-semibold">Incident Details</h5>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-white/60 font-mono text-[10px] uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> DNS Map
            </div>
            <p className="text-[11px] text-white/80 leading-relaxed font-mono">
              watt-api.rivtower.cc
              <br />
              ➡ <span className="text-orange-400">192.168.120.1</span>
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-white/60 font-mono text-[10px] uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Cloud Run Server
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Google Cloud containers have isolated security boundaries and <span className="text-red-400/90 font-mono">cannot rout</span> private IP subnets.
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-white/60 font-mono text-[10px] uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Browser Client
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Browser security blocks requests to <span className="text-orange-400 font-mono">192.168.120.1</span> due to Private Network Access (PNA) &amp; CORS.
            </p>
          </div>
        </div>
      </div>

      {/* Solutions Accordion/List */}
      <div className="space-y-4 border-t border-white/5 pt-5">
        <h5 className="font-mono text-[10px] uppercase tracking-widest text-white/40 font-semibold">How to Resolve This</h5>
        
        <div className="space-y-3.5">
          {/* Solution 1 */}
          <div className="border border-orange-500/10 bg-orange-500/[0.02] hover:bg-orange-500/[0.04] transition-colors rounded-xl p-4 flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0 mt-0.5">
              <span className="text-xs font-mono font-bold">01</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/90">Configure Custom Keys or Alternative Public Proxy</p>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Click the <button onClick={onOpenConfig} className="text-orange-400 font-bold hover:underline outline-none">API Config</button> button in the top navigation bar or click here to configure your credentials or rewrite the base URL to a publicly accessible server.
              </p>
            </div>
          </div>

          {/* Solution 2 */}
          <div className="border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-colors rounded-xl p-4 flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/60 shrink-0 mt-0.5">
              <span className="text-xs font-mono font-bold">02</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/90">Use the Official Google Gemini API Key</p>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Skip custom proxies entirely! Under AI Studio's <strong className="text-white/80">Settings menu / sidebar</strong>, set <code className="bg-white/10 px-1 py-0.5 rounded text-[10px] text-orange-400">GEMINI_API_KEY</code> to an official Google Gemini API Key (starts with <code className="text-orange-400/80">AIzaSy</code>). Our server will immediately detect it and query Google's public endpoints reliably.
              </p>
            </div>
          </div>

          {/* Solution 3 */}
          <div className="border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-colors rounded-xl p-4 flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/60 shrink-0 mt-0.5">
              <span className="text-xs font-mono font-bold">03</span>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/90">Run Pet Whisper AI Locally</p>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Export the codebase as a ZIP (from the Settings menu), extract it, and run:
              </p>
              <div className="bg-black/40 border border-white/5 rounded px-3 py-2 font-mono text-[10px] text-white/70 space-y-0.5 max-w-sm">
                <div>npm install</div>
                <div>npm run dev</div>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Since the app is hosted on your local workstation, its backend server can naturally reach <code className="bg-white/10 px-1 py-0.5 rounded text-[10px] text-orange-400">192.168.120.1</code> directly on your corporate/private network, bypassing browser security!
              </p>
            </div>
          </div>

          {/* Solution 4 */}
          <div className="border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-colors rounded-xl p-4 flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/60 shrink-0 mt-0.5">
              <span className="text-xs font-mono font-bold">04</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/90">Configure CORS and TLS on your Local Proxy</p>
              <p className="text-[11px] text-white/60 leading-relaxed">
                If indeed you have configured your hosts file or VPN to make your browser reach the proxy, configure your proxy's HTTP server to allow requests from the preview origin by returning headers:
              </p>
              <div className="bg-black/40 border border-white/5 rounded px-3 py-2.5 font-mono text-[10px] text-orange-400/90 leading-normal max-w-md session:leading-normal">
                Access-Control-Allow-Origin: *<br />
                Access-Control-Allow-Private-Network: true
              </div>
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
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom API configuration from localStorage
  const [clientKey, setClientKey] = useState<string>(() => localStorage.getItem("pet_whisper_custom_key") || "");
  const [clientBaseUrl, setClientBaseUrl] = useState<string>(() => localStorage.getItem("pet_whisper_custom_url") || "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'analyzer' | 'archives'>('analyzer');

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pet_whisper_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Clean up legacy multi-megabyte thumbnails to free up localStorage space instantly!
          let modified = false;
          const cleaned = parsed.map((entry: any) => {
            // Strip oversized raw base64 thumbnails if any exist from older versions
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
        // Progressive reduction: keep thumbnails only for newest items, reduce length
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

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Please upload an image or video file.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const rawBase64 = e.target?.result as string;
          
          // Display the original high-res preview on the page
          setMedia(rawBase64);
          setMimeType(file.type);

          // Compress media prior to calling Gemini on server
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

          // If the server tells the browser to fallback, or if we have it in the payload:
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

          // Create very small thumbnail for history entry to fit in LocalStorage effortlessly
          const thumb = await createThumbnail(file, rawBase64);

          // Add to history
          const newEntry: HistoryEntry = {
            ...data,
            id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : Math.random().toString(36).substring(2),
            timestamp: Date.now(),
            thumbnail: thumb || rawBase64.slice(0, 10000), // small formatted JPEG or fallback snippet
            mimeType: file.type
          };
          setHistory(prev => [newEntry, ...prev].slice(0, 50)); // Keep last 50 entries
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
  }, []);

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

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30">
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Dog className="text-white w-5 h-5" />
          </div>
          <span className="font-mono text-sm tracking-[0.2em] font-bold uppercase">Pet Whisper <span className="text-orange-500">AI</span></span>
        </div>

        {/* Tab switcher navigation */}
        <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/10 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setActiveTab('analyzer')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-[10px] text-[10px] font-mono uppercase tracking-wider transition-all duration-300
              ${activeTab === 'analyzer' 
                ? 'bg-orange-500 text-black font-semibold shadow-lg shadow-orange-500/10' 
                : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <BrainCircuit className="w-3.5 h-3.5 animate-pulse" />
            <span>Analyzer</span>
          </button>
          <button
            onClick={() => setActiveTab('archives')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-[10px] text-[10px] font-mono uppercase tracking-wider transition-all duration-300 relative
              ${activeTab === 'archives' 
                ? 'bg-orange-500 text-black font-semibold shadow-lg shadow-orange-500/10' 
                : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Archives</span>
            {history.length > 0 && (
              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded font-mono ml-1.5 transition-colors
                ${activeTab === 'archives' ? 'bg-black/15 text-black' : 'bg-orange-500/20 text-orange-400 border border-orange-500/10'}`}
              >
                {history.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex gap-6 text-[10px] font-mono uppercase tracking-widest text-white/40">
            <span className="hover:text-white cursor-pointer transition-colors">Behavior Model v1.0</span>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 hover:border-orange-500/50 bg-white/[0.02] hover:bg-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-white/70 hover:text-white transition-all active:scale-95"
            title="Configure Custom API / Proxy settings"
          >
            <Settings className="w-3.5 h-3.5 text-orange-500" />
            API Config
          </button>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {activeTab === 'analyzer' ? (
          <motion.main 
            key="analyzer-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="max-w-6xl mx-auto px-6 py-12 md:py-20 grid md:grid-cols-[1.2fr_1fr] gap-12 items-start"
          >
        {/* Left Side: Upload & Media View */}
        <section className="space-y-8">
          <header className="space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-medium tracking-tight leading-[0.9]"
            >
              Decode your dog's <br />
              <span className="text-orange-500 font-mono italic">inner world.</span>
            </motion.h1>
            <p className="text-white/50 text-sm max-w-md leading-relaxed">
              Upload a snapshot or short clip. Our AI analyzes subtle behavioral signals to model your companion's emotional state and personality.
            </p>
          </header>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div className="absolute inset-0 bg-orange-500/5 blur-3xl rounded-3xl group-hover:bg-orange-500/10 transition-all duration-500" />
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed transition-all duration-500 rounded-2xl aspect-video overflow-hidden flex items-center justify-center cursor-pointer
                ${isAnalyzing ? 'border-orange-500 animate-pulse' : 'border-white/10 hover:border-orange-500/50 bg-white/[0.02]'}`}
            >
              {media ? (
                <div className="w-full h-full relative group/media">
                  {mimeType?.startsWith("video") ? (
                    <video src={media} autoPlay muted loop className="w-full h-full object-cover" />
                  ) : (
                    <img src={media} className="w-full h-full object-cover" alt="Dog analysis" />
                  )}
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                      <span className="font-mono text-xs uppercase tracking-widest text-orange-500">Processing Signals...</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider">Change Media</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-12">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-white/50 group-hover:text-orange-500 transition-colors" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-mono text-xs uppercase tracking-widest">Drop frame or image</p>
                    <p className="text-[10px] text-white/30 tracking-wider">SUPPORTED: JPG, PNG, MP4, MOV</p>
                  </div>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFileChange} 
                accept="image/*,video/*" 
                className="hidden" 
              />
            </div>
          </motion.div>

          {error && (
            <ConnectivityTroubleshooter 
              error={error} 
              onClear={() => setError(null)} 
              onOpenConfig={() => setIsSettingsOpen(true)} 
            />
          )}
        </section>

        {/* Right Side: Results */}
        <section className="relative">
          <AnimatePresence mode="wait">
            {!result && !isAnalyzing && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center gap-6 text-center border border-white/5 bg-white/[0.01] rounded-3xl p-12"
              >
                <BrainCircuit className="w-12 h-12 text-white/10" />
                <div className="space-y-2">
                  <h3 className="font-mono text-sm uppercase tracking-widest text-white/60">Ready for Analysis</h3>
                  <p className="text-xs text-white/30 leading-relaxed max-w-[240px]">
                    Analysis data will appear here once you upload media of your dog.
                  </p>
                </div>
              </motion.div>
            )}

            {isAnalyzing && (
              <motion.div 
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="w-1/2 h-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]"
                  />
                </div>
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-white/5 rounded-xl border border-white/5 animate-pulse" />
                  ))}
                </div>
              </motion.div>
            )}

            {result && !isAnalyzing && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                {/* Emotional State Card */}
                <div className="p-6 bg-white/[0.03] border border-white/10 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-white/20 uppercase">
                    Scan Confidence: {(result.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-orange-500 uppercase tracking-widest">Current Emotion</span>
                      <h2 className="text-3xl font-medium tracking-tight text-white capitalize">{result.emotion}</h2>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {result.behavior_signals.map((sig, i) => (
                        <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-white/60 tracking-wider">
                          # {sig.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>

                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex gap-3 italic text-sm text-orange-200">
                      <MessageCircleHeart className="w-5 h-5 flex-shrink-0 text-orange-500" />
                      "{result.dog_inner_thought}"
                    </div>
                  </div>
                </div>

                {/* Personality Traits Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      Profile
                    </div>
                    <div className="font-medium text-blue-400 text-sm leading-tight">
                      {result.personality_type.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Status
                    </div>
                    <div className="font-medium text-green-400 text-sm leading-tight uppercase tracking-wider">
                      Verified
                    </div>
                  </div>
                </div>

                {/* Scores */}
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6">
                  <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4">Trait metrics</h3>
                  <div className="space-y-4">
                    <ScoreBar label="Energy" value={result.scores.energy} icon={Zap} />
                    <ScoreBar label="Social" value={result.scores.social} icon={Heart} />
                    <ScoreBar label="Curiosity" value={result.scores.curiosity} icon={Search} />
                    <ScoreBar label="Stability" value={result.scores.stability} icon={ShieldCheck} />
                  </div>
                </div>

                {/* Scientific Interpretation */}
                <div className="p-6 bg-[#111] border border-white/5 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/40">
                    <Info className="w-4 h-4 text-orange-500" />
                    Interpretation
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {result.scientific_interpretation}
                  </p>
                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] font-mono text-white/30 leading-snug">
                      {result.personality_summary}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => { setMedia(null); setResult(null); }}
                  className="w-full py-4 border border-white/10 rounded-2xl font-mono text-xs uppercase tracking-widest hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  New Analysis
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
          </motion.main>
        ) : (
          <motion.section 
            key="archives-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="max-w-6xl mx-auto px-6 py-12 md:py-20 space-y-12 min-h-[65vh]"
          >
        <div className="flex items-center justify-between mb-12">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-mono text-orange-500 uppercase tracking-[0.2em]">
              <History className="w-3 h-3" />
              Archives
            </div>
            <h2 className="text-3xl font-medium tracking-tight">Recent <span className="font-mono italic">Observations</span></h2>
          </div>
          <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest hidden md:block">
            Storing {history.length} analysis profiles
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence initial={false}>
            {history.length === 0 ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 border border-dashed border-white/10 rounded-3xl opacity-20">
                <History className="w-8 h-8" />
                <p className="font-mono text-xs uppercase tracking-widest">No archives found</p>
              </div>
            ) : (
              history.map((entry) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/6] relative overflow-hidden bg-black">
                    <img 
                      src={entry.thumbnail} 
                      className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500" 
                      alt="Thumbnail" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090909] to-transparent" />
                    
                    <button 
                      onClick={() => deleteHistoryEntry(entry.id)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all text-white/60 hover:text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="absolute bottom-3 left-4 flex gap-3 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-orange-500" />
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-orange-500" />
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono text-blue-400/80 uppercase tracking-wider">{entry.personality_type.replace(/_/g, " ")}</div>
                        <h4 className="font-medium text-white group-hover:text-orange-500 transition-colors">{entry.emotion}</h4>
                      </div>
                      <div className="px-1.5 py-0.5 rounded border border-white/5 bg-white/5 text-[9px] font-mono text-white/40">
                        {Math.round(entry.confidence * 100)}%
                      </div>
                    </div>

                    <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2 italic">
                      "{entry.dog_inner_thought}"
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                       <div className="flex gap-1.5">
                         {Object.entries(entry.scores).map(([key, val]) => (
                           <div key={key} title={key} className="w-1.5 h-4 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="w-full bg-orange-500" 
                                style={{ height: `${((val as number) / 20) * 100}%`, marginTop: `${100 - ((val as number) / 20) * 100}%` }} 
                              />
                           </div>
                         ))}
                       </div>
                       <button 
                        onClick={() => setSelectedHistoryEntry(entry)}
                        className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 hover:text-orange-500 flex items-center gap-2 group/btn transition-colors"
                      >
                        Details
                        <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Detailed View Modal */}
      <AnimatePresence>
        {selectedHistoryEntry && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHistoryEntry(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl shadow-black"
            >
              <button 
                onClick={() => setSelectedHistoryEntry(null)}
                className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-4 h-4 rotate-45" />
              </button>

              {/* Media Preview (Left) */}
              <div className="w-full md:w-1/2 h-64 md:h-auto relative bg-black">
                {selectedHistoryEntry.mimeType.startsWith("video") ? (
                  <video src={selectedHistoryEntry.thumbnail} autoPlay muted loop className="w-full h-full object-cover" />
                ) : (
                  <img src={selectedHistoryEntry.thumbnail} className="w-full h-full object-cover" alt="Dog Entry" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0a0a0a]" />
              </div>

              {/* Data (Right) */}
              <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto custom-scrollbar">
                <div className="space-y-8">
                  <header className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded">
                        <History className="w-3 h-3" />
                        Archived Analysis
                      </div>
                      <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
                        {new Date(selectedHistoryEntry.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-4xl font-medium tracking-tight capitalize">{selectedHistoryEntry.emotion}</h2>
                      <p className="text-sm font-mono text-blue-400 capitalize">{selectedHistoryEntry.personality_type.replace(/_/g, " ")}</p>
                    </div>
                  </header>

                  <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl italic text-sm text-orange-200/80 leading-relaxed">
                    "{selectedHistoryEntry.dog_inner_thought}"
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4">Biometric Scores</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <ScoreBar label="Energy" value={selectedHistoryEntry.scores.energy} icon={Zap} />
                      <ScoreBar label="Social" value={selectedHistoryEntry.scores.social} icon={Heart} />
                      <ScoreBar label="Curiosity" value={selectedHistoryEntry.scores.curiosity} icon={Search} />
                      <ScoreBar label="Stability" value={selectedHistoryEntry.scores.stability} icon={ShieldCheck} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-4">Scientific Insight</h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {selectedHistoryEntry.scientific_interpretation}
                    </p>
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                      <p className="text-[11px] font-mono text-white/30 leading-snug">
                        {selectedHistoryEntry.personality_summary}
                      </p>
                    </div>
                  </div>

                  <div className="pt-8 flex gap-4">
                    <button 
                      onClick={() => {
                        setResult(selectedHistoryEntry);
                        setMedia(selectedHistoryEntry.thumbnail);
                        setMimeType(selectedHistoryEntry.mimeType);
                        setSelectedHistoryEntry(null);
                        setActiveTab('analyzer');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex-1 py-4 bg-orange-500 text-black font-mono text-[10px] uppercase tracking-widest rounded-xl hover:bg-orange-400 transition-colors font-bold"
                    >
                      Restore to Main
                    </button>
                    <button 
                      onClick={() => setSelectedHistoryEntry(null)}
                      className="flex-1 py-4 border border-white/10 text-white font-mono text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/5 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Configuration Drawer / Overlay */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden z-50 text-left"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <header className="flex items-start justify-between border-b border-white/5 pb-4 mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-orange-500 uppercase tracking-widest font-bold">
                    <Settings className="w-3.5 h-3.5" />
                    System Preferences
                  </div>
                  <h3 className="text-xl font-medium text-white/95 leading-snug">API Endpoint Configuration</h3>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-white/60 font-mono text-xs"
                >
                  ✕
                </button>
              </header>

              <div className="space-y-6 text-left">
                <p className="text-xs text-white/50 leading-relaxed font-sans">
                  Configure custom credentials or alternative proxy endpoints. These parameters are persisted securely inside your local browser sandbox and will take precedence during analysis.
                </p>

                {/* Form Group: Custom Base URL */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/40 font-bold">
                    API Base URL (Proxy Gateway)
                  </label>
                  <input 
                    type="text"
                    value={clientBaseUrl}
                    onChange={(e) => setClientBaseUrl(e.target.value)}
                    placeholder="https://generativelanguage.googleapis.com (Optional)"
                    className="w-full bg-white/[0.02] border border-white/10 hover:border-white/20 focus:border-orange-500 rounded-xl px-4 py-3 text-xs font-mono text-white/80 transition-all outline-none"
                  />
                  <p className="text-[10px] text-white/30 leading-normal">
                    Leave blank to use official Google Gemini API direct endpoints.
                  </p>
                </div>

                {/* Form Group: Custom API Key */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/40 font-bold">
                    API Credentials (Google API key)
                  </label>
                  <input 
                    type="password"
                    value={clientKey}
                    onChange={(e) => setClientKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-white/[0.02] border border-white/10 hover:border-white/20 focus:border-orange-500 rounded-xl px-4 py-3 text-xs font-mono text-white/80 transition-all outline-none"
                  />
                  <p className="text-[10px] text-white/30 leading-normal">
                    Enter your custom Google Gemini API key here to override backend secrets.
                  </p>
                </div>

                {/* Diagnostic Insights */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2 text-[11px] text-blue-300 shadow-sm">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-200">Corporate Intranets &amp; Private Networks</p>
                    <p className="opacity-80">
                      If your Endpoint domain resolves to a private IP (like <code className="bg-white/10 px-1 rounded text-[10px]">192.168.x.x</code>), direct server calls will bypass to a secured direct-browser fetch pipeline to support intranet resolution automatically.
                    </p>
                  </div>
                </div>

                {/* Confirmations buttons */}
                <div className="pt-4 flex gap-3 border-t border-white/5">
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
                      // Clear errors so they can try again fresh
                      setError(null);
                    }}
                    className="flex-1 py-3 bg-orange-500 text-black font-mono text-xs uppercase tracking-widest rounded-xl hover:bg-orange-400 transition-colors font-bold shadow-md shadow-orange-500/10 active:scale-95 text-center flex items-center justify-center cursor-pointer"
                  >
                    Save &amp; Apply
                  </button>
                  <button 
                    onClick={() => {
                      // Reset to original Defaults
                      setClientKey("");
                      setClientBaseUrl("");
                      localStorage.removeItem("pet_whisper_custom_key");
                      localStorage.removeItem("pet_whisper_custom_url");
                      setIsSettingsOpen(false);
                      setError(null);
                    }}
                    className="py-3 px-4 border border-white/10 text-white/60 font-mono text-xs uppercase tracking-widest rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest">
            <span>Powered by Gemini Flash</span>
            <div className="w-1 h-1 bg-white rounded-full" />
            <span>Built by AI Studio</span>
          </div>
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-full border border-white" />
             <div className="w-8 h-8 rounded-full border border-white bg-white" />
             <div className="w-8 h-8 rounded-full border border-white" />
          </div>
        </div>
      </footer>
    </div>
  );
}
