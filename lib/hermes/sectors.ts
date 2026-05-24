import OpenAI from "openai";
import { getBusinessContextPrompt } from "@/lib/hermes/business";
import { getPermissionBoundariesForPrompt } from "@/lib/hermes/permissions";
import { reviewPlanSafety } from "@/lib/hermes/security-review";

export type SectorId =
  | "DENTAL_OS"
  | "ESTATE_OS"
  | "BEAUTY_OS"
  | "RESTAURANT_OS";

export type HermesSector = {
  id: SectorId;
  name: string;
  description: string;
  targetBusinesses: string[];
  commonPainPoints: string[];
  coreWorkflows: string[];
  workerAgents: string[];
  dataToCollect: string[];
  mvpFeatures: string[];
  risks: string[];
};

export type SectorRouterResult =
  | { success: true; message: string }
  | { success: false; message: string };

const HERMES_CORE_BOUNDARY = `HERMES MİMARİ SINIRI (iç kullanım):
- Hermes Core: özel üst seviye komut AI (müşteriye açılmaz).
- Sektör OS katmanları: Hermes altında şablon/işletim sistemleri (DentalOS, EstateOS, vb.).
- Müşteri asistanları: sektör OS altında, yalnızca sektör kapsamında çalışır.
- Müşteriler Hermes Core'a, patch planlarına veya iç registry'lere erişemez.`;

const SECTORS: Record<SectorId, HermesSector> = {
  DENTAL_OS: {
    id: "DENTAL_OS",
    name: "DentalOS",
    description:
      "Diş klinikleri ve ağız sağlığı işletmeleri için randevu, hasta iletişimi ve operasyon zekası.",
    targetBusinesses: [
      "Özel diş klinikleri",
      "Çok şubeli dental zincirler",
      "İmplant ve estetik diş hekimleri",
      "Ağız-diş sağlığı poliklinikleri",
    ],
    commonPainPoints: [
      "No-show ve son dakika iptalleri",
      "Telefon/WhatsApp yoğunluğu",
      "Tedavi planı onayı ve takip",
      "Hasta dosyası dağınıklığı",
      "Tekrar randevu ve recall eksikliği",
    ],
    coreWorkflows: [
      "Randevu talebi → uygunluk → onay",
      "Hasta bilgilendirme ve hatırlatma",
      "Tedavi planı özeti ve onay akışı",
      "Recall / kontrol randevusu",
      "Klinik içi görev yönlendirme",
    ],
    workerAgents: [
      "Randevu Koordinatörü",
      "Hasta İletişim Asistanı",
      "Tedavi Planı Özetleyici",
      "Recall Takip Agent",
      "Klinik SSS Agent",
    ],
    dataToCollect: [
      "Hizmet türü ve süre",
      "Doktor/hekim uygunluk",
      "Sigorta / ödeme tercihi",
      "Aciliyet ve şikayet özeti",
      "İletişim kanalı tercihi",
    ],
    mvpFeatures: [
      "WhatsApp/web randevu talebi",
      "Otomatik hatırlatma mesajları",
      "Tedavi planı FAQ",
      "No-show azaltma kuralları",
      "Günlük klinik özeti",
    ],
    risks: [
      "Tıbbi tavsiye verme (yalnızca bilgilendirme)",
      "KVKK / hasta verisi",
      "Yanlış randevu slotu",
      "İnsan onayı olmadan tedavi taahhüdü",
    ],
  },
  ESTATE_OS: {
    id: "ESTATE_OS",
    name: "EstateOS",
    description:
      "Emlak ofisleri ve gayrimenkul danışmanları için lead, portföy ve görüşme yönetimi.",
    targetBusinesses: [
      "Bağımsız emlak danışmanları",
      "Bölgesel emlak ofisleri",
      "Kiralık / satılık portföy yöneticileri",
      "Proje satış ofisleri",
    ],
    commonPainPoints: [
      "Lead kaçırma ve geç dönüş",
      "Portföy eşleştirme yükü",
      "Görüşme takibi dağınık",
      "İlan güncelliği",
      "Müşteri segmentasyonu zayıf",
    ],
    coreWorkflows: [
      "Lead yakalama → nitelendirme → atama",
      "İlan eşleştirme önerisi",
      "Görüşme / yer gösterme planlama",
      "Takip mesajı ve hatırlatma",
      "Pipeline özet raporu",
    ],
    workerAgents: [
      "Lead Nitelendirme Agent",
      "Portföy Eşleştirme Agent",
      "Görüşme Planlayıcı",
      "Takip Mesajı Agent",
      "İlan SSS Agent",
    ],
    dataToCollect: [
      "Bütçe ve lokasyon",
      "Satılık / kiralık tercihi",
      "Oda ve özellik ihtiyacı",
      "Zaman çizelgesi",
      "İletişim kanalı",
    ],
    mvpFeatures: [
      "Lead formu ve WhatsApp triyaj",
      "İlan öneri listesi (kural tabanlı)",
      "Görüşme slot önerisi",
      "Takip mesaj şablonları",
      "Danışman günlük özeti",
    ],
    risks: [
      "Yanıltıcı fiyat / taahhüt",
      "Kişisel veri ve KVKK",
      "Yanlış ilan eşleştirme",
      "Sözleşme / hukuki tavsiye verme",
    ],
  },
  BEAUTY_OS: {
    id: "BEAUTY_OS",
    name: "BeautyOS",
    description:
      "Güzellik salonları, klinik estetik ve bakım merkezleri için randevu ve müşteri deneyimi.",
    targetBusinesses: [
      "Güzellik salonları",
      "Cilt bakım ve lazer merkezleri",
      "Saç / nail studio",
      "Medikal estetik klinikleri",
    ],
    commonPainPoints: [
      "Randevu doluluk dalgalanması",
      "Paket ve kampanya karmaşası",
      "Tekrar ziyaret düşük",
      "Instagram DM yoğunluğu",
      "Personel uygunluk çakışması",
    ],
    coreWorkflows: [
      "Hizmet seçimi → uzman → randevu",
      "Kampanya / paket bilgilendirme",
      "Ön görüşme ve contraindication triyaj",
      "Upsell önerisi (kurallı)",
      "Sadakat ve tekrar randevu",
    ],
    workerAgents: [
      "Randevu ve Uzman Eşleştirici",
      "Kampanya Bilgi Agent",
      "Bakım Öncesi Triyaj Agent",
      "Sadakat Takip Agent",
      "Salon SSS Agent",
    ],
    dataToCollect: [
      "Hizmet türü",
      "Cilt / saç hassasiyeti özeti",
      "Tercih edilen uzman",
      "Bütçe aralığı",
      "Son ziyaret tarihi",
    ],
    mvpFeatures: [
      "Hizmet menüsü SSS",
      "Randevu slot önerisi",
      "Kampanya hatırlatma",
      "Tekrar ziyaret recall",
      "Günlük doluluk özeti",
    ],
    risks: [
      "Medikal sonuç vaadi",
      "Alerji / contraindication göz ardı",
      "KVKK ve görsel veri",
      "İnsan onayı olmadan işlem onayı",
    ],
  },
  RESTAURANT_OS: {
    id: "RESTAURANT_OS",
    name: "RestaurantOS",
    description:
      "Restoran ve kafe işletmeleri için rezervasyon, menü bilgisi ve misafir iletişimi.",
    targetBusinesses: [
      "Bağımsız restoranlar",
      "Kafe zincirleri",
      "Fine dining mekanları",
      "Paket servis ağırlıklı işletmeler",
    ],
    commonPainPoints: [
      "Rezervasyon karmaşası",
      "Yoğun saat telefon yükü",
      "Menü / alerjen soruları tekrarı",
      "No-show masalar",
      "Kampanya iletişimi tutarsız",
    ],
    coreWorkflows: [
      "Rezervasyon talebi → kapasite kontrolü",
      "Menü ve alerjen bilgilendirme",
      "Özel gün / grup talebi triyaj",
      "Bekleme listesi yönetimi",
      "Günlük servis özeti",
    ],
    workerAgents: [
      "Rezervasyon Agent",
      "Menü & Alerjen SSS Agent",
      "Grup Etkinlik Triyaj Agent",
      "Kampanya Bilgi Agent",
      "Servis Özet Agent",
    ],
    dataToCollect: [
      "Kişi sayısı ve tarih/saat",
      "Özel istek (doğum günü, alerji)",
      "İletişim bilgisi",
      "Tercih edilen alan (iç/dış)",
      "Kanal (telefon, web, WhatsApp)",
    ],
    mvpFeatures: [
      "Online rezervasyon talebi",
      "Menü SSS ve alerjen notu",
      "Rezervasyon hatırlatma",
      "Kapasite kural motoru (basit)",
      "Günlük masa özeti",
    ],
    risks: [
      "Alerjen hatası (kritik güvenlik)",
      "Kapasite aşımı",
      "Yanıltıcı kampanya",
      "Ödeme / iade taahhüdü",
    ],
  },
};

const SECTOR_ALIASES: Record<string, SectorId> = {
  dental_os: "DENTAL_OS",
  dentalos: "DENTAL_OS",
  dental: "DENTAL_OS",
  dis: "DENTAL_OS",
  dis_klinigi: "DENTAL_OS",
  estate_os: "ESTATE_OS",
  estateos: "ESTATE_OS",
  emlakos: "ESTATE_OS",
  emlak: "ESTATE_OS",
  estate: "ESTATE_OS",
  beauty_os: "BEAUTY_OS",
  beautyos: "BEAUTY_OS",
  beauty: "BEAUTY_OS",
  guzellik: "BEAUTY_OS",
  restaurant_os: "RESTAURANT_OS",
  restaurantos: "RESTAURANT_OS",
  restaurant: "RESTAURANT_OS",
  restoran: "RESTAURANT_OS",
  restoran_os: "RESTAURANT_OS",
};

const SELECTION_RULES: { sectorId: SectorId; patterns: RegExp[] }[] = [
  {
    sectorId: "DENTAL_OS",
    patterns: [
      /\bdiş\b/i,
      /\bdental\b/i,
      /\bklinik\b/i,
      /\bhasta\b/i,
      /\brandevu\b/i,
      /\bimplant\b/i,
    ],
  },
  {
    sectorId: "ESTATE_OS",
    patterns: [
      /\bemlak\b/i,
      /\bgayrimenkul\b/i,
      /\bilan\b/i,
      /\bportföy\b/i,
      /\bportfoy\b/i,
      /\bdanışman\b/i,
      /\bkiralık\b/i,
      /\bsatılık\b/i,
    ],
  },
  {
    sectorId: "BEAUTY_OS",
    patterns: [
      /\bgüzellik\b/i,
      /\bguzellik\b/i,
      /\bsalon\b/i,
      /\bestetik\b/i,
      /\bcilt\b/i,
      /\blazer\b/i,
      /\bsaç\b/i,
      /\bsac\b/i,
    ],
  },
  {
    sectorId: "RESTAURANT_OS",
    patterns: [
      /\brestoran\b/i,
      /\bkafe\b/i,
      /\bmenü\b/i,
      /\bmenu\b/i,
      /\brezervasyon\b/i,
      /\bmasa\b/i,
      /\bpaket\s*servis\b/i,
      /\balerjen\b/i,
    ],
  },
];

function normalizeAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

export function listSectors(): HermesSector[] {
  return Object.values(SECTORS);
}

export function getSectorById(id: string): HermesSector | null {
  const upper = id.trim().toUpperCase() as SectorId;

  if (upper in SECTORS) {
    return SECTORS[upper];
  }

  const alias = SECTOR_ALIASES[normalizeAlias(id)];

  if (alias) {
    return SECTORS[alias];
  }

  return null;
}

export function summarizeSector(sector: HermesSector): string {
  return `## ${sector.name} (\`${sector.id}\`)

${sector.description}

**Hedef işletmeler:**
${sector.targetBusinesses.map((item) => `- ${item}`).join("\n")}

**Yaygın acılar:**
${sector.commonPainPoints.map((item) => `- ${item}`).join("\n")}

**Çekirdek iş akışları:**
${sector.coreWorkflows.map((item) => `- ${item}`).join("\n")}

**Sektör worker agent'ları** (müşteri katmanı; Hermes Core değil):
${sector.workerAgents.map((item) => `- ${item}`).join("\n")}

**Toplanacak veriler:**
${sector.dataToCollect.map((item) => `- ${item}`).join("\n")}

**MVP özellikleri:**
${sector.mvpFeatures.map((item) => `- ${item}`).join("\n")}

**Riskler:**
${sector.risks.map((item) => `- ${item}`).join("\n")}`;
}

export function summarizeAllSectors(): string {
  const header = `## Hermes Sector Registry

${HERMES_CORE_BOUNDARY}

Kayıtlı sektör sistemleri (Hermes Core altı, müşteri asistanları üstü değil — müşteriye yalnızca sektör asistanı sunulur):
`;

  const body = listSectors()
    .map(
      (sector) =>
        `### ${sector.name} (\`${sector.id}\`)\n${sector.description}\n- MVP: ${sector.mvpFeatures.slice(0, 3).join(", ")}...`
    )
    .join("\n\n");

  return `${header}\n${body}`;
}

export function getSectorContextPrompt(sector?: HermesSector | null): string {
  const boundary = HERMES_CORE_BOUNDARY;

  if (!sector) {
    return `${boundary}

SEKTÖR REGISTRY ÖZETİ:
${listSectors()
  .map((item) => `- ${item.name} (${item.id}): ${item.description}`)
  .join("\n")}

Planlama yaparken hangi sektör OS'nin etkileneceğini belirt; müşteri yüzünde yalnızca sektör asistanı kapsamı öner.`;
  }

  return `${boundary}

AKTİF SEKTÖR BAĞLAMI — ${sector.name} (${sector.id}):
- Açıklama: ${sector.description}
- Hedef işletmeler: ${sector.targetBusinesses.join("; ")}
- Acılar: ${sector.commonPainPoints.join("; ")}
- İş akışları: ${sector.coreWorkflows.join("; ")}
- Worker agent'lar (müşteri katmanı): ${sector.workerAgents.join("; ")}
- MVP: ${sector.mvpFeatures.join("; ")}
- Riskler: ${sector.risks.join("; ")}

Hermes Core özel kalır; plan müşteri asistanı / sektör OS sınırları içinde kalmalı.`;
}

export function selectBestSectorForRequest(request: string): HermesSector {
  const scores = new Map<SectorId, number>();

  for (const rule of SELECTION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(request)) {
        scores.set(rule.sectorId, (scores.get(rule.sectorId) ?? 0) + 1);
      }
    }
  }

  const aliasMatch = Object.entries(SECTOR_ALIASES).find(([alias]) =>
    request.toLowerCase().includes(alias.replace(/_/g, ""))
  );

  if (aliasMatch) {
    scores.set(aliasMatch[1], (scores.get(aliasMatch[1]) ?? 0) + 3);
  }

  let bestId: SectorId = "DENTAL_OS";
  let bestScore = -1;

  for (const [id, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  if (bestScore <= 0) {
    return SECTORS.DENTAL_OS;
  }

  return SECTORS[bestId];
}

export function recommendSectorToStart(request: string): string {
  const ranked = listSectors()
    .map((sector) => {
      let score = 0;

      for (const rule of SELECTION_RULES) {
        if (rule.sectorId !== sector.id) {
          continue;
        }

        for (const pattern of rule.patterns) {
          if (pattern.test(request)) {
            score += 1;
          }
        }
      }

      return { sector, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0]?.sector ?? SECTORS.DENTAL_OS;
  const second = ranked[1]?.sector ?? SECTORS.ESTATE_OS;

  const lines = ranked.map(
    ({ sector, score }, index) =>
      `${index + 1}. **${sector.name}** (\`${sector.id}\`) — uyum skoru ${score}`
  );

  return `## Hangi sektörden başlamalıyız?

${HERMES_CORE_BOUNDARY}

**Önerilen ilk sektör:** ${top.name} (\`${top.id}\`)
**Alternatif:** ${second.name} (\`${second.id}\`)

**Sıralama (istek metnine göre):**
${lines.join("\n")}

**Neden ${top.name}?**
- MVP: ${top.mvpFeatures.slice(0, 2).join(", ")}
- Güçlü acı: ${top.commonPainPoints[0]}

Sonraki adım: \`sektör analizi: ${top.id}\` veya \`fırsat analizi: ${top.name} için B2B SaaS\``;
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function analyzeSector(
  sectorInput: string,
  focus = ""
): Promise<SectorRouterResult> {
  const sector = getSectorById(sectorInput);

  if (!sector) {
    return {
      success: false,
      message:
        "Bilinmeyen sektör. Kullanım: `sektör analizi: DENTAL_OS` veya `sektör analizi: dentalos`",
    };
  }

  const openai = getOpenAIClient();

  if (!openai) {
    return {
      success: false,
      message: "OpenAI yapılandırması eksik. Sektör analizi için OPENAI_API_KEY gerekli.",
    };
  }

  const focusLine = focus.trim()
    ? `Ek odak: ${focus}`
    : "Genel sektör stratejisi ve MVP önceliği";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${getBusinessContextPrompt()}

${getSectorContextPrompt(sector)}

${getPermissionBoundariesForPrompt()}

Görev: ${sector.name} için iç sektör analizi üret (Hermes Core özel kalır).
Bölümler: pazar özeti, hedef işletme segmenti, acı doğrulama, MVP önerisi, worker agent rolleri, veri modeli, riskler, 30 günlük yol haritası.
Dosya yazma, terminal veya deploy önerme. Müşteriye Hermes Core'dan bahsetme.`,
        },
        {
          role: "user",
          content: focusLine,
        },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim();

    if (!message) {
      return {
        success: false,
        message: "Sektör analizi tamamlandı ama cevap boş geldi.",
      };
    }

    const review = reviewPlanSafety(message);
    const body = review.safe ? message : review.message;

    return {
      success: true,
      message: `## Sektör Analizi — ${sector.name}\n\n${body}`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        "Sektör analizi oluşturulamadı: " +
        (error instanceof Error ? error.message : "bilinmeyen hata"),
    };
  }
}

export async function handleSectorRouterCommand(
  message: string
): Promise<SectorRouterResult | null> {
  const lower = message.toLowerCase().trim();

  if (
    lower === "sektörleri göster" ||
    lower === "sektorleri goster" ||
    lower.includes("sektörleri göster") ||
    lower.includes("sektorleri goster")
  ) {
    return { success: true, message: summarizeAllSectors() };
  }

  if (
    lower.includes("dentalos nedir") ||
    lower.includes("dental os nedir") ||
    lower === "dentalos"
  ) {
    const sector = getSectorById("DENTAL_OS");
    return sector
      ? { success: true, message: summarizeSector(sector) }
      : { success: false, message: "DentalOS bulunamadı." };
  }

  if (
    lower.includes("emlakos nedir") ||
    lower.includes("emlak os nedir") ||
    lower === "emlakos"
  ) {
    const sector = getSectorById("ESTATE_OS");
    return sector
      ? { success: true, message: summarizeSector(sector) }
      : { success: false, message: "EstateOS bulunamadı." };
  }

  if (
    lower.includes("hangi sektörden başlamalıyız") ||
    lower.includes("hangi sektorden baslamaliyiz") ||
    lower.includes("hangi sektörle başlamalıyız")
  ) {
    const context = message
      .replace(/hangi sektörden başlamalıyız\s*:?\s*/i, "")
      .replace(/hangi sektorden baslamaliyiz\s*:?\s*/i, "")
      .trim();

    return {
      success: true,
      message: recommendSectorToStart(context || message),
    };
  }

  if (lower.startsWith("sektör analizi:") || lower.startsWith("sektor analizi:")) {
    const match = message.match(/^sekt[oö]r\s+analizi\s*:\s*(.+)$/i);
    const rest = match?.[1]?.trim() ?? "";

    if (!rest) {
      return {
        success: false,
        message: "Kullanım: sektör analizi: DENTAL_OS veya sektör analizi: dentalos",
      };
    }

    const sectorToken = rest.split(/\s+/)[0] ?? "";
    const focus = rest.slice(sectorToken.length).trim();

    return analyzeSector(sectorToken, focus);
  }

  return null;
}
