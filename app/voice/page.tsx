"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type HermesState = "idle" | "listening" | "thinking" | "speaking" | "error";

type SpeechRecognitionResultItem = { transcript: string };
type SpeechRecognitionResult = {
  0: SpeechRecognitionResultItem;
  length: number;
};
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionErrorEvent = { error: string };
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

type VoiceLog = {
  role: "Sen" | "Hermes" | "Sistem";
  text: string;
};

export default function VoicePage() {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<HermesState>("idle");
  const [lastText, setLastText] = useState("");
  const [reply, setReply] = useState("");
  const [volume, setVolume] = useState(0);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<VoiceLog[]>([]);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const processingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const addLog = (role: VoiceLog["role"], text: string) => {
    setLogs((prev) => [...prev.slice(-12), { role, text }]);
  };

  const startVolumeMeter = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();

    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    audioRef.current = ctx;

    const tick = () => {
      analyser.getByteTimeDomainData(data);

      let sum = 0;

      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }

      const rms = Math.sqrt(sum / data.length);
      const boosted = Math.min(rms * 3.2, 1);

      setVolume(boosted);
      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
  };

  const startHermes = async () => {
    try {
      await startVolumeMeter();
    } catch {
      setState("error");
      setReply("Mikrofon izni alınamadı.");
      addLog("Sistem", "Mikrofon izni alınamadı.");
      return;
    }

    const speechWindow = window as SpeechWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState("error");
      setReply("Bu tarayıcı ses tanımayı desteklemiyor. Chrome kullan.");
      addLog("Sistem", "Tarayıcı ses tanımayı desteklemiyor.");
      return;
    }

    setStarted(true);
    setState("listening");
    addLog("Sistem", "Hermes voice başlatıldı.");

    const recognition = new SpeechRecognition();

    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.trim();

      if (!transcript) return;

      setLastText(transcript);
      setState("listening");

      if (silenceTimerRef.current !== null) {
        clearTimeout(silenceTimerRef.current);
      }

      silenceTimerRef.current = setTimeout(() => {
        sendToHermes(transcript);
      }, 1000);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;

      setState("error");
      setReply("Mikrofon hatası: " + event.error);
      addLog("Sistem", "Mikrofon hatası: " + event.error);
    };

    recognition.onend = () => {
      if (!processingRef.current && started) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {}
        }, 600);
      }
    };

    try {
      recognition.start();
    } catch {}
  };

  const sendToHermes = async (text: string) => {
    if (processingRef.current) return;

    processingRef.current = true;
    setState("thinking");
    addLog("Sen", text);

    try {
      recognitionRef.current?.stop();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          persona: "Karışık Düşünme",
          mode: "Fast",
        }),
      });

      const data = await response.json();
      const answer = data.message || "Cevap oluşturamadım.";

      setReply(answer);
      setState("speaking");
      addLog("Hermes", answer);

      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.lang = "tr-TR";
      utterance.rate = 1;
      utterance.pitch = 1;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);

      utterance.onend = () => {
        processingRef.current = false;
        setState("listening");

        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch {}
        }, 600);
      };
    } catch (error) {
      processingRef.current = false;
      const message =
        error instanceof Error ? error.message : "bilinmeyen hata";
      setState("error");
      setReply("Bağlantı hatası: " + message);
      addLog("Sistem", "Bağlantı hatası: " + message);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    processingRef.current = false;
    setState("listening");

    setTimeout(() => {
      try {
        recognitionRef.current?.start();
      } catch {}
    }, 500);
  };

  const theme = {
    idle: {
      label: started ? "Hazır" : "Hermes beklemede",
      glow: "rgba(168,85,247,0.55)",
      bg: "rgba(120,40,180,0.13)",
      core: "rgba(88,28,135,0.22)",
    },
    listening: {
      label: "Dinliyorum...",
      glow: "rgba(168,85,247,0.72)",
      bg: "rgba(120,40,180,0.16)",
      core: "rgba(88,28,135,0.22)",
    },
    thinking: {
      label: "Düşünüyorum...",
      glow: "rgba(59,130,246,0.9)",
      bg: "rgba(37,99,235,0.2)",
      core: "rgba(30,58,138,0.2)",
    },
    speaking: {
      label: "Konuşuyorum...",
      glow: "rgba(192,132,252,0.95)",
      bg: "rgba(150,60,220,0.22)",
      core: "rgba(88,28,135,0.28)",
    },
    error: {
      label: "Hata algılandı",
      glow: "rgba(239,68,68,0.9)",
      bg: "rgba(180,20,20,0.2)",
      core: "rgba(127,29,29,0.22)",
    },
  }[state];

  const voiceScale =
    state === "listening"
      ? 1 + volume * 0.14
      : state === "speaking"
      ? 1.06
      : 1;

  const glowSize = 65 + volume * 70;

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden relative">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${theme.bg}, transparent 58%)`,
        }}
      />

      <Link
        href="/"
        className="fixed top-6 left-6 z-30 bg-zinc-900/80 border border-zinc-700 text-zinc-200 px-5 py-3 rounded-2xl hover:bg-zinc-800 transition"
      >
        Mesajlaşmaya Geç
      </Link>

      <div className="relative z-10 flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <div
            className="relative w-[520px] h-[520px] flex items-center justify-center transition-transform duration-500 perspective"
            style={{
              transform: `scale(${voiceScale})`,
            }}
          >
            <div
              className="absolute w-full h-full rounded-full border opacity-30 soft-orbit"
              style={{ borderColor: theme.glow }}
            />

            <div
              className="absolute w-[455px] h-[455px] rounded-full border opacity-25 soft-orbit-reverse"
              style={{ borderColor: theme.glow }}
            />

            <div
              className="absolute w-[380px] h-[380px] rounded-full blur-3xl soft-glow"
              style={{ backgroundColor: theme.glow }}
            />

            <div
              className={`relative w-[365px] h-[365px] rounded-full border overflow-hidden backdrop-blur-xl sphere-3d ${
                state === "speaking" ? "speak-breath" : "idle-breath"
              }`}
              style={{
                borderColor: theme.glow,
                backgroundColor: theme.core,
                boxShadow: `inset -40px -45px 80px rgba(0,0,0,0.7), inset 28px 25px 60px rgba(255,255,255,0.08), 0 0 ${glowSize}px ${theme.glow}`,
              }}
            >
              <div
                className="absolute inset-0 rounded-full opacity-80"
                style={{
                  background:
                    "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.25), transparent 20%), radial-gradient(circle at 65% 72%, rgba(0,0,0,0.42), transparent 38%)",
                }}
              />

              <div className="absolute inset-0 network-layer">
                {[...Array(60)].map((_, i) => (
                  <span
                    key={i}
                    className="absolute rounded-full transition-all duration-300"
                    style={{
                      width: `${2 + (i % 4) + volume * 5}px`,
                      height: `${2 + (i % 4) + volume * 5}px`,
                      left: `${10 + ((i * 37) % 80)}%`,
                      top: `${10 + ((i * 59) % 80)}%`,
                      backgroundColor: theme.glow,
                      opacity: 0.28 + volume * 0.32,
                      boxShadow: `0 0 ${10 + volume * 20}px ${theme.glow}`,
                    }}
                  />
                ))}
              </div>

              <div
                className="absolute inset-10 rounded-full border opacity-30 inner-breath"
                style={{ borderColor: theme.glow }}
              />

              <div
                className="absolute inset-20 rounded-full border opacity-25 inner-breath-slow"
                style={{ borderColor: theme.glow }}
              />

              <div
                className="absolute inset-[35%] rounded-full core-heart"
                style={{
                  backgroundColor: theme.glow,
                  boxShadow: `0 0 ${75 + volume * 60}px ${theme.glow}`,
                }}
              />
            </div>
          </div>

          <h1 className="text-6xl font-bold text-violet-200 mt-8 tracking-[0.35em]">
            HERMES
          </h1>

          <p className="mt-4 text-lg" style={{ color: theme.glow }}>
            {theme.label}
          </p>

          {lastText && state === "listening" && (
            <p className="mt-3 text-sm text-zinc-500 text-center max-w-lg px-4">
              {lastText}
            </p>
          )}

          {reply && (state === "speaking" || state === "error") && (
            <p className="mt-3 text-sm text-zinc-400 text-center max-w-lg px-4 line-clamp-4">
              {reply}
            </p>
          )}

          {!started && (
            <button
              onClick={startHermes}
              className="mt-8 px-8 py-4 rounded-full bg-violet-700 hover:bg-violet-600 transition text-white border border-violet-500/30 shadow-[0_0_22px_rgba(168,85,247,0.28)]"
            >
              Hermes’i Başlat
            </button>
          )}

          {started && (
            <button
              onClick={stopSpeaking}
              className="mt-6 px-5 py-2 rounded-full bg-zinc-900 text-white border border-zinc-700 hover:bg-zinc-800 transition"
            >
              Sustur
            </button>
          )}
        </div>
      </div>

      {started && (
        <button
          onClick={() => setLogsOpen(!logsOpen)}
          className="fixed bottom-6 right-6 z-30 bg-violet-700 hover:bg-violet-600 transition text-white px-5 py-3 rounded-full border border-violet-500/20 shadow-[0_0_20px_rgba(168,85,247,0.22)]"
        >
          Konuşma
        </button>
      )}

      {logsOpen && (
        <div className="fixed right-6 bottom-20 z-30 w-[380px] max-h-[520px] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl">
          <h3 className="text-xl font-bold mb-4 text-violet-200">
            Canlı Konuşma
          </h3>

          <div className="space-y-3">
            {logs.length === 0 && (
              <p className="text-zinc-500 text-sm">
                Konuşma başladığında burada görünecek.
              </p>
            )}

            {logs.map((log, index) => (
              <div
                key={index}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-sm"
              >
                <p className="text-zinc-500 mb-1">{log.role}</p>
                <p className="text-zinc-200">{log.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .perspective {
          perspective: 1000px;
        }

        .sphere-3d {
          transform-style: preserve-3d;
          animation: sphereRotate 18s ease-in-out infinite;
        }

        .soft-orbit {
          animation: softOrbit 16s ease-in-out infinite;
        }

        .soft-orbit-reverse {
          animation: softOrbitReverse 22s ease-in-out infinite;
        }

        .soft-glow {
          animation: softGlow 5s ease-in-out infinite;
          opacity: 0.55;
        }

        .network-layer {
          animation: networkDrift 14s ease-in-out infinite;
        }

        .idle-breath {
          animation: sphereRotate 18s ease-in-out infinite,
            idleBreath 3.8s ease-in-out infinite;
        }

        .speak-breath {
          animation: sphereRotate 14s ease-in-out infinite,
            speakBreath 1.25s ease-in-out infinite;
        }

        .inner-breath {
          animation: innerBreath 3.5s ease-in-out infinite;
        }

        .inner-breath-slow {
          animation: innerBreath 4.6s ease-in-out infinite;
        }

        .core-heart {
          animation: coreHeart 2.6s ease-in-out infinite;
        }

        @keyframes sphereRotate {
          0% {
            transform: rotateX(10deg) rotateY(-16deg);
          }
          50% {
            transform: rotateX(14deg) rotateY(18deg);
          }
          100% {
            transform: rotateX(10deg) rotateY(-16deg);
          }
        }

        @keyframes softOrbit {
          0%,
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.22;
          }
          50% {
            transform: scale(1.035) rotate(12deg);
            opacity: 0.38;
          }
        }

        @keyframes softOrbitReverse {
          0%,
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.18;
          }
          50% {
            transform: scale(1.045) rotate(-10deg);
            opacity: 0.32;
          }
        }

        @keyframes softGlow {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.62;
          }
        }

        @keyframes networkDrift {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(8px, -6px, 0) scale(1.025);
          }
        }

        @keyframes idleBreath {
          0%,
          100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.1);
          }
        }

        @keyframes speakBreath {
          0%,
          100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.12);
          }
        }

        @keyframes innerBreath {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.22;
          }
          50% {
            transform: scale(1.045);
            opacity: 0.42;
          }
        }

        @keyframes coreHeart {
          0%,
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.08);
            filter: brightness(1.24);
          }
        }
      `}</style>
    </main>
  );
}