import {
  describeSupabaseError,
  formatHermesInsertFallbackMessage,
  getSupabaseClient,
  logHermesSupabaseInsert,
} from "@/lib/supabase";
import { USER_ID } from "@/lib/hermes/memory";
import type { AgentId } from "@/lib/hermes/agents";

export type ResearchSourceType =
  | "market_analysis"
  | "opportunity_score"
  | "competitor_plan"
  | "founder_review";

export type ResearchMemory = {
  id: string;
  topic: string;
  summary: string;
  tags: string[];
  score: number | null;
  created_at: string;
  sourceType: ResearchSourceType;
  agentId: string;
};

export type OpportunityHistory = ResearchMemory & {
  sourceType: "opportunity_score";
};

export type CompetitorMemory = ResearchMemory & {
  sourceType: "competitor_plan";
};

export type TrendMemory = ResearchMemory & {
  sourceType: "market_analysis" | "founder_review";
};

export type ResearchMemoryResult =
  | { success: true; message: string; data?: ResearchMemory[] }
  | { success: false; message: string };

const LOCAL_MAX = 100;
const SUMMARY_STORE_MAX = 4000;
const CONTEXT_MAX = 8;

const localResearchMemories: ResearchMemory[] = [];

function createLocalId(): string {
  return `research-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTags(tags: string[] | undefined, sourceType: ResearchSourceType): string[] {
  const base = [sourceType, "research", "market-intel"];
  const merged = [...base, ...(tags ?? [])]
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(merged)].slice(0, 12);
}

function normalizeSourceType(value: unknown): ResearchSourceType {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (raw === "opportunity_score" || raw === "opportunity" || raw === "firsat_analizi") {
    return "opportunity_score";
  }

  if (raw === "founder_review" || raw === "founder") {
    return "founder_review";
  }

  if (raw === "competitor_plan" || raw === "competitor") {
    return "competitor_plan";
  }

  if (raw === "market_analysis" || raw === "market") {
    return "market_analysis";
  }

  return "market_analysis";
}

function isOpportunityScoreRecord(item: ResearchMemory): boolean {
  return (
    normalizeSourceType(item.sourceType) === "opportunity_score" ||
    item.tags.some((tag) => tag === "opportunity_score")
  );
}

function mapRowToMemory(row: Record<string, unknown>): ResearchMemory {
  const tagsValue = row.tags;

  let tags: string[] = [];

  if (Array.isArray(tagsValue)) {
    tags = tagsValue.filter((item): item is string => typeof item === "string");
  } else if (typeof tagsValue === "string") {
    try {
      const parsed: unknown = JSON.parse(tagsValue);
      if (Array.isArray(parsed)) {
        tags = parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      tags = tagsValue.split(",").map((item) => item.trim());
    }
  }

  return {
    id: String(row.id ?? createLocalId()),
    topic: String(row.topic ?? ""),
    summary: String(row.summary ?? ""),
    tags,
    score:
      typeof row.score === "number"
        ? row.score
        : row.score === null || row.score === undefined
        ? null
        : Number(row.score),
    created_at: String(row.created_at ?? new Date().toISOString()),
    sourceType: normalizeSourceType(row.source_type ?? row.sourceType),
    agentId: String(row.agent_id ?? row.agentId ?? "RESEARCH_AGENT"),
  };
}

function rememberLocally(entry: ResearchMemory) {
  localResearchMemories.unshift(entry);

  if (localResearchMemories.length > LOCAL_MAX) {
    localResearchMemories.length = LOCAL_MAX;
  }
}

export function extractScoreFromAnalysis(text: string): number | null {
  const patterns = [
    /genel\s*skor\s*[:：]?\s*(\d{1,3})/i,
    /overall\s*[:：]?\s*(\d{1,3})/i,
    /(\d{1,3})\s*\/\s*100/,
    /skor\s*[:：]?\s*(\d{1,3})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const value = Number(match[1]);

      if (Number.isFinite(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  }

  return null;
}

export async function saveResearchMemory(input: {
  topic: string;
  summary: string;
  tags?: string[];
  score?: number | null;
  sourceType: ResearchSourceType;
  agentId: AgentId | string;
}): Promise<ResearchMemoryResult> {
  const topic = input.topic.trim();
  const summary = input.summary.trim().slice(0, SUMMARY_STORE_MAX);

  if (!topic || !summary) {
    return {
      success: false,
      message: "Araştırma hafızası için konu ve özet gerekli.",
    };
  }

  const entry: ResearchMemory = {
    id: createLocalId(),
    topic,
    summary,
    tags: normalizeTags(input.tags, input.sourceType),
    score: input.score ?? null,
    created_at: new Date().toISOString(),
    sourceType: input.sourceType,
    agentId: input.agentId,
  };

  const client = getSupabaseClient();

  if (!client) {
    rememberLocally(entry);
    return {
      success: true,
      message: "Araştırma hafızasına kaydedildi (yerel).",
      data: [entry],
    };
  }

  try {
    const { data, error } = await client
      .from("research_memory")
      .insert([
        {
          user_id: USER_ID,
          topic: entry.topic,
          summary: entry.summary,
          tags: entry.tags,
          score: entry.score,
          source_type: entry.sourceType,
          agent_id: entry.agentId,
        },
      ])
      .select()
      .single();

    if (error) {
      logHermesSupabaseInsert("research_memory", "saveResearchMemory", error);
      rememberLocally(entry);
      return {
        success: true,
        message: formatHermesInsertFallbackMessage(
          "Araştırma hafızasına kaydedildi.",
          describeSupabaseError(error)
        ),
        data: [entry],
      };
    }

    const saved = data ? mapRowToMemory(data as Record<string, unknown>) : entry;
    rememberLocally(saved);

    return {
      success: true,
      message: "Araştırma hafızasına kaydedildi.",
      data: [saved],
    };
  } catch (error) {
    logHermesSupabaseInsert("research_memory", "saveResearchMemory", error);
    rememberLocally(entry);
    return {
      success: true,
      message: formatHermesInsertFallbackMessage(
        "Araştırma hafızasına kaydedildi.",
        describeSupabaseError(error)
      ),
      data: [entry],
    };
  }
}

async function loadMemories(limit = 30): Promise<ResearchMemory[]> {
  const merged = new Map<string, ResearchMemory>();

  for (const item of localResearchMemories) {
    merged.set(item.id, item);
  }

  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from("research_memory")
        .select("*")
        .eq("user_id", USER_ID)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!error && data) {
        for (const row of data) {
          const memory = mapRowToMemory(row as Record<string, unknown>);
          merged.set(memory.id, memory);
        }
      }
    } catch {
      // Yerel kayıtlarla devam
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

function parseComparisonIdeas(query: string): string[] {
  const raw = query.trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(
      /\n+|(?:\s+vs\.?\s+)|(?:\s+veya\s+)|(?:\s+ile\s+)|(?:\s*,\s*|;|\|)/i
    )
    .map((part) => part.replace(/^[-*•\d.)\]]+\s*/, "").trim())
    .filter((part) => part.length >= 2);
}

function topicMatchesIdea(idea: string, item: ResearchMemory): boolean {
  const ideaLower = idea.toLowerCase().trim();
  const topicLower = item.topic.toLowerCase();
  const summaryLower = item.summary.toLowerCase();

  if (!ideaLower) {
    return false;
  }

  if (
    topicLower.includes(ideaLower) ||
    ideaLower.includes(topicLower) ||
    summaryLower.includes(ideaLower)
  ) {
    return true;
  }

  const ideaTokens = ideaLower.split(/\s+/).filter((token) => token.length > 2);

  if (ideaTokens.length === 0) {
    return topicLower.includes(ideaLower);
  }

  const matchedCount = ideaTokens.filter(
    (token) => topicLower.includes(token) || summaryLower.includes(token)
  ).length;

  if (ideaTokens.length === 1) {
    return matchedCount >= 1;
  }

  return matchedCount >= Math.min(2, ideaTokens.length) || matchedCount >= 1;
}

function rankByScore(items: ResearchMemory[]): ResearchMemory[] {
  return [...items].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

function sortByCreatedAt(items: ResearchMemory[]): ResearchMemory[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function getOpportunityScoreRecords(memories: ResearchMemory[]): ResearchMemory[] {
  return sortByCreatedAt(memories.filter(isOpportunityScoreRecord));
}

function selectOpportunitiesForCompare(
  opportunities: ResearchMemory[],
  query: string
): ResearchMemory[] {
  const ideas = parseComparisonIdeas(query);

  if (ideas.length >= 2) {
    const matched: ResearchMemory[] = [];

    for (const idea of ideas) {
      const candidates = opportunities.filter((item) => topicMatchesIdea(idea, item));

      if (candidates.length === 0) {
        continue;
      }

      const best = rankByScore(candidates)[0];

      if (best && !matched.some((item) => item.id === best.id)) {
        matched.push(best);
      }
    }

    if (matched.length >= 2) {
      return rankByScore(matched).slice(0, 2);
    }
  }

  if (ideas.length === 1) {
    const matched = rankByScore(
      opportunities.filter((item) => topicMatchesIdea(ideas[0], item))
    );

    if (matched.length >= 2) {
      return matched.slice(0, 2);
    }

    if (matched.length === 1) {
      const other = rankByScore(
        opportunities.filter((item) => item.id !== matched[0].id)
      )[0];

      if (other) {
        return rankByScore([matched[0], other]);
      }
    }
  }

  const needle = query.trim().toLowerCase();

  if (needle) {
    const matched = rankByScore(
      opportunities.filter(
        (item) =>
          topicMatchesIdea(needle, item) ||
          item.topic.toLowerCase().includes(needle) ||
          item.summary.toLowerCase().includes(needle)
      )
    );

    if (matched.length >= 2) {
      return matched.slice(0, 2);
    }
  }

  return sortByCreatedAt(opportunities).slice(0, 2);
}

export async function listResearchMemories(
  limit = 20
): Promise<ResearchMemoryResult> {
  const memories = await loadMemories(limit);

  if (memories.length === 0) {
    return {
      success: true,
      message: "Kayıtlı araştırma hafızası yok.",
      data: [],
    };
  }

  const lines = memories.map(
    (item, index) =>
      `${index + 1}. [${item.sourceType}] ${item.topic}${item.score !== null ? ` (skor: ${item.score})` : ""} — ${item.created_at.slice(0, 10)}`
  );

  return {
    success: true,
    message: `## Araştırma Hafızası\n\n${lines.join("\n")}`,
    data: memories,
  };
}

export async function searchResearchMemories(
  query: string,
  limit = 15
): Promise<ResearchMemoryResult> {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return listResearchMemories(limit);
  }

  const memories = await loadMemories(LOCAL_MAX);
  const matched = memories
    .filter(
      (item) =>
        item.topic.toLowerCase().includes(needle) ||
        item.summary.toLowerCase().includes(needle) ||
        item.tags.some((tag) => tag.includes(needle))
    )
    .slice(0, limit);

  if (matched.length === 0) {
    return {
      success: true,
      message: `"${query}" için araştırma kaydı bulunamadı.`,
      data: [],
    };
  }

  const lines = matched.map(
    (item, index) =>
      `${index + 1}. [${item.sourceType}] ${item.topic}${item.score !== null ? ` (${item.score})` : ""}\n   ${item.summary.slice(0, 180)}...`
  );

  return {
    success: true,
    message: `## Arama: ${query}\n\n${lines.join("\n\n")}`,
    data: matched,
  };
}

export async function summarizeResearchHistory(): Promise<ResearchMemoryResult> {
  const memories = await loadMemories(30);

  if (memories.length === 0) {
    return {
      success: true,
      message: "Henüz araştırma geçmişi yok. `pazar analizi:` veya `fırsat analizi:` ile başlayabilirsin.",
      data: [],
    };
  }

  const byType = new Map<ResearchSourceType, number>();

  for (const item of memories) {
    byType.set(item.sourceType, (byType.get(item.sourceType) ?? 0) + 1);
  }

  const scored = memories.filter((item) => item.score !== null);
  const top = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);

  const typeLines = [...byType.entries()]
    .map(([type, count]) => `- ${type}: ${count}`)
    .join("\n");

  const topLines =
    top.length > 0
      ? top
          .map(
            (item, index) =>
              `${index + 1}. ${item.topic} — skor ${item.score} (${item.agentId})`
          )
          .join("\n")
      : "Skorlu fırsat kaydı yok.";

  const recent = memories
    .slice(0, 5)
    .map(
      (item, index) =>
        `${index + 1}. ${item.topic} [${item.sourceType}] — ${item.summary.slice(0, 120)}...`
    )
    .join("\n");

  return {
    success: true,
    message: `## Araştırma Geçmişi Özeti

**Toplam kayıt:** ${memories.length}

**Türlere göre:**
${typeLines}

**En yüksek skorlu fırsatlar:**
${topLines}

**Son kayıtlar:**
${recent}`,
    data: memories,
  };
}

export async function compareOpportunities(
  query = ""
): Promise<ResearchMemoryResult> {
  const opportunityScores = getOpportunityScoreRecords(
    await loadMemories(LOCAL_MAX)
  );

  if (opportunityScores.length < 2) {
    return {
      success: false,
      message:
        "Karşılaştırma için en az iki `fırsat analizi:` kaydı gerekli. Önce iki farklı fikir için fırsat analizi çalıştır.",
    };
  }

  const matched = selectOpportunitiesForCompare(opportunityScores, query);
  const latest = sortByCreatedAt(opportunityScores).slice(0, 2);

  let first: ResearchMemory | undefined;
  let second: ResearchMemory | undefined;
  let usedFallback = false;

  if (matched.length >= 2) {
    first = matched[0];
    second = matched[1];
  } else if (matched.length === 1) {
    const picked = matched[0];
    first = picked;
    second = latest.find((item) => item.id !== picked.id);
    usedFallback = true;
  } else {
    first = latest[0];
    second = latest[1];
    usedFallback = Boolean(query.trim());
  }

  if (!first || !second || first.id === second.id) {
    return {
      success: false,
      message: "Karşılaştırılacak yeterli kayıt bulunamadı.",
    };
  }

  return buildComparisonResult(first, second, query, usedFallback);
}

function buildComparisonResult(
  first: ResearchMemory,
  second: ResearchMemory,
  query: string,
  usedFallback: boolean
): ResearchMemoryResult {

  const winner =
    (first.score ?? 0) === (second.score ?? 0)
      ? "Skorlar eşit; daha fazla doğrulama önerilir."
      : (first.score ?? 0) > (second.score ?? 0)
      ? `Şu an daha mantıklı görünen: **${first.topic}** (skor ${first.score ?? "yok"})`
      : `Şu an daha mantıklı görünen: **${second.topic}** (skor ${second.score ?? "yok"})`;

  const hint = query.trim()
    ? usedFallback
      ? "Belirttiğin fikirler tam eşleşmedi; hafızadaki en yüksek skorlu iki kayıt karşılaştırıldı."
      : "Belirttiğin fikirlere göre eşleşen kayıtlar karşılaştırıldı."
    : "Hafızadaki en son iki fırsat analizi kaydı karşılaştırıldı.";

  return {
    success: true,
    message: `## Fırsat Karşılaştırması

${hint}

**A:** ${first.topic} — skor ${first.score ?? "yok"} (${first.sourceType}, ${first.agentId})
Özet: ${first.summary.slice(0, 280)}...

**B:** ${second.topic} — skor ${second.score ?? "yok"} (${second.sourceType}, ${second.agentId})
Özet: ${second.summary.slice(0, 280)}...

**Sonuç:** ${winner}

Not: Canlı pazar doğrulaması için yeni \`pazar analizi:\` veya Research modu kullan.`,
    data: [first, second],
  };
}

export async function getResearchContext(limit = CONTEXT_MAX): Promise<string> {
  const memories = await loadMemories(limit);

  if (memories.length === 0) {
    return "ARAŞTIRMA HAFIZASI: Kayıtlı pazar/fırsat geçmişi yok.";
  }

  const lines = memories.map(
    (item) =>
      `- [${item.sourceType}] ${item.topic}${item.score !== null ? ` (skor ${item.score})` : ""}: ${item.summary.slice(0, 220)}`
  );

  return `ARAŞTIRMA HAFIZASI (Persistent Research Memory):
${lines.join("\n")}`;
}

export async function persistMarketIntelResearch(params: {
  sourceType: ResearchSourceType;
  topic: string;
  analysis: string;
  agentId: AgentId | string;
}): Promise<void> {
  const score =
    params.sourceType === "opportunity_score" ||
    params.sourceType === "founder_review"
      ? extractScoreFromAnalysis(params.analysis)
      : null;

  await saveResearchMemory({
    topic: params.topic,
    summary: params.analysis,
    score,
    sourceType: params.sourceType,
    agentId: params.agentId,
    tags: [params.topic.split(/\s+/).slice(0, 3).join("-")],
  });
}

export async function handleResearchMemoryRouterCommand(
  message: string
): Promise<ResearchMemoryResult | null> {
  const lower = message.toLowerCase().trim();

  if (
    lower === "araştırma hafızası" ||
    lower === "arastirma hafizasi" ||
    lower.includes("araştırma hafızası") ||
    lower.includes("arastirma hafizasi")
  ) {
    return summarizeResearchHistory();
  }

  if (lower.includes("geçmiş fırsatlar") || lower.includes("gecmis firsatlar")) {
    const memories = await loadMemories(30);
    const opportunities = memories.filter(
      (item) =>
        item.sourceType === "opportunity_score" ||
        item.sourceType === "founder_review"
    );

    if (opportunities.length === 0) {
      return {
        success: true,
        message: "Geçmiş fırsat kaydı yok.",
        data: [],
      };
    }

    const lines = opportunities.map(
      (item, index) =>
        `${index + 1}. ${item.topic} — skor ${item.score ?? "yok"} (${item.created_at.slice(0, 10)})`
    );

    return {
      success: true,
      message: `## Geçmiş Fırsatlar\n\n${lines.join("\n")}`,
      data: opportunities,
    };
  }

  if (
    lower.includes("hangi fikir daha mantıklı") ||
    lower.includes("hangi fikir daha mantikli")
  ) {
    const query = message
      .replace(/hangi fikir daha mant[ıi]kl[ıi]\s*:?\s*/i, "")
      .replace(/hangi fikir daha mantikli\s*:?\s*/i, "")
      .replace(/^\s*[-*•]\s*/gm, "")
      .trim();

    return compareOpportunities(query);
  }

  if (
    lower.includes("eski analizleri göster") ||
    lower.includes("eski analizleri goster")
  ) {
    return listResearchMemories(25);
  }

  if (lower.includes("son araştırmalar") || lower.includes("son arastirmalar")) {
    const memories = await loadMemories(10);

    if (memories.length === 0) {
      return {
        success: true,
        message: "Son araştırma kaydı yok.",
        data: [],
      };
    }

    const lines = memories
      .slice(0, 10)
      .map(
        (item, index) =>
          `${index + 1}. [${item.sourceType}] ${item.topic} — ${item.agentId} — ${item.created_at.slice(0, 16).replace("T", " ")}`
      );

    return {
      success: true,
      message: `## Son Araştırmalar\n\n${lines.join("\n")}`,
      data: memories,
    };
  }

  return null;
}

export function mapMarketCommandToSourceType(
  message: string
): ResearchSourceType | null {
  const lower = message.toLowerCase();

  if (lower.startsWith("pazar analizi")) {
    return "market_analysis";
  }

  if (lower.startsWith("fırsat analizi") || lower.startsWith("firsat analizi")) {
    return "opportunity_score";
  }

  if (lower.startsWith("rakip analizi plan")) {
    return "competitor_plan";
  }

  if (lower.startsWith("bu fikir mantıklı") || lower.startsWith("bu fikir mantikli")) {
    return "founder_review";
  }

  return null;
}
