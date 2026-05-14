"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState("Normal");
  const [mode, setMode] = useState("Fast");
  const [messages, setMessages] = useState([
    { role: "ai", content: "Merhaba. Ben Hermes." },
  ]);

  const sendMessage = async () => {
    const currentMessage = message.trim();
    if (!currentMessage || loading) return;

    setMessages((prev: any) => [
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
        },
        body: JSON.stringify({
          message: currentMessage,
          persona,
          mode,
        }),
      });

      const data = await response.json();

      setMessages((prev: any) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ai",
          content: data.message || "Cevap boş geldi.",
        };
        return updated;
      });
    } catch (error: any) {
      setMessages((prev: any) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ai",
          content: "Bağlantı hatası: " + error.message,
        };
        return updated;
      });
    }

    setLoading(false);
  };

  return (
    <main className="h-screen bg-black text-white flex flex-col">
      <header className="border-b border-zinc-800 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xl font-bold">NeuroCore</div>

          <div className="flex gap-2">
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="bg-zinc-900 text-white border border-zinc-700 rounded-xl px-3 py-2 outline-none"
            >
              <option value="Normal">Normal</option>
              <option value="CEO">CEO</option>
              <option value="Analist">Analist</option>
              <option value="CodeAgent">Code Agent</option>
            </select>

            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="bg-zinc-900 text-white border border-zinc-700 rounded-xl px-3 py-2 outline-none"
            >
              <option value="Fast">Fast</option>
              <option value="Deep">Deep</option>
              <option value="Research">Research</option>
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`whitespace-pre-wrap p-4 rounded-2xl w-fit max-w-[85%] ${
                msg.role === "user"
                  ? "bg-white text-black ml-auto"
                  : "bg-zinc-900"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="border-t border-zinc-800 p-3 bg-black"
      >
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ne düşünüyorsun?"
            className="min-w-0 flex-1 bg-zinc-900 text-white p-4 rounded-2xl outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="shrink-0 bg-white text-black px-5 rounded-2xl font-semibold disabled:opacity-50"
          >
            {loading ? "..." : "Gönder"}
          </button>
        </div>
      </form>
    </main>
  );
}