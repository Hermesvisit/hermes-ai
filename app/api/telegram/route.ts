import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const chatId = body.message.chat.id;
    const text = body.message.text;

    if (!text) {
      return Response.json({ ok: true });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Sen Hermes'sin. Türkçe konuş. Kısa, akıllı ve yardımcı cevap ver.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const reply =
      completion.choices[0].message.content ||
      "Bir cevap oluşturamadım.";

    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply,
        }),
      }
    );

    return Response.json({ ok: true });
  } catch (error: any) {
    return Response.json({
      ok: false,
      error: error.message,
    });
  }
}