import { saveMemory, listMemories } from "@/lib/hermes/memory";
import { handleHermesMessage } from "@/lib/hermes/router";

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

      const result = await saveMemory(memoryText, "telegram");

      await sendTelegramMessage(
        chatId,
        result.message || "Hafıza işlemi tamamlandı."
      );

      return Response.json({ ok: true });
    }

    if (
      lower.includes("ne hatırlıyorsun") ||
      lower.includes("ne hatirliyorsun") ||
      lower.includes("hafızanda ne var") ||
      lower.includes("hafizanda ne var")
    ) {
      const result = await listMemories();

      await sendTelegramMessage(
        chatId,
        result.message || "Hafıza listesi boş."
      );

      return Response.json({ ok: true });
    }

    const chatResult = await handleHermesMessage({
      message: text,
      selectedPersona: "Karışık Düşünme",
      selectedMode: "Fast",
    });

    await sendTelegramMessage(
      chatId,
      chatResult.message || "Cevap oluşturamadım."
    );

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
}
