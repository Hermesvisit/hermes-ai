"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export default function TestMemoryPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");

  const saveMemory = async () => {
    setResult("Kaydediliyor...");

    const client = getSupabaseClient();

    if (!client) {
      setResult("Supabase kullanılamıyor. Ortam değişkenlerini kontrol et.");
      return;
    }

    try {
      const { error } = await client.from("memory").insert([
        {
          user_id: "kemal",
          content: text,
          category: "general",
        },
      ]);

      if (error) {
        setResult("Hata: " + error.message);
      } else {
        setResult("Hafıza kaydedildi 😄");
      }
    } catch (error) {
      setResult(
        "Bağlantı hatası: " +
          (error instanceof Error ? error.message : "bilinmeyen hata")
      );
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-10">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h1 className="text-3xl font-bold mb-6 text-violet-300">
          Hermes Memory Test
        </h1>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bir hafıza yaz..."
          className="w-full h-40 bg-black border border-zinc-700 rounded-2xl p-4 outline-none"
        />

        <button
          onClick={saveMemory}
          className="mt-5 bg-violet-700 hover:bg-violet-600 px-6 py-3 rounded-2xl"
        >
          Hafızaya Kaydet
        </button>

        {result && <p className="mt-5 text-zinc-300">{result}</p>}
      </div>
    </main>
  );
}