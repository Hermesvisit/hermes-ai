"use client";

import { useRef, useState } from "react";

type HermesState = "idle" | "listening" | "thinking" | "speaking" | "error";

export default function VoicePage() {
  const [started, setStarted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [state, setState] = useState<HermesState>("idle");
  const [lastText, setLastText] = useState("");
  const [reply, setReply] = useState("");
  const [volume, setVolume] = useState(0);

  const recognitionRef = useRef<any>(null);
  const processingRef = useRef(false);
  const shouldListenRef = useRef(false);
  const finalTextRef = useRef("");
  const silenceTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<any>(null);

  const startVolumeMeter = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 256;
    microphone.connect(analyser);
    audioContextRef.current = audioContext;

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);

      const average =
        dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

      const normalized = Math.min(average / 80, 1);
      setVolume(normalized);

      animationRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();
  };

  const startHermes = async () => {
    try {
      await startVolumeMeter();
    } catch {
      setState("error");
      setReply("Mikrofon izni alınamadı.");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState("error");
      setReply("Bu tarayıcı ses tanımayı desteklemiyor. Chrome kullan.");
      return;
    }

    setStarted(true);
    setMicEnabled(true);
    shouldListenRef.current = true;
    setState("listening");

    const recognition = new SpeechRecognition();
    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let transcript = "";

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.trim();

      if (!transcript) return;

      finalTextRef.current = transcript;
      setLastText(transcript);
      setState("listening");

      clearTimeout(silenceTimerRef.current);

      silenceTimerRef.current = setTimeout(() => {
        sendToHermes(finalTextRef.current);
      }, 1800);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        setState("listening");
        return;
      }

      setState("error");
      setReply("Mikrofon hatası: " + event.error);
    };

    recognition.onend = () => {
      if (shouldListenRef.current && !processingRef.current) {
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
    if (!text || processingRef.current) return;

    processingRef.current = true;
    setState("thinking");

    try {
      try {
        recognitionRef.current?.stop();
      } catch {}

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          persona: "Karışık Düşünme",
          mode: "Hibrit",
        }),
      });

      const data = await response.json();
      const answer = data.message || "Cevap oluşturamadım.";

      setReply(answer);
      setState("speaking");

      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.lang = "tr-TR";
      utterance.rate = 1;
      utterance.pitch = 1;

      window.speechSynthesis.cancel();

      utterance.onend = () => {
        processingRef.current = false;
        finalTextRef.current = "";

        if (shouldListenRef.current && micEnabled) {
          setState("listening");

          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch {}
          }, 700);
        } else {
          setState("idle");
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (error: any) {
      processingRef.current = false;
      setState("error");
      setReply("Bağlantı hatası: " + error.message);
    }
  };

  const toggleMic = () => {
    if (micEnabled) {
      setMicEnabled(false);
      shouldListenRef.current = false;
      setState("idle");
      window.speechSynthesis.cancel();

      try {
        recognitionRef.current?.stop();
      } catch {}

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      audioContextRef.current?.close();
      setVolume(0);
    } else {
      setMicEnabled(true);
      shouldListenRef.current = true;
      setState("listening");

      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch {}
      }, 500);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    processingRef.current = false;
    setState(micEnabled ? "listening" : "idle");

    setTimeout(() => {
      try {
        recognitionRef.current?.start();
      } catch {}
    }, 600);
  };

  const theme = {
    idle: {
      text: started ? "Hazır" : "Hermes beklemede",
      glow: "rgba(168,85,247,0.55)",
      bg: "rgba(120,40,180,0.18)",
    },
    listening: {
      text: "Dinliyorum...",
      glow: "rgba(168,85,247,0.75)",
      bg: "rgba(120,40,180,0.22)",
    },
    thinking: {
      text: "Düşünüyorum...",
      glow: "rgba(59,130,246,0.9)",
      bg: "rgba(37,99,235,0.25)",
    },
    speaking: {
      text: "Hermes konuşuyor...",
      glow: "rgba(192,132,252,0.95)",
      bg: "rgba(150,60,220,0.3)",
    },
    error: {
      text: "Hata algılandı.",
      glow: "rgba(239,68,68,0.9)",
      bg: "rgba(180,20,20,0.24)",
    },
  }[state];

  const voiceScale = state === "listening" ? 1 + volume * 0.22 : 1;

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden relative">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${theme.bg}, transparent 55%)`,
        }}
      />

      <div className="relative z-10 flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <div
            className="relative w-[500px] h-[500px] flex items-center justify-center transition-transform duration-100"
            style={{
              transform: `scale(${voiceScale})`,
            }}
          >
            <div
              className={`absolute w-full h-full rounded-full border ${anim(
                state,
                "outer"
              )}`}
              style={{ borderColor: theme.glow }}
            />

            <div
              className={`absolute w-[455px] h-[455px] rounded-full border ${anim(
                state,
                "outer"
              )}`}
              style={{ borderColor: theme.glow, opacity: 0.45 }}
            />

            <div
              className={`absolute w-[405px] h-[405px] rounded-full border ${anim(
                state,
                "outer"
              )}`}
              style={{ borderColor: theme.glow, opacity: 0.3 }}
            />

            <div
              className={`absolute w-[340px] h-[340px] rounded-full blur-3xl ${anim(
                state,
                "glow"
              )}`}
              style={{ backgroundColor: theme.glow }}
            />

            <div
              className={`relative w-[360px] h-[360px] rounded-full border backdrop-blur-xl overflow-hidden ${anim(
                state,
                "core"
              )}`}
              style={{
                borderColor: theme.glow,
                backgroundColor:
                  state === "thinking"
                    ? "rgba(30,58,138,0.18)"
                    : state === "error"
                    ? "rgba(127,29,29,0.18)"
                    : "rgba(88,28,135,0.22)",
                boxShadow: `0 0 ${90 + volume * 120}px ${theme.glow}`,
              }}
            >
              <div className="absolute inset-0">
                {[...Array(50)].map((_, i) => (
                  <span
                    key={i}
                    className={`absolute rounded-full ${anim(
                      state,
                      "particle"
                    )}`}
                    style={{
                      width: `${2 + (i % 4) + volume * 5}px`,
                      height: `${2 + (i % 4) + volume * 5}px`,
                      left: `${10 + ((i * 37) % 80)}%`,
                      top: `${10 + ((i * 59) % 80)}%`,
                      backgroundColor: theme.glow,
                      boxShadow: `0 0 ${15 + volume * 40}px ${theme.glow}`,
                    }}
                  />
                ))}
              </div>

              <div
                className={`absolute inset-10 rounded-full border ${anim(
                  state,
                  "inner"
                )}`}
                style={{ borderColor: theme.glow, opacity: 0.35 }}
              />

              <div
                className={`absolute inset-20 rounded-full border ${anim(
                  state,
                  "inner"
                )}`}
                style={{ borderColor: theme.glow, opacity: 0.28 }}
              />

              <div
                className={`absolute inset-[34%] rounded-full ${anim(
                  state,
                  "heart"
                )}`}
                style={{
                  backgroundColor: theme.glow,
                  boxShadow: `0 0 ${80 + volume * 80}px ${theme.glow}`,
                }}
              />
            </div>
          </div>

          <h1 className="text-6xl font-bold text-violet-100 mt-10 tracking-[0.35em]">
            HERMES
          </h1>

          <p className="mt-4 text-lg" style={{ color: theme.glow }}>
            {theme.text}
          </p>

          {lastText && (
            <p className="mt-4 max-w-2xl text-center text-zinc-400">
              Sen: {lastText}
            </p>
          )}

          {reply && (
            <p className="mt-3 max-w-2xl text-center text-zinc-300">
              Hermes: {reply}
            </p>
          )}

          {!started && (
            <button
              onClick={startHermes}
              className="mt-8 px-8 py-4 rounded-full bg-violet-600 text-white border border-violet-300 shadow-[0_0_35px_rgba(168,85,247,0.8)]"
            >
              Hermes’i Başlat
            </button>
          )}

          {started && (
            <button
              onClick={stopSpeaking}
              className="mt-6 px-5 py-2 rounded-full bg-zinc-900 text-white border border-zinc-700"
            >
              Sustur
            </button>
          )}
        </div>
      </div>

      {started && (
        <button
          onClick={toggleMic}
          className={`fixed bottom-6 right-6 z-20 px-5 py-3 rounded-full border text-sm transition-all ${
            micEnabled
              ? "bg-violet-600 text-white border-violet-300 shadow-[0_0_30px_rgba(168,85,247,0.8)]"
              : "bg-zinc-900 text-white border-zinc-700"
          }`}
        >
          {micEnabled ? "Mikrofon Açık" : "Mikrofon Kapalı"}
        </button>
      )}

      <style jsx>{`
        .idleCore,
        .listeningCore {
          animation: calmBreath 3s ease-in-out infinite;
        }

        .idleOuter,
        .listeningOuter {
          animation: calmOuter 3.4s ease-in-out infinite;
        }

        .idleParticle,
        .listeningParticle {
          animation: calmParticle 3.2s ease-in-out infinite;
        }

        .thinkingCore {
          animation: thinkingPulse 1.5s ease-in-out infinite;
        }

        .speakingCore {
          animation: speakingPulse 1s ease-in-out infinite;
        }

        .errorCore {
          animation: errorPulse 0.45s ease-in-out infinite;
        }

        @keyframes calmBreath {
          0%,
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.02);
            filter: brightness(1.12);
          }
        }

        @keyframes calmOuter {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.25;
          }
          50% {
            transform: scale(1.035);
            opacity: 0.5;
          }
        }

        @keyframes calmParticle {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.25);
            opacity: 0.7;
          }
        }

        @keyframes thinkingPulse {
          0%,
          100% {
            transform: scale(1);
            filter: brightness(1.05);
          }
          50% {
            transform: scale(1.05);
            filter: brightness(1.4);
          }
        }

        @keyframes speakingPulse {
          0%,
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.1);
            filter: brightness(1.5);
          }
        }

        @keyframes errorPulse {
          0%,
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.04);
            filter: brightness(1.8);
          }
        }
      `}</style>
    </main>
  );
}

function anim(state: HermesState, part: string) {
  if (state === "thinking") return "thinkingCore";
  if (state === "speaking") return "speakingCore";
  if (state === "error") return "errorCore";

  if (part.includes("outer")) return "listeningOuter";
  if (part === "particle") return "listeningParticle";
  return "listeningCore";
}