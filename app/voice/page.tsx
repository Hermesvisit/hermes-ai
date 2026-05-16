"use client";

import { useRef, useState } from "react";

type HermesState = "idle" | "listening" | "thinking" | "speaking" | "error";

export default function VoicePage() {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<HermesState>("idle");
  const [lastText, setLastText] = useState("");
  const [reply, setReply] = useState("");
  const [volume, setVolume] = useState(0);

  const recognitionRef = useRef<any>(null);
  const processingRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<any>(null);

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
      const boosted = Math.min(rms * 7, 1);
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
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState("error");
      setReply("Bu tarayıcı ses tanımayı desteklemiyor. Chrome kullan.");
      return;
    }

    setStarted(true);
    setState("listening");

    const recognition = new SpeechRecognition();
    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.trim();
      if (!transcript) return;

      setLastText(transcript);
      setState("listening");

      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => sendToHermes(transcript), 1000);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setState("error");
      setReply("Mikrofon hatası: " + event.error);
    };

    recognition.onend = () => {
      if (!processingRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {}
        }, 500);
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

    try {
      recognitionRef.current?.stop();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, persona: "Karışık Düşünme", mode: "Fast" }),
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
      window.speechSynthesis.speak(utterance);

      utterance.onend = () => {
        processingRef.current = false;
        setState("listening");

        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch {}
        }, 500);
      };
    } catch (error: any) {
      processingRef.current = false;
      setState("error");
      setReply("Bağlantı hatası: " + error.message);
    }
  };

  const theme = {
    idle: ["Hermes beklemede", "rgba(168,85,247,0.55)", "rgba(120,40,180,0.18)"],
    listening: ["Dinliyorum...", "rgba(168,85,247,0.75)", "rgba(120,40,180,0.22)"],
    thinking: ["Düşünüyorum...", "rgba(59,130,246,0.9)", "rgba(37,99,235,0.25)"],
    speaking: ["Konuşuyorum...", "rgba(192,132,252,0.95)", "rgba(150,60,220,0.3)"],
    error: ["Hata algılandı", "rgba(239,68,68,0.9)", "rgba(180,20,20,0.24)"],
  }[state];

  const scale = state === "listening" ? 1 + volume * 0.35 : state === "speaking" ? 1.08 : 1;
  const glowSize = 90 + volume * 180;

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden relative">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at center, ${theme[2]}, transparent 55%)` }} />

      <div className="relative z-10 flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <div className="relative w-[500px] h-[500px] flex items-center justify-center transition-transform duration-75" style={{ transform: `scale(${scale})` }}>
            <div className="absolute w-full h-full rounded-full border animate-pulse" style={{ borderColor: theme[1] }} />
            <div className="absolute w-[430px] h-[430px] rounded-full border animate-pulse" style={{ borderColor: theme[1], opacity: 0.4 }} />
            <div className="absolute w-[340px] h-[340px] rounded-full blur-3xl" style={{ backgroundColor: theme[1], opacity: 0.7 }} />

            <div className="relative w-[360px] h-[360px] rounded-full border overflow-hidden backdrop-blur-xl" style={{
              borderColor: theme[1],
              backgroundColor: state === "thinking" ? "rgba(30,58,138,0.18)" : state === "error" ? "rgba(127,29,29,0.18)" : "rgba(88,28,135,0.22)",
              boxShadow: `0 0 ${glowSize}px ${theme[1]}`,
            }}>
              {[...Array(55)].map((_, i) => (
                <span key={i} className="absolute rounded-full transition-all duration-75"
                  style={{
                    width: `${2 + (i % 4) + volume * 8}px`,
                    height: `${2 + (i % 4) + volume * 8}px`,
                    left: `${10 + ((i * 37) % 80)}%`,
                    top: `${10 + ((i * 59) % 80)}%`,
                    backgroundColor: theme[1],
                    boxShadow: `0 0 ${15 + volume * 50}px ${theme[1]}`,
                    opacity: 0.35 + volume * 0.65,
                  }}
                />
              ))}

              <div className="absolute inset-10 rounded-full border animate-pulse" style={{ borderColor: theme[1], opacity: 0.35 }} />
              <div className="absolute inset-[34%] rounded-full animate-pulse" style={{ backgroundColor: theme[1], boxShadow: `0 0 ${80 + volume * 120}px ${theme[1]}` }} />
            </div>
          </div>

          <h1 className="text-6xl font-bold text-violet-100 mt-10 tracking-[0.35em]">HERMES</h1>
          <p className="mt-4 text-lg" style={{ color: theme[1] }}>{theme[0]}</p>

          {lastText && <p className="mt-4 max-w-2xl text-center text-zinc-400">Sen: {lastText}</p>}
          {reply && <p className="mt-3 max-w-2xl text-center text-zinc-300">Hermes: {reply}</p>}

          {!started && (
            <button onClick={startHermes} className="mt-8 px-8 py-4 rounded-full bg-violet-600 text-white border border-violet-300 shadow-[0_0_35px_rgba(168,85,247,0.8)]">
              Hermes’i Başlat
            </button>
          )}
        </div>
      </div>
    </main>
  );
}