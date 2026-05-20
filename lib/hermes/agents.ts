export type AgentId =
  | "CEO_AGENT"
  | "CTO_AGENT"
  | "RESEARCH_AGENT"
  | "MARKETING_AGENT"
  | "SALES_AGENT"
  | "UX_AGENT";

export type HermesAgent = {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  reasoningStyle: string;
  priorities: string[];
  recommendedTasks: string[];
};

const AGENTS: Record<AgentId, HermesAgent> = {
  CEO_AGENT: {
    id: "CEO_AGENT",
    name: "CEO Agent",
    role: "Strategy & Business Leadership",
    description:
      "İş stratejisi, önceliklendirme, büyüme kararları ve ürün yönü üzerinde düşünür.",
    reasoningStyle:
      "Sonuç odaklı, net öncelik, risk-getiri dengesi, kısa ve uygulanabilir karar önerileri.",
    priorities: [
      "Business impact",
      "Focus and sequencing",
      "Resource trade-offs",
      "Long-term positioning",
    ],
    recommendedTasks: [
      "Strateji planı",
      "Öncelik sıralaması",
      "Go-to-market kararı",
      "İş modeli netleştirme",
    ],
  },
  CTO_AGENT: {
    id: "CTO_AGENT",
    name: "CTO Agent",
    role: "Technical Architecture & Engineering",
    description:
      "Kod, mimari, teknik borç, güvenlik ve uygulanabilir mühendislik planları üretir.",
    reasoningStyle:
      "Mimari netlik, güvenli değişiklik, dosya kapsamı, test ve geri alma odaklı.",
    priorities: [
      "Correctness",
      "Maintainability",
      "Security",
      "Minimal safe diffs",
    ],
    recommendedTasks: [
      "Patch planı",
      "Dosya analizi",
      "API/route tasarımı",
      "Teknik risk değerlendirmesi",
    ],
  },
  RESEARCH_AGENT: {
    id: "RESEARCH_AGENT",
    name: "Research Agent",
    role: "Research & Intelligence",
    description:
      "Güncel bilgi, pazar araştırması, karşılaştırma ve kanıta dayalı özetler sunar.",
    reasoningStyle:
      "Kaynak farkındalığı, belirsizlikleri açıkça belirtme, karşılaştırmalı özet.",
    priorities: [
      "Accuracy",
      "Source awareness",
      "Clear uncertainty",
      "Actionable insights",
    ],
    recommendedTasks: [
      "Pazar araştırması",
      "Rakip analizi",
      "Trend özeti",
      "Karar için veri toplama",
    ],
  },
  MARKETING_AGENT: {
    id: "MARKETING_AGENT",
    name: "Marketing Agent",
    role: "Growth & Positioning",
    description:
      "Konumlandırma, mesajlaşma, büyüme kanalları ve kullanıcı edinimi önerir.",
    reasoningStyle:
      "Hedef kitle odaklı, net value proposition, kanal/deney önerileri.",
    priorities: [
      "Positioning",
      "Messaging clarity",
      "Acquisition loops",
      "Activation",
    ],
    recommendedTasks: [
      "Landing mesajı",
      "Büyüme deneyi",
      "İçerik stratejisi",
      "Ürün lansman planı",
    ],
  },
  SALES_AGENT: {
    id: "SALES_AGENT",
    name: "Sales Agent",
    role: "Revenue & Conversion",
    description:
      "Gelir, dönüşüm, fiyatlandırma ve müşteri değer önerisi üzerinde çalışır.",
    reasoningStyle:
      "ICP odaklı, itiraz yönetimi, dönüşüm adımları ve net CTA.",
    priorities: [
      "Revenue impact",
      "Conversion",
      "Pricing clarity",
      "Customer value",
    ],
    recommendedTasks: [
      "Fiyatlandırma taslağı",
      "Satış akışı",
      "Demo script",
      "Enterprise teklif çerçevesi",
    ],
  },
  UX_AGENT: {
    id: "UX_AGENT",
    name: "UX Agent",
    role: "Product Experience & Usability",
    description:
      "Kullanıcı deneyimi, akış sadeleştirme ve arayüz netliği için öneri verir.",
    reasoningStyle:
      "Kullanıcı yolu, sürtünme azaltma, erişilebilirlik ve net bilgi hiyerarşisi.",
    priorities: [
      "Clarity",
      "Low friction",
      "Consistency",
      "Accessible flows",
    ],
    recommendedTasks: [
      "Ekran akışı iyileştirme",
      "Onboarding",
      "UI metinleri",
      "Kullanılabilirlik planı",
    ],
  },
};

let pinnedAgentId: AgentId | null = null;

const SELECTION_RULES: { agentId: AgentId; patterns: RegExp[] }[] = [
  {
    agentId: "CTO_AGENT",
    patterns: [
      /\bkod\b/i,
      /\bapi\b/i,
      /\btypescript\b/i,
      /\bnext\.?js\b/i,
      /\breact\b/i,
      /\bbug\b/i,
      /\bhata\b/i,
      /\brefactor\b/i,
      /\bmimari\b/i,
      /\broute\b/i,
      /\bsupabase\b/i,
      /\bdosya\b/i,
      /\bpatch\b/i,
    ],
  },
  {
    agentId: "MARKETING_AGENT",
    patterns: [
      /\bmarketing\b/i,
      /\bbüyüme\b/i,
      /\bbuyume\b/i,
      /\bkanal\b/i,
      /\blaunch\b/i,
      /\bpositioning\b/i,
      /\bkonumlandırma\b/i,
      /\bkonumlandirma\b/i,
      /\biçerik\b/i,
      /\bic erik\b/i,
    ],
  },
  {
    agentId: "SALES_AGENT",
    patterns: [
      /\bsatış\b/i,
      /\bsatis\b/i,
      /\bsales\b/i,
      /\bgelir\b/i,
      /\brevenue\b/i,
      /\bfiyat\b/i,
      /\bpricing\b/i,
      /\bdönüşüm\b/i,
      /\bdonusum\b/i,
      /\bmüşteri\b/i,
      /\bmusteri\b/i,
    ],
  },
  {
    agentId: "UX_AGENT",
    patterns: [
      /\bux\b/i,
      /\bui\b/i,
      /\barayüz\b/i,
      /\barayuz\b/i,
      /\bkullanıcı deneyimi\b/i,
      /\bkullanici deneyimi\b/i,
      /\bonboarding\b/i,
      /\btasarım\b/i,
      /\btasarim\b/i,
      /\bakış\b/i,
      /\bakis\b/i,
    ],
  },
  {
    agentId: "RESEARCH_AGENT",
    patterns: [
      /\baraştır\b/i,
      /\barastir\b/i,
      /\bresearch\b/i,
      /\bgüncel\b/i,
      /\bguncel\b/i,
      /\bhaber\b/i,
      /\bpazar\b/i,
      /\brakip\b/i,
      /\bkarşılaştır\b/i,
      /\bkarsilastir\b/i,
    ],
  },
  {
    agentId: "CEO_AGENT",
    patterns: [
      /\bstrateji\b/i,
      /\biş planı\b/i,
      /\bis plani\b/i,
      /\böncelik\b/i,
      /\boncelik\b/i,
      /\bgirişim\b/i,
      /\bgirisim\b/i,
      /\bkarar\b/i,
      /\broadmap\b/i,
      /\bvision\b/i,
    ],
  },
];

export function listAgents(): HermesAgent[] {
  return Object.values(AGENTS).map((agent) => ({
    ...agent,
    priorities: [...agent.priorities],
    recommendedTasks: [...agent.recommendedTasks],
  }));
}

export function getAgentById(id: AgentId): HermesAgent | null {
  const agent = AGENTS[id];
  if (!agent) {
    return null;
  }

  return {
    ...agent,
    priorities: [...agent.priorities],
    recommendedTasks: [...agent.recommendedTasks],
  };
}

export function getPinnedAgentId(): AgentId | null {
  return pinnedAgentId;
}

export function setPinnedAgent(id: AgentId | null): void {
  pinnedAgentId = id;
}

export function parseExplicitAgentFromMessage(message: string): AgentId | null {
  const lower = message.toLowerCase();

  if (
    /\bcto\s+agent\b/i.test(lower) ||
    /\bcto\s+olarak\b/i.test(lower) ||
    /\bcto\s+gibi\b/i.test(lower)
  ) {
    return "CTO_AGENT";
  }

  if (
    /\bceo\s+agent\b/i.test(lower) ||
    /\bceo\s+gibi\s+düşün\b/i.test(lower) ||
    /\bceo\s+gibi\s+dusun\b/i.test(lower) ||
    /\bceo\s+olarak\b/i.test(lower)
  ) {
    return "CEO_AGENT";
  }

  if (/\bmarketing\s+agent\b/i.test(lower) || /\bmarketing\s+olarak\b/i.test(lower)) {
    return "MARKETING_AGENT";
  }

  if (/\bsales\s+agent\b/i.test(lower) || /\bsatış\s+agent\b/i.test(lower)) {
    return "SALES_AGENT";
  }

  if (/\bux\s+agent\b/i.test(lower) || /\bux\s+olarak\b/i.test(lower)) {
    return "UX_AGENT";
  }

  if (/\bresearch\s+agent\b/i.test(lower) || /\baraştırma\s+agent\b/i.test(lower)) {
    return "RESEARCH_AGENT";
  }

  return null;
}

export function selectBestAgentForPrompt(prompt: string): HermesAgent {
  const explicit = parseExplicitAgentFromMessage(prompt);

  if (explicit) {
    return getAgentById(explicit) ?? AGENTS.CEO_AGENT;
  }

  if (pinnedAgentId) {
    return getAgentById(pinnedAgentId) ?? AGENTS.CEO_AGENT;
  }

  const scores = new Map<AgentId, number>();

  for (const rule of SELECTION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(prompt)) {
        scores.set(rule.agentId, (scores.get(rule.agentId) ?? 0) + 1);
      }
    }
  }

  let bestId: AgentId = "CEO_AGENT";
  let bestScore = 0;

  for (const [id, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return getAgentById(bestId) ?? AGENTS.CEO_AGENT;
}

export function resolveAgentForMessage(message: string): HermesAgent {
  const explicit = parseExplicitAgentFromMessage(message);

  if (explicit) {
    pinnedAgentId = explicit;
    return getAgentById(explicit) ?? AGENTS.CEO_AGENT;
  }

  if (pinnedAgentId) {
    return getAgentById(pinnedAgentId) ?? AGENTS.CEO_AGENT;
  }

  return selectBestAgentForPrompt(message);
}

export function summarizeAgent(agent: HermesAgent): string {
  return `## ${agent.name} (${agent.id})

**Rol:** ${agent.role}
**Açıklama:** ${agent.description}
**Düşünme tarzı:** ${agent.reasoningStyle}

**Öncelikler:**
${agent.priorities.map((item) => `- ${item}`).join("\n")}

**Önerilen görevler:**
${agent.recommendedTasks.map((item) => `- ${item}`).join("\n")}`;
}

export function summarizeAllAgents(): string {
  const header = "## Hermes Agent Registry\n\nKayıtlı uzman agent'lar:\n";
  const body = listAgents()
    .map(
      (agent) =>
        `### ${agent.name} (\`${agent.id}\`)\n- Rol: ${agent.role}\n- ${agent.description}`
    )
    .join("\n\n");

  return `${header}\n${body}`;
}

export function getAgentContextPrompt(agent: HermesAgent): string {
  return `AKTİF AGENT (Agent Registry):
- ID: ${agent.id}
- Ad: ${agent.name}
- Rol: ${agent.role}
- Düşünme tarzı: ${agent.reasoningStyle}
- Öncelikler: ${agent.priorities.join(", ")}
Bu agent kimliğiyle cevap ver; salt okunur/planlama sınırlarına uy.`;
}

export function formatActiveAgentStatus(): string {
  if (!pinnedAgentId) {
    return "Şu an **otomatik agent seçimi** aktif. Her mesajda konuya göre en uygun agent seçilir.";
  }

  const agent = getAgentById(pinnedAgentId);

  if (!agent) {
    return "Sabitlenmiş agent bulunamadı. Otomatik seçime dönüldü.";
  }

  return `Şu an sabitlenmiş agent: **${agent.name}** (\`${agent.id}\`).\n\n${summarizeAgent(agent)}`;
}

export function recommendAgentForTask(task: string): string {
  const agent = selectBestAgentForPrompt(task);

  return `Bu iş için önerilen agent: **${agent.name}** (\`${agent.id}\`)\n\n${summarizeAgent(agent)}`;
}

export function formatPlannerAgentHeader(agent: HermesAgent): string {
  return `**Planlayan agent:** ${agent.name} (${agent.id}) — ${agent.role}`;
}
