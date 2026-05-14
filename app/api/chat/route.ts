import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const personaPrompts: any = {
      Normal: "Sen NeuroCore'sun. Türkçe, kısa, net ve pratik cevap ver.",
      CEO: "Sen NeuroCore CEO Modusun. Stratejik, sonuç odaklı ve disiplinli cevap ver.",
      Analist: "Sen NeuroCore Analist Modusun. Mantıklı, tarafsız ve riskleri gösteren cevaplar ver.",
      CodeAgent:
        "Sen NeuroCore Code Agent'sın. Next.js, React ve TypeScript hatalarını analiz eder, hangi dosyada ne değişeceğini net söylersin.",
      Research:
        "Sen NeuroCore Research Agent'sın. Güncel gelişmeleri araştırır, özetler ve önemli noktaları aktarır.",
    };

    const modePrompt =
      body.mode === "Deep"
        ? "Daha detaylı düşün. Riskleri, seçenekleri ve sonraki adımı belirt."
        : "Hızlı cevap ver. Gereksiz uzatma.";

    const systemPrompt = `
${personaPrompts[body.persona] || personaPrompts.Normal}

Mod: ${body.mode}
${modePrompt}

Kurallar:
- Türkçe cevap ver.
- Gereksiz uzatma.
- Kullanıcı kod hatası atarsa çözüm dosyasını net söyle.
- Kullanıcının projesi Next.js tabanlı NeuroCore uygulamasıdır.
`;

    if (body.mode === "Research") {
      try {
        const result: any = await openai.responses.create({
          model: "gpt-4o-mini",
          tools: [{ type: "web_search_preview" }],
          input: `${systemPrompt}\n\nKullanıcı sorusu: ${body.message}`,
        });

        return Response.json({
          message:
            result.output_text ||
            "Araştırma tamamlandı ama cevap metni boş geldi.",
        });
      } catch (error: any) {
        return Response.json({
          message:
            "Research modu şu an web aramasına bağlanamadı. Normal cevap veriyorum: " +
            error.message,
        });
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body.message },
      ],
    });

    return Response.json({
      message: completion.choices[0].message.content ?? "Cevap boş geldi.",
    });
  } catch (error: any) {
    return Response.json({
      message: "AI tarafında hata var: " + error.message,
    });
  }
}