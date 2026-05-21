import OpenAI from "openai";
import { getBusinessContextPrompt } from "@/lib/hermes/business";
import {
  getAgentContextPrompt,
  selectBestAgentForPrompt,
  formatPlannerAgentHeader,
  type HermesAgent,
} from "@/lib/hermes/agents";
import {
  detectDisallowedRequestIntents,
  formatDisallowedPlanningMessage,
  getPermissionBoundariesForPrompt,
} from "@/lib/hermes/permissions";
import { reviewPlanSafety } from "@/lib/hermes/security-review";
import {
  getResearchContext,
  persistMarketIntelResearch,
  type ResearchSourceType,
} from "@/lib/hermes/research-memory";

export type MarketSignal = {
  title: string;
  sourceType: "inferred" | "needs_web_research";
  insight: string;
  confidence: "low" | "medium" | "high";
};

export type CompetitorProfile = {
  name: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  threatLevel: "low" | "medium" | "high";
};

export type OpportunityScore = {
  overall: number;
  targetMarket: string;
  customerPain: string;
  urgency: "low" | "medium" | "high";
  monetizationPotential: "low" | "medium" | "high";
  competitionRisk: "low" | "medium" | "high";
  rationale: string;
};

export type FounderRecommendation = {
  verdict: "pursue" | "validate" | "pivot" | "avoid";
  summary: string;
  mvpSuggestion: string;
  nextResearchSteps: string[];
  risks: string[];
};

export type MarketIntelResult =
  | { success: true; message: string }
  | { success: false; message: string };

const LIVE_WEB_NOTICE = `> **Not:** Bu analiz canlı web verisi çekmeden üretildi. Güncel rakip/fiyat/ürün doğrulaması için Research modu veya manuel kaynak taraması gerekir.`;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function withMarketContext(
  system: string,
  agent: HermesAgent
): Promise<string> {
  const researchContext = await getResearchContext();

  return `${system}\n\n${getBusinessContextPrompt()}\n\n${getAgentContextPrompt(agent)}\n\n${researchContext}\n\n${getPermissionBoundariesForPrompt()}\n\nKurallar: Canlı web fetch yok; spekülasyonları belirt; dosya yazma/terminal/deploy önerme.`;
}

async function persistMarketCommandResult(params: {
  message: string;
  query: string;
  result: MarketIntelResult;
  sourceType: ResearchSourceType;
}): Promise<MarketIntelResult> {
  if (!params.result.success) {
    return params.result;
  }

  const agent = selectBestAgentForPrompt(params.query);

  void persistMarketIntelResearch({
    sourceType: params.sourceType,
    topic: params.query,
    analysis: params.result.message,
    agentId: agent.id,
  }).catch(() => {});

  return params.result;
}

function guardMarketQuery(query: string): MarketIntelResult | null {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      success: false,
      message: "Pazar analizi için bir konu veya fikir yazmalısın.",
    };
  }

  const intents = detectDisallowedRequestIntents(trimmed);

  if (intents.length > 0) {
    return {
      success: true,
      message: formatDisallowedPlanningMessage(intents),
    };
  }

  return null;
}

function finalizeMarketResult(
  result: MarketIntelResult,
  agent: HermesAgent,
  title: string
): MarketIntelResult {
  if (!result.success) {
    return result;
  }

  const review = reviewPlanSafety(result.message);

  const body = review.safe ? result.message : review.message;

  return {
    success: true,
    message: `## ${title}\n${formatPlannerAgentHeader(agent)}\n\n${LIVE_WEB_NOTICE}\n\n${body}`,
  };
}

async function runMarketIntel(params: {
  query: string;
  system: string;
  title: string;
}): Promise<MarketIntelResult> {
  const blocked = guardMarketQuery(params.query);
  if (blocked) {
    return blocked;
  }

  const openai = getOpenAIClient();

  if (!openai) {
    return {
      success: false,
      message:
        "OpenAI yapılandırması eksik. Pazar analizi için OPENAI_API_KEY gerekli.",
    };
  }

  const agent = selectBestAgentForPrompt(params.query);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: await withMarketContext(params.system, agent),
        },
        {
          role: "user",
          content: `Sorgu / fikir:\n${params.query}`,
        },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim();

    if (!message) {
      return {
        success: false,
        message: "Pazar analizi tamamlandı ama cevap boş geldi.",
      };
    }

    return finalizeMarketResult(
      { success: true, message },
      agent,
      params.title
    );
  } catch (error) {
    return {
      success: false,
      message:
        "Pazar analizi oluşturulamadı: " +
        (error instanceof Error ? error.message : "bilinmeyen hata"),
    };
  }
}

const STRUCTURED_SECTIONS = `
Zorunlu bölümler (Türkçe, net):
1) Hedef pazar (target market)
2) Müşteri acısı (customer pain)
3) Aciliyet (urgency: düşük/orta/yüksek + gerekçe)
4) Monetizasyon potansiyeli
5) Rekabet riski
6) Örnek rakip profilleri (CompetitorProfile: isim, konum, güç/zayıf, tehdit)
7) Pazar sinyalleri (MarketSignal: başlık, içgörü, güven, canlı araştırma gerekir mi)
8) MVP önerisi
9) Sonraki araştırma adımları (web/kullanıcı görüşmesi/landing test)
10) Kurucu önerisi (FounderRecommendation: verdict, özet, riskler)`;

export async function createMarketAnalysis(
  query: string
): Promise<MarketIntelResult> {
  return runMarketIntel({
    query,
    title: "Hermes Pazar Analizi",
    system: `Sen Hermes Market Intelligence katmanısın.
Görev: yapılandırılmış pazar analizi ve araştırma planı üret.
${STRUCTURED_SECTIONS}`,
  });
}

export async function scoreOpportunity(
  query: string
): Promise<MarketIntelResult> {
  return runMarketIntel({
    query,
    title: "Hermes Fırsat Skoru",
    system: `Sen Hermes Market Intelligence katmanısın.
Görev: fırsat skorlama (OpportunityScore).
Önce 0-100 genel skor ver; ardından hedef pazar, acı, aciliyet, monetizasyon, rekabet riski ve gerekçe yaz.
Sonunda MVP ve sonraki araştırma adımlarını ekle.`,
  });
}

export async function suggestResearchQuestions(
  query: string
): Promise<MarketIntelResult> {
  return runMarketIntel({
    query,
    title: "Hermes Araştırma Soruları",
    system: `Sen Hermes Market Intelligence katmanısın.
Görev: rakip ve pazar araştırması için doğrulanabilir soru listesi üret.
Bölümler:
- Müşteri görüşmesi soruları (10)
- Rakip analizi soruları (10) — CompetitorProfile doğrulama
- Pazar büyüklüğü / trend soruları (canlı web gerekir işaretle)
- MVP doğrulama soruları
- Öncelik sırası`,
  });
}

export async function summarizeMarketOpportunity(
  query: string
): Promise<MarketIntelResult> {
  return runMarketIntel({
    query,
    title: "Hermes Fikir Değerlendirmesi",
    system: `Sen Hermes Market Intelligence katmanısın.
Görev: "Bu fikir mantıklı mı?" için kurucu özeti (FounderRecommendation).
Verdict: pursue | validate | pivot | avoid
Kısa özet, hedef pazar, acı, aciliyet, monetizasyon, rekabet, MVP önerisi, riskler ve sonraki adımlar.`,
  });
}

export function extractMarketQuery(
  message: string,
  pattern: RegExp
): string {
  const match = message.match(pattern);
  return match?.[1]?.trim() ?? "";
}

export async function handleMarketRouterCommand(
  message: string
): Promise<MarketIntelResult | null> {
  const lower = message.toLowerCase();

  if (lower.startsWith("pazar analizi:") || lower.startsWith("pazar analizi :")) {
    const query = extractMarketQuery(message, /^pazar\s+analizi\s*:\s*(.+)$/i);

    if (!query) {
      return {
        success: false,
        message: "Kullanım: pazar analizi: <konu veya ürün fikri>",
      };
    }

    return persistMarketCommandResult({
      message,
      query,
      sourceType: "market_analysis",
      result: await createMarketAnalysis(query),
    });
  }

  if (
    lower.startsWith("fırsat analizi:") ||
    lower.startsWith("firsat analizi:") ||
    lower.startsWith("fırsat analizi :") ||
    lower.startsWith("firsat analizi :")
  ) {
    const query =
      extractMarketQuery(message, /^f[ıi]rsat\s+analizi\s*:\s*(.+)$/i) ||
      extractMarketQuery(message, /^firsat\s+analizi\s*:\s*(.+)$/i);

    if (!query) {
      return {
        success: false,
        message: "Kullanım: fırsat analizi: <fikir veya pazar>",
      };
    }

    return persistMarketCommandResult({
      message,
      query,
      sourceType: "opportunity_score",
      result: await scoreOpportunity(query),
    });
  }

  if (
    lower.startsWith("rakip analizi planı:") ||
    lower.startsWith("rakip analizi plani:") ||
    lower.startsWith("rakip analizi planı :") ||
    lower.startsWith("rakip analizi plani :")
  ) {
    const query =
      extractMarketQuery(message, /^rakip\s+analizi\s+plan[ıi]\s*:\s*(.+)$/i) ||
      extractMarketQuery(message, /^rakip\s+analizi\s+plani\s*:\s*(.+)$/i);

    if (!query) {
      return {
        success: false,
        message: "Kullanım: rakip analizi planı: <ürün veya sektör>",
      };
    }

    return persistMarketCommandResult({
      message,
      query,
      sourceType: "competitor_plan",
      result: await suggestResearchQuestions(`Rakip analizi planı: ${query}`),
    });
  }

  if (
    lower.startsWith("bu fikir mantıklı mı:") ||
    lower.startsWith("bu fikir mantikli mi:") ||
    lower.startsWith("bu fikir mantıklı mı :") ||
    lower.startsWith("bu fikir mantikli mi :")
  ) {
    const query =
      extractMarketQuery(message, /^bu\s+fikir\s+mant[ıi]kl[ıi]\s+m[ıi]\s*:\s*(.+)$/i) ||
      extractMarketQuery(message, /^bu\s+fikir\s+mantikli\s+mi\s*:\s*(.+)$/i) ||
      message
        .replace(/bu\s+fikir\s+mant[ıi]kl[ıi]\s+m[ıi]\s*:?\s*/i, "")
        .replace(/bu\s+fikir\s+mantikli\s+mi\s*:?\s*/i, "")
        .trim();

    if (!query) {
      return {
        success: false,
        message: "Kullanım: bu fikir mantıklı mı: <fikir açıklaması>",
      };
    }

    return persistMarketCommandResult({
      message,
      query,
      sourceType: "founder_review",
      result: await summarizeMarketOpportunity(query),
    });
  }

  return null;
}
