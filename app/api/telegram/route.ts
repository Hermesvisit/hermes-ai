import { supabase } from "@/lib/supabase";

async function sendTelegramMessage(chatId: number, text: string) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!TELEGRAM_TOKEN) return;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "Hermes Telegram route is alive.",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const chatId = body?.message?.chat?.id;
    const text = body?.message?.text || "";

    if (!chatId || !text) {
      return Response.json({ ok: true });
    }

    const lower = text.toLowerCase();

    if (
      lower.startsWith("bunu hatırla") ||
      lower.startsWith("bunu hatirla")
    ) {
      const memoryText = text
        .replace(/^bunu hatırla[:：]?\s*/i, "")
        .replace(/^bunu hatirla[:：]?\s*/i, "");

      const { error } = await supabase.from("memory").insert([
        {
          user_id: "kemal",
          content: memoryText,
          category: "telegram",
        },
      ]);

      await sendTelegramMessage(
        chatId,
        error
          ? "Hafızaya kaydederken hata oldu: " + error.message
          : "Tamam, bunu hatırlayacağım."
      );

      return Response.json({ ok: true });
    }

    if (
      lower.includes("ne hatırlıyorsun") ||
      lower.includes("ne hatirliyorsun") ||
      lower.includes("hafızanda ne var") ||
      lower.includes("hafizanda ne var")
    ) {
      const { data, error } = await supabase
        .from("memory")
        .select("*")
        .eq("user_id", "kemal")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        await sendTelegramMessage(
          chatId,
          "Hafızayı okurken hata oldu: " + error.message
        );
        return Response.json({ ok: true });
      }

      if (!data || data.length === 0) {
        await sendTelegramMessage(chatId, "Şu an kayıtlı bir hafızam yok.");
        return Response.json({ ok: true });
      }

      const memories = data
        .map((item: any, index: number) => `${index + 1}. ${item.content}`)
        .join("\n");

      await sendTelegramMessage(chatId, `Hatırladıklarım:\n\n${memories}`);
      return Response.json({ ok: true });
    }

    const chatResponse = await fetch(new URL("/api/chat", req.url), {
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

    const chatData = await chatResponse.json();

    await sendTelegramMessage(
      chatId,
      chatData.message || "Cevap oluşturamadım."
    );

    return Response.json({ ok: true });
  } catch (error: any) {
    return Response.json({
      ok: false,
      error: error.message,
    });
  }
}