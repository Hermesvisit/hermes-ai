import OpenAI from "openai";
import type { SectorId } from "@/lib/hermes/sectors";
import { getSectorById, getSectorContextPrompt } from "@/lib/hermes/sectors";
import { getBusinessContextPrompt as getHermesBusinessIdentityPrompt } from "@/lib/hermes/business";
import { getPermissionBoundariesForPrompt } from "@/lib/hermes/permissions";
import { reviewPlanSafety } from "@/lib/hermes/security-review";

export type BusinessInstance = {
  id: string;
  sectorId: SectorId;
  businessName: string;
  description: string;
  services: string[];
  workingHours: string;
  contactChannels: string[];
  faq: { question: string; answer: string }[];
  tone: string;
  targetCustomers: string[];
  activeAgents: string[];
  risks: string[];
  createdAt: string;
};

export type CreateBusinessInstanceInput = {
  sectorId: SectorId;
  businessName: string;
  description: string;
  services: string[];
  workingHours: string;
  contactChannels: string[];
  faq?: { question: string; answer: string }[];
  tone: string;
  targetCustomers: string[];
  activeAgents: string[];
  risks: string[];
};

export type BusinessInstanceResult =
  | { success: true; message: string; data?: BusinessInstance }
  | { success: false; message: string };

const INSTANCE_BOUNDARY = `İŞLETME ÖRNEĞİ MİMARİSİ (iç kullanım):
Hermes Core → Sektör OS → **İşletme Örnekleri** (izole operasyonel bağlam) → Worker Agent'lar → Müşteri asistanları.
Her işletme örneği yalnızca kendi veri ve tonuna göre yanıt verir; müşteriler Hermes Core veya diğer işletmelere erişemez.`;

const businessInstances: BusinessInstance[] = [
  {
    id: "biz-klinik-nova",
    sectorId: "DENTAL_OS",
    businessName: "Klinik Nova",
    description:
      "Antalya'da implant ve genel diş hekimliği odaklı butik klinik.",
    services: [
      "Genel muayene",
      "İmplant konsültasyonu",
      "Diş taşı temizliği",
      "Estetik dolgu",
    ],
    workingHours: "Pzt–Cum 09:00–19:00, Cmt 10:00–15:00",
    contactChannels: ["WhatsApp", "Telefon", "Web formu"],
    faq: [
      {
        question: "İmplant süreci ne kadar sürer?",
        answer:
          "Ön görüşme sonrası plan netleşir; genelde 2–4 ay arası değişir. Kesin süre hekim değerlendirmesiyle belirlenir.",
      },
      {
        question: "Sigorta kabul ediyor musunuz?",
        answer: "Anlaşmalı özel sigortalar için ön bilgi verilir; detay randevuda netleşir.",
      },
    ],
    tone: "Profesyonel, sakin, güven veren",
    targetCustomers: ["Yerel yetişkin hastalar", "İmplant adayı hastalar"],
    activeAgents: [
      "Randevu Koordinatörü",
      "Hasta İletişim Asistanı",
      "Klinik SSS Agent",
    ],
    risks: ["Tıbbi tavsiye", "KVKK", "Yanlış randevu slotu"],
    createdAt: "2025-01-15T10:00:00.000Z",
  },
  {
    id: "biz-whitesmile",
    sectorId: "DENTAL_OS",
    businessName: "WhiteSmile Clinic",
    description:
      "Şehir merkezinde beyazlatma ve estetik diş hekimliği odaklı klinik.",
    services: [
      "Diş beyazlatma",
      "Estetik lamine",
      "Kontrol ve bakım",
      "Acil ağrı triyajı (bilgilendirme)",
    ],
    workingHours: "Pzt–Cmt 08:30–20:00",
    contactChannels: ["Instagram DM", "WhatsApp", "Telefon"],
    faq: [
      {
        question: "Beyazlatma tek seansta olur mu?",
        answer:
          "Çoğu hasta için tek seans yeterli olabilir; diş yapısına göre hekim önerir.",
      },
    ],
    tone: "Enerjik, modern, samimi",
    targetCustomers: ["Estetik odaklı genç yetişkinler", "Sosyal medyadan gelen lead'ler"],
    activeAgents: [
      "Randevu Koordinatörü",
      "Hasta İletişim Asistanı",
      "Recall Takip Agent",
    ],
    risks: ["Sonuç vaadi", "KVKK", "Acil vaka yönlendirme"],
    createdAt: "2025-02-01T10:00:00.000Z",
  },
  {
    id: "biz-primeestate-antalya",
    sectorId: "ESTATE_OS",
    businessName: "PrimeEstate Antalya",
    description:
      "Antalya sahil ve merkez odaklı satılık/kiralık konut danışmanlığı.",
    services: [
      "Satılık daire danışmanlığı",
      "Kiralık konut eşleştirme",
      "Yatırım amaçlı portföy sunumu",
      "Yer gösterme planlama",
    ],
    workingHours: "Her gün 09:00–21:00 (randevulu)",
    contactChannels: ["WhatsApp", "Telefon", "Web lead formu"],
    faq: [
      {
        question: "Komisyon oranı nedir?",
        answer:
          "İşlem türüne göre değişir; detay görüşmede paylaşılır, mesajda kesin taahhüt verilmez.",
      },
    ],
    tone: "Kurumsal, net, güvenilir",
    targetCustomers: ["Yerli alıcılar", "Yabancı yatırımcılar", "Kiralık arayan aileler"],
    activeAgents: [
      "Lead Nitelendirme Agent",
      "Portföy Eşleştirme Agent",
      "Görüşme Planlayıcı",
    ],
    risks: ["Fiyat taahhüdü", "KVKK", "Yanlış ilan eşleştirme"],
    createdAt: "2025-02-10T10:00:00.000Z",
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function createInstanceId(businessName: string): string {
  return `biz-${slugify(businessName)}-${Date.now()}`;
}

export function createBusinessInstance(
  input: CreateBusinessInstanceInput
): BusinessInstanceResult {
  const sector = getSectorById(input.sectorId);

  if (!sector) {
    return {
      success: false,
      message: `Geçersiz sektör: ${input.sectorId}`,
    };
  }

  const name = input.businessName.trim();

  if (!name) {
    return {
      success: false,
      message: "İşletme adı gerekli.",
    };
  }

  const duplicate = businessInstances.find(
    (item) =>
      item.sectorId === input.sectorId &&
      item.businessName.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    return {
      success: false,
      message: `Bu sektörde "${name}" adlı işletme zaten kayıtlı.`,
    };
  }

  const instance: BusinessInstance = {
    id: createInstanceId(name),
    sectorId: input.sectorId,
    businessName: name,
    description: input.description.trim(),
    services: [...input.services],
    workingHours: input.workingHours.trim(),
    contactChannels: [...input.contactChannels],
    faq: input.faq ? [...input.faq] : [],
    tone: input.tone.trim(),
    targetCustomers: [...input.targetCustomers],
    activeAgents: [...input.activeAgents],
    risks: [...input.risks],
    createdAt: new Date().toISOString(),
  };

  businessInstances.push(instance);

  return {
    success: true,
    message: `İşletme örneği oluşturuldu: **${instance.businessName}** (\`${instance.id}\`, ${sector.name}).`,
    data: instance,
  };
}

export function listBusinessInstances(sectorId?: SectorId): BusinessInstance[] {
  if (!sectorId) {
    return [...businessInstances].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  return businessInstances
    .filter((item) => item.sectorId === sectorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBusinessInstance(idOrName: string): BusinessInstance | null {
  const needle = idOrName.trim().toLowerCase();

  if (!needle) {
    return null;
  }

  const byId = businessInstances.find((item) => item.id.toLowerCase() === needle);

  if (byId) {
    return byId;
  }

  const byName = businessInstances.find(
    (item) => item.businessName.toLowerCase() === needle
  );

  if (byName) {
    return byName;
  }

  const slug = slugify(idOrName);

  return (
    businessInstances.find(
      (item) =>
        slugify(item.businessName) === slug ||
        item.id.toLowerCase().includes(slug)
    ) ?? null
  );
}

export function summarizeBusinessInstance(instance: BusinessInstance): string {
  const sector = getSectorById(instance.sectorId);
  const sectorName = sector?.name ?? instance.sectorId;

  const faqLines =
    instance.faq.length > 0
      ? instance.faq
          .map((item) => `- **S:** ${item.question}\n  **C:** ${item.answer}`)
          .join("\n")
      : "- Kayıtlı SSS yok.";

  return `## ${instance.businessName} (\`${instance.id}\`)

**Sektör:** ${sectorName} (\`${instance.sectorId}\`)
**Açıklama:** ${instance.description}
**Ton:** ${instance.tone}
**Çalışma saatleri:** ${instance.workingHours}

**Hizmetler:**
${instance.services.map((item) => `- ${item}`).join("\n")}

**İletişim kanalları:** ${instance.contactChannels.join(", ")}

**Hedef müşteriler:**
${instance.targetCustomers.map((item) => `- ${item}`).join("\n")}

**Aktif worker agent'lar** (müşteri katmanı):
${instance.activeAgents.map((item) => `- ${item}`).join("\n")}

**SSS:**
${faqLines}

**Riskler:**
${instance.risks.map((item) => `- ${item}`).join("\n")}

**Oluşturulma:** ${instance.createdAt.slice(0, 10)}`;
}

export function summarizeBusinessesBySector(sectorId: SectorId): string {
  const sector = getSectorById(sectorId);

  if (!sector) {
    return `Bilinmeyen sektör: ${sectorId}`;
  }

  const instances = listBusinessInstances(sectorId);

  if (instances.length === 0) {
    return `## ${sector.name} — İşletme örnekleri\n\nBu sektörde kayıtlı işletme yok.`;
  }

  const lines = instances.map(
    (item, index) =>
      `${index + 1}. **${item.businessName}** (\`${item.id}\`) — ${item.description.slice(0, 100)}...`
  );

  return `## ${sector.name} — İşletme Örnekleri

${INSTANCE_BOUNDARY}

${lines.join("\n")}`;
}

export function summarizeAllBusinessInstances(): string {
  const lines = listBusinessInstances().map((item) => {
    const sector = getSectorById(item.sectorId);
    return `- **${item.businessName}** (\`${item.id}\`) — ${sector?.name ?? item.sectorId}`;
  });

  return `## Hermes İşletme Örnekleri

${INSTANCE_BOUNDARY}

${lines.length > 0 ? lines.join("\n") : "Kayıtlı işletme yok."}`;
}

/** İşletme örneği operasyonel bağlamı (Hermes iş kimliği katmanından ayrı). */
export function getBusinessContextPrompt(instance?: BusinessInstance | null): string {
  if (!instance) {
    const preview = listBusinessInstances()
      .slice(0, 6)
      .map(
        (item) =>
          `- ${item.businessName} (${item.sectorId}, id: ${item.id})`
      )
      .join("\n");

    return `${INSTANCE_BOUNDARY}

KAYITLI İŞLETME ÖRNEKLERİ (özet):
${preview || "- Henüz işletme yok."}

Yanıtlarda tek bir işletme bağlamına sadık kal; çapraz işletme verisi sızdırma.`;
  }

  const sector = getSectorById(instance.sectorId);

  return `${INSTANCE_BOUNDARY}

AKTİF İŞLETME ÖRNEĞİ (izole bağlam):
- ID: ${instance.id}
- Ad: ${instance.businessName}
- Sektör: ${sector?.name ?? instance.sectorId}
- Açıklama: ${instance.description}
- Hizmetler: ${instance.services.join("; ")}
- Saatler: ${instance.workingHours}
- Kanallar: ${instance.contactChannels.join(", ")}
- Ton: ${instance.tone}
- Hedef müşteri: ${instance.targetCustomers.join("; ")}
- Worker agent'lar: ${instance.activeAgents.join(", ")}
- Riskler: ${instance.risks.join("; ")}

SSS özeti: ${instance.faq.map((item) => item.question).join(" | ") || "yok"}

Müşteri asistanı yalnızca bu işletmenin verisiyle konuşur; Hermes Core veya diğer işletmeler paylaşılmaz.`;
}

export function selectBusinessForRequest(
  request: string,
  sectorId?: SectorId
): BusinessInstance | null {
  const pool = sectorId ? listBusinessInstances(sectorId) : listBusinessInstances();

  if (pool.length === 0) {
    return null;
  }

  const lower = request.toLowerCase();
  let best: BusinessInstance | null = null;
  let bestScore = 0;

  for (const instance of pool) {
    let score = 0;
    const nameLower = instance.businessName.toLowerCase();
    const slug = slugify(instance.businessName);

    if (lower.includes(nameLower)) {
      score += 10;
    }

    if (lower.includes(slug.replace(/-/g, " ")) || lower.includes(slug)) {
      score += 6;
    }

    for (const service of instance.services) {
      if (lower.includes(service.toLowerCase())) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = instance;
    }
  }

  return bestScore > 0 ? best : null;
}

export function summarizeBusinessSectorMap(): string {
  const lines = listBusinessInstances().map((item) => {
    const sector = getSectorById(item.sectorId);
    return `- **${item.businessName}** → ${sector?.name ?? item.sectorId} (\`${item.sectorId}\`)`;
  });

  return `## Hangi işletme hangi sektörde?

${INSTANCE_BOUNDARY}

${lines.join("\n")}`;
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function analyzeBusinessInstance(
  idOrName: string,
  focus = ""
): Promise<BusinessInstanceResult> {
  const instance = getBusinessInstance(idOrName);

  if (!instance) {
    return {
      success: false,
      message:
        "İşletme bulunamadı. Kullanım: `işletme analizi: Klinik Nova`",
    };
  }

  const sector = getSectorById(instance.sectorId);
  const openai = getOpenAIClient();

  if (!openai) {
    return {
      success: false,
      message: "OpenAI yapılandırması eksik. İşletme analizi için OPENAI_API_KEY gerekli.",
    };
  }

  const focusLine = focus.trim() || "Operasyon, müşteri deneyimi ve MVP önceliği";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${getHermesBusinessIdentityPrompt()}

${sector ? getSectorContextPrompt(sector) : ""}

${getBusinessContextPrompt(instance)}

${getPermissionBoundariesForPrompt()}

Görev: Bu işletme örneği için iç analiz (müşteriye Hermes Core gösterme).
Bölümler: mevcut güçlü yanlar, operasyon boşlukları, worker agent kullanımı, SSS iyileştirmesi, riskler, 14 günlük aksiyon planı.
Dosya yazma, terminal veya deploy önerme.`,
        },
        { role: "user", content: focusLine },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim();

    if (!message) {
      return {
        success: false,
        message: "İşletme analizi tamamlandı ama cevap boş geldi.",
      };
    }

    const review = reviewPlanSafety(message);
    const body = review.safe ? message : review.message;

    return {
      success: true,
      message: `## İşletme Analizi — ${instance.businessName}\n\n${body}`,
      data: instance,
    };
  } catch (error) {
    return {
      success: false,
      message:
        "İşletme analizi oluşturulamadı: " +
        (error instanceof Error ? error.message : "bilinmeyen hata"),
    };
  }
}

export async function handleBusinessInstanceRouterCommand(
  message: string
): Promise<BusinessInstanceResult | null> {
  const lower = message.toLowerCase().trim();

  if (
    lower === "işletmeleri göster" ||
    lower === "isletmeleri goster" ||
    lower.includes("işletmeleri göster")
  ) {
    return { success: true, message: summarizeAllBusinessInstances() };
  }

  if (
    lower.includes("dentalos işletmeleri") ||
    lower.includes("dentalos isletmeleri") ||
    lower.includes("dental os işletmeleri")
  ) {
    return {
      success: true,
      message: summarizeBusinessesBySector("DENTAL_OS"),
    };
  }

  if (lower.includes("klinik nova nedir") || lower === "klinik nova") {
    const instance = getBusinessInstance("Klinik Nova");

    return instance
      ? { success: true, message: summarizeBusinessInstance(instance), data: instance }
      : { success: false, message: "Klinik Nova kaydı bulunamadı." };
  }

  if (
    lower.includes("hangi işletme hangi sektörde") ||
    lower.includes("hangi isletme hangi sektörde") ||
    lower.includes("hangi isletme hangi sektorde")
  ) {
    return { success: true, message: summarizeBusinessSectorMap() };
  }

  if (
    lower.startsWith("işletme analizi:") ||
    lower.startsWith("isletme analizi:")
  ) {
    const match = message.match(/^işletme\s+analizi\s*:\s*(.+)$/i) ||
      message.match(/^isletme\s+analizi\s*:\s*(.+)$/i);
    const rest = match?.[1]?.trim() ?? "";

    if (!rest) {
      return {
        success: false,
        message: "Kullanım: işletme analizi: Klinik Nova",
      };
    }

    const nameToken = rest.split(/\s+-\s+/)[0]?.trim() ?? rest;
    const focus = rest.slice(nameToken.length).replace(/^[\s\-:]+/, "").trim();

    return analyzeBusinessInstance(nameToken, focus);
  }

  const byName = selectBusinessForRequest(message);

  if (
    byName &&
    (lower.endsWith(" nedir") || lower.endsWith(" nedir?")) &&
    lower.includes(byName.businessName.toLowerCase())
  ) {
    return {
      success: true,
      message: summarizeBusinessInstance(byName),
      data: byName,
    };
  }

  return null;
}
