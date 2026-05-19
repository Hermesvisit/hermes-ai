import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    if (!OPENAI_API_KEY || !TELEGRAM_TOKEN) {
      return Response.json({
        ok: false,
        error: "Missing environment variables",
      });
    }

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const body = await req.json();

    const chatId = body?.message?.chat?.id;
    const text = body?.message?.text;
    const firstName = body?.message?.from?.first_name || "Kullanıcı";

    if (!chatId || !text) {
      return Response.json({ ok: true });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Sen Hermes adlı aile içi kişisel yapay zeka asistanısın.
Türkçe konuş.
Kısa, doğal, akıllı ve yardımcı cevap ver.
Her cevaba "Ben Hermes" diye başlama.
Sadece ismin sorulursa Hermes olduğunu söyle.
Aile kullanımına uygun sade konuş.
`,
        },
        {
          role: "user",
          content: `Kullanıcı adı: ${firstName}\nMesaj: ${text}`,
        },
      ],
    });

    const reply =
      completion.choices[0].message.content || "Cevap oluşturamadım.";

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