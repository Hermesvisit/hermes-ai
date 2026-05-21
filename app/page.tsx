"use client";

import { useEffect, useState } from "react";
import {
  clearStoredHermesAccessKey,
  getHermesAccessHeaders,
  getStoredHermesAccessKey,
  storeHermesAccessKey,
} from "@/lib/hermes/access-client";

type Message = {
  role: "user" | "ai";
  content: string;
};

type AuthState = "loading" | "required" | "ok";

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [persona, setPersona] = useState("Karışık Düşünme");
  const [mode, setMode] = useState("Hibrit");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: "Merhaba. Ben Hermes.",
    },
  ]);

  useEffect(() => {
    async function initAuth() {
      try {
        const response = await fetch("/api/auth/status");
        const data = (await response.json()) as { required?: boolean };

        if (!data.required) {
          setAuthState("ok");
          return;
        }

        if (getStoredHermesAccessKey()) {
          setAuthState("ok");
          return;
        }

        setAuthState("required");
      } catch {
        setAuthState("required");
      }
    }

    void initAuth();
  }, []);

  const requireAuthAgain = (reason?: string) => {
    clearStoredHermesAccessKey();
    setAuthState("required");
    setAuthError(reason || "");
  };

  const verifyAccess = async () => {
    const key = accessKeyInput.trim();

    if (!key) {
      setAuthError("Lütfen erişim anahtarını girin.");
      return;
    }

    setAuthError("");
    setVerifying(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessKey: key }),
      });

      const data = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok) {
        setAuthError(
          data.message || "Geçersiz erişim anahtarı. Lütfen tekrar deneyin."
        );
        return;
      }

      storeHermesAccessKey(key);
      setAccessKeyInput("");
      setAuthState("ok");
    } catch {
      setAuthError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setVerifying(false);
    }
  };

  const sendMessage = async () => {
    const currentMessage = message.trim();

    if (!currentMessage || loading) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: currentMessage },
      { role: "ai", content: "Hermes düşünüyor..." },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getHermesAccessHeaders(),
        },
        body: JSON.stringify({
          message: currentMessage,
          persona,
          mode,
        }),
      });

      let data: { success?: boolean; message?: string } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (response.status === 401) {
        requireAuthAgain(
          data.message || "Oturum süresi doldu veya erişim anahtarı geçersiz."
        );
        return;
      }

      setMessages((prev) => {
        const updated = [...prev];

        updated[updated.length - 1] = {
          role: "ai",
          content: response.ok
            ? data.message || "Cevap boş geldi."
            : data.message || "Hermes tarafında bilinmeyen bir hata oluştu.",
        };

        return updated;
      });
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];

        updated[updated.length - 1] = {
          role: "ai",
          content:
            "Bağlantı hatası: " +
            (error instanceof Error ? error.message : "bilinmeyen hata"),
        };

        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  if (authState === "loading") {
    return (
      <main className="h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Hermes yükleniyor...</p>
      </main>
    );
  }

  if (authState === "required") {
    return (
      <main className="h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_50%)]" />

        <div className="relative z-10 w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <h1 className="text-3xl font-bold tracking-[0.2em] text-violet-300">
            HERMES
          </h1>
          <p className="text-zinc-500 text-sm mt-2 mb-6">Erişim doğrulaması</p>

          <p className="text-zinc-300 text-sm mb-4">
            Bu Hermes dağıtımı korumalıdır. Devam etmek için erişim anahtarını
            girin.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyAccess();
            }}
            className="space-y-4"
          >
            <input
              type="password"
              value={accessKeyInput}
              onChange={(e) => setAccessKeyInput(e.target.value)}
              placeholder="Erişim anahtarı"
              autoComplete="current-password"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 outline-none focus:border-violet-500"
            />

            {authError ? (
              <p className="text-sm text-red-400">{authError}</p>
            ) : null}

            <button
              type="submit"
              disabled={verifying}
              className="w-full bg-violet-700 hover:bg-violet-600 transition text-white px-5 py-3 rounded-2xl font-semibold border border-violet-500/30 disabled:opacity-50"
            >
              {verifying ? "Doğrulanıyor..." : "Giriş yap"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-black text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.07),transparent_45%)]" />

      <header className="relative z-10 border-b border-zinc-800/80 p-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-[0.28em] text-violet-300">
              HERMES
            </h1>

            <p className="text-zinc-500 text-sm mt-2">
              AI Operating System
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/voice"
              className="bg-violet-700 hover:bg-violet-600 transition px-5 py-3 rounded-2xl font-semibold border border-violet-500/30 shadow-[0_0_18px_rgba(168,85,247,0.22)]"
            >
              Sesli Sohbet
            </a>

            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="bg-zinc-900 border border-zinc-700 px-5 py-3 rounded-2xl hover:bg-zinc-800 transition"
            >
              Düşünme / Araştırma
            </button>
          </div>
        </div>

        {settingsOpen && (
          <div className="max-w-5xl mx-auto mt-5 bg-zinc-950 border border-zinc-800 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-zinc-500 mb-2">Düşünme Tipi</p>

              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3"
              >
                <option>Karışık Düşünme</option>
                <option>Normal</option>
                <option>CEO</option>
                <option>Analist</option>
                <option value="CodeAgent">Code Agent</option>
              </select>
            </div>

            <div>
              <p className="text-zinc-500 mb-2">Çalışma Modu</p>

              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3"
              >
                <option>Hibrit</option>
                <option>Fast</option>
                <option>Deep</option>
                <option>Research</option>
              </select>
            </div>
          </div>
        )}
      </header>

      <section className="relative z-10 flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto space-y-5 pb-32">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`whitespace-pre-wrap p-5 rounded-3xl max-w-[85%] ${
                msg.role === "user"
                  ? "bg-violet-700 text-white ml-auto border border-violet-500/20"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-100"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="relative z-10 border-t border-zinc-800 bg-black/90 p-4"
      >
        <div className="max-w-5xl mx-auto flex gap-3 items-end">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);

              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            placeholder="Hermes'e yaz..."
            className="min-h-[58px] max-h-52 flex-1 resize-none overflow-y-auto bg-zinc-900 text-white p-4 rounded-2xl outline-none border border-zinc-800"
          />

          <button
            disabled={loading}
            className="bg-violet-700 hover:bg-violet-600 transition text-white px-7 py-4 rounded-2xl font-semibold border border-violet-500/20 shadow-[0_0_18px_rgba(168,85,247,0.2)] disabled:opacity-50"
          >
            {loading ? "..." : "Gönder"}
          </button>
        </div>
      </form>

      <button
        onClick={() => setHistoryOpen(!historyOpen)}
        className="fixed bottom-24 right-6 z-30 bg-violet-700 hover:bg-violet-600 transition text-white px-5 py-3 rounded-full border border-violet-500/20 shadow-[0_0_20px_rgba(168,85,247,0.22)]"
      >
        Geçmiş
      </button>

      {historyOpen && (
        <div className="fixed right-6 bottom-40 z-30 w-[360px] max-h-[520px] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl">
          <h3 className="text-xl font-bold mb-4 text-violet-200">
            Yakın Konuşmalar
          </h3>

          <div className="space-y-2">
            {messages
              .filter((msg) => msg.role === "user")
              .slice(-8)
              .reverse()
              .map((msg, index) => (
                <button
                  key={index}
                  className="w-full text-left bg-zinc-900 hover:bg-zinc-800 transition border border-zinc-800 rounded-2xl p-4 text-sm"
                >
                  <p className="text-zinc-200 truncate">{msg.content}</p>

                  <p className="text-zinc-600 text-xs mt-1">Bu oturum</p>
                </button>
              ))}
          </div>
        </div>
      )}
    </main>
  );
}
