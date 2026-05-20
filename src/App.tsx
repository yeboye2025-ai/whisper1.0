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
  Trash2
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

export default function App() {
  const [media, setMedia] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pet_whisper_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem("pet_whisper_history", JSON.stringify(history));
      } catch (e) {
        console.error("LocalStorage quota exceeded, clearing some history:", e);
        // If quota exceeded, try saving fewer entries
        if (history.length > 5) {
           setHistory(prev => prev.slice(0, prev.length - 5));
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
              mimeType: compressed.mimeType 
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Analysis failed");
          }

          const data: AnalysisResult = await response.json();
          
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
      <nav className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Dog className="text-white w-5 h-5" />
          </div>
          <span className="font-mono text-sm tracking-[0.2em] font-bold uppercase">Pet Whisper <span className="text-orange-500">AI</span></span>
        </div>
        <div className="hidden md:flex gap-6 text-[10px] font-mono uppercase tracking-widest text-white/40">
          <span className="hover:text-white cursor-pointer transition-colors">Behavior Model v1.0</span>
          <span className="hover:text-white cursor-pointer transition-colors">Ethology Database</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20 grid md:grid-cols-[1.2fr_1fr] gap-12 items-start">
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
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs font-mono"
            >
              <Info className="w-4 h-4" />
              {error}
            </motion.div>
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
      </main>

      {/* History Log Section */}
      <section className="max-w-6xl mx-auto px-6 pb-20 border-t border-white/5 pt-20">
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
      </section>

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
