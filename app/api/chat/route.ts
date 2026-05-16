import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userMessage = body.message || "";
    let persona = body.persona || "Normal";
    let mode = body.mode || "Fast";

    const lower = userMessage.toLowerCase();

    if (persona === "Karışık Düşünme") {
      if (
        lower.includes("hata") ||
        lower.includes("kod") ||
        lower.includes("terminal") ||
        lower.includes("tsx") ||
        lower.includes("route")
      ) {
        persona = "CodeAgent";
      } else if (
        lower.includes("risk") ||
        lower.includes("analiz") ||
        lower.includes("karşılaştır") ||
        lower.includes("mantıklı mı")
      ) {
        persona = "Analist";
      } else if (
        lower.includes("iş") ||
        lower.includes("para") ||
        lower.includes("girişim") ||
        lower.includes("strateji") ||
        lower.includes("plan")
      ) {
        persona = "CEO";
      } else {
        persona = "Normal";
      }
    }

    if (mode === "Hibrit") {
      if (
        lower.includes("bugün") ||
        lower.includes("güncel") ||
        lower.includes("haber") ||
        lower.includes("araştır") ||
        lower.includes("son gelişme")
      ) {
        mode = "Research";
      } else if (
        lower.includes("karar") ||
        lower.includes("risk") ||
        lower.includes("strateji") ||
        lower.includes("plan") ||
        lower.includes("analiz")
      ) {
        mode = "Deep";
      } else {
        mode = "Fast";
      }
    }

    const personaPrompts: any = {
      Normal:
        "Doğal, kısa, net ve pratik cevap ver.",
      CEO:
        "CEO modu gibi düşün. Stratejik, sonuç odaklı, disiplinli ve net cevap ver. Kullanıcının zamanını, parasını ve enerjisini koru.",
      Analist:
        "Analist gibi düşün. Mantıklı, tarafsız, artı-eksi ve risk odaklı analiz yap.",
      CodeAgent:
        "Code Agent gibi davran. Next.js, React, TypeScript ve API hatalarını analiz et. Hangi dosyada ne değişeceğini net söyle.",
    };

    const modePrompt =
      mode === "Deep"
        ? "Derin düşün. Riskleri, seçenekleri, avantajları ve sonraki adımı belirt."
        : mode === "Research"
        ? "Güncel araştırma yap. Kaynakları dikkatli değerlendir. Emin olmadığın yerde kesin konuşma."
        : "Hızlı cevap ver. Gereksiz uzatma.";

    const systemPrompt = `
Sen Hermes adlı kişisel yapay zeka asistanısın.

${personaPrompts[persona] || personaPrompts.Normal}

Çalışma modu: ${mode}
${modePrompt}

Kurallar:
- Türkçe cevap ver.
- Gereksiz uzatma.
- Her cevaba "Ben Hermes" diye başlama.
- Kendini sürekli tanıtma.
- Sadece kullanıcı adını sorarsa Hermes olduğunu söyle.
- Normal konuşmada direkt cevap ver.
- Kod gerekiyorsa dosya adını net söyle.
- Kullanıcının projesi Hermes AI sistemidir.
- Eğer soru belirsizse en mantıklı varsayımı yap ve belirt.
`;

    if (mode === "Research") {
      const result: any = await openai.responses.create({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: `${systemPrompt}\n\nKullanıcı sorusu: ${userMessage}`,
      });

      return Response.json({
        message:
          result.output_text ||
          "Araştırma tamamlandı ama cevap metni boş geldi.",
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    return Response.json({
      message: completion.choices[0].message.content ?? "Cevap boş geldi.",
    });
  } catch (error: any) {
    return Response.json({
      message: "Hermes tarafında hata var: " + error.message,
    });
  }
}