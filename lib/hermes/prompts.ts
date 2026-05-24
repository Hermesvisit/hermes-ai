import { getBusinessContextPrompt } from "@/lib/hermes/business";
import { getAgentContextPrompt, type HermesAgent } from "@/lib/hermes/agents";
import { getSectorContextPrompt } from "@/lib/hermes/sectors";
import {
  getBusinessContextPrompt as getBusinessInstanceContextPrompt,
} from "@/lib/hermes/business-instances";

export type HermesPersona = "Normal" | "CEO" | "Analist" | "CodeAgent";
export type HermesMode = "Fast" | "Deep" | "Research";

export function detectPersona(message: string, selectedPersona: string): HermesPersona {
  const lower = message.toLowerCase();

  if (selectedPersona !== "Karışık Düşünme") {
    return selectedPersona as HermesPersona;
  }

  if (
    lower.includes("kod") ||
    lower.includes("hata") ||
    lower.includes("terminal") ||
    lower.includes("tsx") ||
    lower.includes("route") ||
    lower.includes("api") ||
    lower.includes("vercel") ||
    lower.includes("supabase")
  ) {
    return "CodeAgent";
  }

  if (
    lower.includes("risk") ||
    lower.includes("analiz") ||
    lower.includes("karşılaştır") ||
    (lower.includes("mantıklı mı") &&
      !lower.startsWith("bu fikir mantıklı mı") &&
      !lower.startsWith("bu fikir mantikli mi"))
  ) {
    return "Analist";
  }

  if (
    lower.includes("iş") ||
    lower.includes("para") ||
    lower.includes("girişim") ||
    lower.includes("strateji") ||
    lower.includes("plan")
  ) {
    return "CEO";
  }

  return "Normal";
}

export function detectMode(message: string, selectedMode: string): HermesMode {
  const lower = message.toLowerCase();

  if (selectedMode !== "Hibrit") {
    return selectedMode as HermesMode;
  }

  if (
    lower.includes("güncel") ||
    lower.includes("haber") ||
    lower.includes("bugün") ||
    lower.includes("araştır") ||
    lower.includes("son gelişme")
  ) {
    return "Research";
  }

  if (
    lower.includes("risk") ||
    lower.includes("karar") ||
    lower.includes("strateji") ||
    lower.includes("plan") ||
    lower.includes("analiz")
  ) {
    return "Deep";
  }

  return "Fast";
}

export function buildSystemPrompt(params: {
  memoryContext: string;
  researchContext: string;
  sectorContext?: string;
  businessInstanceContext?: string;
  persona: HermesPersona;
  mode: HermesMode;
  agent: HermesAgent;
}) {
  const {
    memoryContext,
    researchContext,
    sectorContext,
    businessInstanceContext,
    persona,
    mode,
    agent,
  } = params;

  const personaPrompts: Record<HermesPersona, string> = {
    Normal:
      "Doğal, kullanıcının hafızadaki tercihine uygun, net ve pratik cevap ver.",

    CEO:
      "CEO gibi düşün. Stratejik, sonuç odaklı, net ve disiplinli cevap ver.",

    Analist:
      "Analist gibi düşün. Tarafsız, mantıklı, artı-eksi ve risk odaklı analiz yap.",

    CodeAgent:
      "Developer AI gibi davran. Next.js, React, TypeScript, Supabase, OpenAI API ve Vercel hatalarını çöz. Dosya adını net söyle. Değişiklik önerirken amaç, etkilenen dosya, risk, test ve geri alma planı belirt.",
  };

  const modePrompt =
    mode === "Research"
      ? "Güncel araştırma yap. Kaynakları dikkatli değerlendir. Emin değilsen belirt."
      : mode === "Deep"
      ? "Derin düşün. Riskleri, seçenekleri ve sonraki adımı belirt."
      : "Hızlı cevap ver.";

  return `
Sen Hermes adlı kişisel yapay zeka işletim sistemisin.

KULLANICININ KALICI TERCİHLERİ VE BİLGİLERİ:
${memoryContext}

${getBusinessContextPrompt()}

${getAgentContextPrompt(agent)}

${sectorContext ?? getSectorContextPrompt()}

${businessInstanceContext ?? getBusinessInstanceContextPrompt()}

${researchContext}

Hermes'in uzun vadeli vizyonu:
- Personal AI
- Developer AI
- Business OS
- Agent Builder
- Memory System
- Permission Layer
- Control Panel

Sistemin hedefi:
Kullanıcının kişisel yapay zekası olmak, yazılım geliştirme sürecinde ona yardımcı olmak, ileride Business OS ve sektör zekalarını yönetmek.

${personaPrompts[persona]}

Mod: ${mode}
${modePrompt}

Kurallar:
- Türkçe cevap ver.
- Her cevaba "Ben Hermes" diye başlama.
- Sadece ismin sorulursa Hermes olduğunu söyle.
- Cevap uzunluğunu kullanıcının isteğine göre ayarla.
- Kod değişikliği önerirken rastgele ilerleme.
- Büyük değişikliklerde önce amaç, etkilenen dosyalar, risk, test ve rollback mantığını belirt.
`;
}