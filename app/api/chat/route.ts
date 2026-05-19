import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userMessage = body.message || "";
    let persona = body.persona || "Karışık Düşünme";
    let mode = body.mode || "Hibrit";

    const lower = userMessage.toLowerCase();

    if (
      lower.startsWith("bunu hatırla") ||
      lower.startsWith("bunu hatirla")
    ) {
      const memoryText = userMessage
        .replace(/^bunu hatırla[:：]?\s*/i, "")
        .replace(/^bunu hatirla[:：]?\s*/i, "");

      const { error } = await supabase.from("memory").insert([
        {
          user_id: "kemal",
          content: memoryText,
          category: "manual",
        },
      ]);

      if (error) {
        return Response.json({
          message: "Hafızaya kaydederken hata oldu: " + error.message,
        });
      }

      return Response.json({
        message: "Tamam, bunu hatırlayacağım.",
      });
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
        return Response.json({
          message: "Hafızayı okurken hata oldu: " + error.message,
        });
      }

      if (!data || data.length === 0) {
        return Response.json({
          message: "Şu an kayıtlı bir hafızam yok.",
        });
      }

      const memories = data
        .map((item: any, index: number) => `${index + 1}. ${item.content}`)
        .join("\n");

      return Response.json({
        message: `Hatırladıklarım:\n${memories}`,
      });
    }
if (
  lower.includes("görevlerim") ||
  lower.includes("gorevlerim") ||
  lower.includes("yapılacaklar") ||
  lower.includes("yapilacaklar")
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", "kemal")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({
      message: "Görevler okunurken hata oldu: " + error.message,
    });
  }

  if (!data || data.length === 0) {
    return Response.json({
      message: "Şu anda kayıtlı görevin yok.",
    });
  }

  const taskList = data
    .map(
      (task: any, index: number) =>
        `${index + 1}. ${task.title} (${task.status})`
    )
    .join("\n");

  return Response.json({
    message: `Görevlerin:\n\n${taskList}`,
  });
} 
if (
  lower.startsWith("görevi tamamla") ||
  lower.startsWith("gorevi tamamla") ||
  lower.startsWith("görev tamamla") ||
  lower.startsWith("gorev tamamla")
) {
  const numberMatch = lower.match(/\d+/);
  const taskNumber = numberMatch ? Number(numberMatch[0]) : 1;

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", "kemal")
    .neq("status", "done")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({
      message: "Görevler okunurken hata oldu: " + error.message,
    });
  }

  if (!data || data.length === 0) {
    return Response.json({
      message: "Tamamlanacak aktif görevin yok.",
    });
  }

  const selectedTask = data[taskNumber - 1];

  if (!selectedTask) {
    return Response.json({
      message: `${taskNumber}. sırada aktif görev bulamadım.`,
    });
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: "done" })
    .eq("id", selectedTask.id);

  if (updateError) {
    return Response.json({
      message: "Görev tamamlanırken hata oldu: " + updateError.message,
    });
  }

  return Response.json({
    message: `Tamamlandı: ${selectedTask.title}`,
  });
}
    if (persona === "Karışık Düşünme") {
      if (
        lower.includes("kod") ||
        lower.includes("hata") ||
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
        lower.includes("güncel") ||
        lower.includes("haber") ||
        lower.includes("bugün") ||
        lower.includes("araştır") ||
        lower.includes("son gelişme")
      ) {
        mode = "Research";
      } else if (
        lower.includes("risk") ||
        lower.includes("karar") ||
        lower.includes("strateji") ||
        lower.includes("plan") ||
        lower.includes("analiz")
      ) {
        mode = "Deep";
      } else {
        mode = "Fast";
      }
    }

    const { data: memories } = await supabase
      .from("memory")
      .select("*")
      .eq("user_id", "kemal")
      .order("created_at", { ascending: false })
      .limit(10);

    const memoryContext =
      memories && memories.length > 0
        ? memories.map((m: any) => `- ${m.content}`).join("\n")
        : "Kayıtlı hafıza yok.";

    const personaPrompts: any = {
      Normal:
        "Doğal, kullanıcının hafızadaki tercihine uygun, net ve pratik cevap ver.",

      CEO:
        "CEO gibi düşün. Stratejik, sonuç odaklı, net ve disiplinli cevap ver.",

      Analist:
        "Analist gibi düşün. Tarafsız, mantıklı, artı-eksi ve risk odaklı analiz yap.",

      CodeAgent:
        "Code Agent gibi davran. Next.js, React, TypeScript ve API hatalarını çöz. Dosya adını net söyle.",
    };

    const modePrompt =
      mode === "Research"
        ? "Güncel araştırma yap. Kaynakları dikkatli değerlendir. Emin değilsen belirt."
        : mode === "Deep"
        ? "Derin düşün. Riskleri, seçenekleri ve sonraki adımı belirt."
        : "Hızlı cevap ver.";

    const systemPrompt = `
Sen Hermes adlı kişisel yapay zeka asistanısın.

KULLANICININ KALICI TERCİHLERİ VE BİLGİLERİ:
${memoryContext}

Bu bilgileri cevaplarında doğal şekilde kullan.
Kullanıcının tercihlerini unutma.

${personaPrompts[persona] || personaPrompts.Normal}

Mod: ${mode}
${modePrompt}

Kurallar:
- Türkçe cevap ver.
- Her cevaba "Ben Hermes" diye başlama.
- Sadece ismin sorulursa Hermes olduğunu söyle.
- Cevap uzunluğunu kullanıcının hafızadaki tercihine göre ayarla.
- Hafızadaki bilgileri doğal şekilde kullan.
- Kullanıcının projesi Hermes AI sistemidir.
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
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
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