import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userMessage = body.message || "";
    let persona = body.persona || "Karışık Düşünme";
    let mode = body.mode || "Hibrit";

    const lower = userMessage.toLowerCase();

    if (persona === "Karışık Düşünme") {
      if (lower.includes("kod") || lower.includes("hata") || lower.includes("terminal")) persona = "CodeAgent";
      else if (lower.includes("risk") || lower.includes("analiz") || lower.includes("karşılaştır")) persona = "Analist";
      else if (lower.includes("iş") || lower.includes("para") || lower.includes("girişim") || lower.includes("strateji")) persona = "CEO";
      else persona = "Normal";
    }

    if (mode === "Hibrit") {
      if (lower.includes("güncel") || lower.includes("haber") || lower.includes("bugün") || lower.includes("araştır")) mode = "Research";
      else if (lower.includes("risk") || lower.includes("karar") || lower.includes("strateji") || lower.includes("plan")) mode = "Deep";
      else mode = "Fast";
    }

    const personaPrompts: any = {
      Normal: "Doğal, kısa, net ve pratik cevap ver.",
      CEO: "CEO gibi düşün. Stratejik, sonuç odaklı, net ve disiplinli cevap ver.",
      Analist: "Analist gibi düşün. Tarafsız, mantıklı, artı-eksi ve risk odaklı analiz yap.",
      CodeAgent: "Code Agent gibi davran. Next.js, React, TypeScript ve API hatalarını çöz. Dosya adını net söyle.",
    };

    const modePrompt =
      mode === "Research"
        ? "Güncel araştırma yap. Kaynakları dikkatli değerlendir. Emin değilsen belirt."
        : mode === "Deep"
        ? "Derin düşün. Riskleri, seçenekleri ve sonraki adımı belirt."
        : "Hızlı cevap ver. Gereksiz uzatma.";

    const systemPrompt = `
Sen Hermes adlı kişisel yapay zeka asistanısın.

${personaPrompts[persona] || personaPrompts.Normal}

Mod: ${mode}
${modePrompt}

Kurallar:
- Türkçe cevap ver.
- Her cevaba "Ben Hermes" diye başlama.
- Sadece ismin sorulursa Hermes olduğunu söyle.
- Gereksiz uzatma.
- Kullanıcının projesi Hermes AI sistemidir.
`;

    if (mode === "Research") {
      const result: any = await openai.responses.create({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: `${systemPrompt}\n\nKullanıcı sorusu: ${userMessage}`,
      });

      return Response.json({
        message: result.output_text || "Araştırma tamamlandı ama cevap boş geldi.",
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
    return Response.json({ message: "Hermes tarafında hata var: " + error.message });
  }
}