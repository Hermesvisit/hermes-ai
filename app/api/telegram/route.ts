import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("Telegram body:", body);

    const chatId = body?.message?.chat?.id;
    const text = body?.message?.text;
    const firstName =
      body?.message?.from?.first_name || "Kullanıcı";

    if (!chatId || !text) {
      return Response.json({ ok: true });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Sen Hermes'sin.

Sen:
- gelişmiş kişisel yapay zeka asistansın
- aile sistemi için çalışıyorsun
- doğal konuşursun
- kısa ama akıllı cevap verirsin
- Türkçe konuşursun
- ismin sorulursa Hermes olduğunu söylersin
- kullanıcıyı tanımaya çalışırsın
- yardımcı, doğal ve modern davranırsın

Kurallar:
- Gereksiz uzun yazma
- Samimi ama kontrollü ol
- Kullanıcıya yardımcı olmaya odaklan
- Kod sorularında teknik davran
- Günlük sorularda doğal davran
          `,
        },
        {
          role: "user",
          content: `
Kullanıcı adı: ${firstName}

Mesaj:
${text}
          `,
        },
      ],
    });

    const reply =
      completion.choices[0].message.content ||
      "Şu an cevap oluşturamadım.";

    const telegramResponse = await fetch(
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

    const telegramData = await telegramResponse.json();

    console.log("Telegram response:", telegramData);

    return Response.json({
      ok: true,
    });
  } catch (error: any) {
    console.log("Telegram ERROR:", error);

    return Response.json({
      ok: false,
      error: error.message,
    });
  }
}