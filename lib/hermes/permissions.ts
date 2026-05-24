export const PermissionLevel = {
  LEVEL_1_CHAT_ONLY: 1,
  LEVEL_2_READ_PROJECT: 2,
  LEVEL_3_PLAN_PATCH: 3,
  LEVEL_4_SECURITY_REVIEW: 4,
  LEVEL_5_WRITE_FILES_DISABLED: 5,
  LEVEL_6_TERMINAL_DISABLED: 6,
  LEVEL_7_DEPLOY_DISABLED: 7,
} as const;

export type PermissionLevelId =
  (typeof PermissionLevel)[keyof typeof PermissionLevel];

/** Aktif üst yetki: planlama + güvenlik incelemesi; yazma/terminal/deploy kapalı. */
const ACTIVE_PERMISSION_LEVEL = PermissionLevel.LEVEL_4_SECURITY_REVIEW;

export type DisallowedCapability = "write_files" | "terminal" | "deploy";

const DISALLOWED_REQUEST_PATTERNS: Record<
  DisallowedCapability,
  RegExp[]
> = {
  write_files: [
    /\bdosya\s*yaz\b/i,
    /\bwritefile\b/i,
    /\bfs\.write/i,
    /\botomatik\s*(kaydet|düzenle|degistir|değiştir)\b/i,
    /\bpatch\s*uygula\b/i,
    /\bdosyay[ıi]\s*düzenle\b/i,
    /\bunrestricted\s*write\b/i,
  ],
  terminal: [
    /\bterminal\b/i,
    /\bshell\s*komut/i,
    /\bkomut\s*çalıştır\b/i,
    /\bkomut\s*calistir\b/i,
    /\bchild_process\b/i,
    /\bexec\s*\(/i,
    /\bspawn\s*\(/i,
    /\bnpm\s+run\b/i,
    /\byarn\s+/i,
    /\bpnpm\s+/i,
    /\bpowershell\b/i,
    /\bbash\s+-c\b/i,
  ],
  deploy: [
    /\bdeploy\b/i,
    /\bvercel\s+deploy\b/i,
    /\bproduction['']?a\s*(al|çıkar|cikar)\b/i,
    /\bcanl[ıi]ya\s*çık\b/i,
    /\bcanliya\s*cik\b/i,
    /\bship\s+to\s+prod\b/i,
  ],
};

const CAPABILITY_LABELS: Record<DisallowedCapability, string> = {
  write_files: "Dosya yazma / otomatik düzenleme",
  terminal: "Terminal / shell komut çalıştırma",
  deploy: "Deploy / canlıya alma",
};

export function getCurrentPermissionLevel(): PermissionLevelId {
  return ACTIVE_PERMISSION_LEVEL;
}

export function canReadProject(): boolean {
  return getCurrentPermissionLevel() >= PermissionLevel.LEVEL_2_READ_PROJECT;
}

export function canPlanPatch(): boolean {
  return getCurrentPermissionLevel() >= PermissionLevel.LEVEL_3_PLAN_PATCH;
}

export function canRunSecurityReview(): boolean {
  return getCurrentPermissionLevel() >= PermissionLevel.LEVEL_4_SECURITY_REVIEW;
}

export function canWriteFiles(): boolean {
  return false;
}

export function canRunTerminal(): boolean {
  return false;
}

export function canDeploy(): boolean {
  return false;
}

export function detectDisallowedRequestIntents(
  request: string
): DisallowedCapability[] {
  const intents: DisallowedCapability[] = [];

  for (const capability of Object.keys(
    DISALLOWED_REQUEST_PATTERNS
  ) as DisallowedCapability[]) {
    const matched = DISALLOWED_REQUEST_PATTERNS[capability].some((pattern) =>
      pattern.test(request)
    );

    if (matched) {
      intents.push(capability);
    }
  }

  return intents;
}

export function getPermissionBoundariesForPrompt(): string {
  return `İZİN SINIRLARI (zorunlu):
- Aktif seviye: LEVEL_${getCurrentPermissionLevel()} (Security Review dahil)
- Proje okuma: ${canReadProject() ? "açık" : "kapalı"}
- Patch planlama (metin): ${canPlanPatch() ? "açık" : "kapalı"}
- Güvenlik incelemesi: ${canRunSecurityReview() ? "açık" : "kapalı"}
- Dosya yazma: kapalı (LEVEL_5)
- Terminal: kapalı (LEVEL_6)
- Deploy: kapalı (LEVEL_7)
Asla dosya yazma, terminal çalıştırma veya deploy önerme; yalnızca plan metni üret.`;
}

export function formatDisallowedPlanningMessage(
  intents: DisallowedCapability[]
): string {
  const items = intents
    .map((intent) => `- ${CAPABILITY_LABELS[intent]}: şu an kapalı`)
    .join("\n");

  return `## Hermes Permission Layer — İstek kapsam dışı

Bu istek şu an etkin olmayan yetenekler içeriyor:
${items}

### Neden
Hermes şu an salt okunur + planlama modunda. Dosya yazma, terminal ve deploy kasıtlı olarak devre dışı.

### Güvenli alternatif
- \`değişiklik planı oluştur: <özellik>\` ile metin patch planı al
- \`hangi dosyalar değişmeli: <özellik>\` ile dosya kapsamını netleştir
- \`dosya oku: <path>\` ile ilgili dosyayı incele
- Değişiklikleri sen manuel uygula (Cursor/IDE)

### Sonraki adım
İsteği yalnızca kod/plan diliyle yeniden yaz; "otomatik yaz", "terminalde çalıştır" veya "deploy et" ifadelerini kaldır.`;
}

export function checkPlanningPermission(
  request: string
): { allowed: true } | { allowed: false; message: string } {
  if (!canPlanPatch()) {
    return {
      allowed: false,
      message:
        "Patch planlama yetkisi kapalı. Önce yetki seviyesi LEVEL_3 veya üzeri gerekir.",
    };
  }

  const intents = detectDisallowedRequestIntents(request);

  if (intents.length > 0) {
    return {
      allowed: false,
      message: formatDisallowedPlanningMessage(intents),
    };
  }

  return { allowed: true };
}

export function explainPermissionLimits(): string {
  const level = getCurrentPermissionLevel();

  return `## Hermes — Yetkiler ve Yetenekler

**Aktif izin seviyesi:** LEVEL_${level} (Security Review dahil)

### Aktif modüller
| Modül | Durum | Açıklama |
|-------|-------|----------|
| Chat | açık | Genel sohbet, persona/mod, OpenAI yanıtları |
| Memory | açık | Kalıcı kullanıcı tercihleri ve notlar |
| Tasks | açık | Görev ekleme, listeleme, tamamlama |
| Project Reader | açık | Repo yapısını güvenli listeleme |
| File Reader | açık | Tek dosya okuma (path traversal korumalı) |
| File Analysis | açık | Dosya içeriği analizi (salt okunur) |
| Patch Planner | açık | Metin patch planı (dosyaya yazmaz) |
| Security Review | açık | Planlarda tehlikeli örüntü taraması |
| Permission Layer | açık | Yetki seviyeleri ve kapsam dışı istek reddi |
| Business Identity | açık | İş profili ve bağlam enjeksiyonu |
| Agent Registry | açık | CEO/CTO/Research/Marketing/Sales/UX agent seçimi |
| Market Intelligence | açık | Pazar analizi, fırsat skoru, rakip planı, fikir değerlendirme |
| Research Memory | açık | Araştırma geçmişi, karşılaştırma, otomatik pazar kaydı |
| Sector Registry | açık | DentalOS, EstateOS, BeautyOS, RestaurantOS (Hermes Core altı) |
| Business Instances | açık | Sektör başına izole işletme bağlamı (Klinik Nova, vb.) |

### Bilinçli olarak kapalı
- **Dosya yazma** — kapalı (LEVEL_5; otomatik düzenleme / patch uygulama yok)
- **Terminal** — kapalı (LEVEL_6; shell, npm run, exec önerilmez)
- **Deploy** — kapalı (LEVEL_7; canlıya alma / Vercel deploy yok)

Hermes dosyalara doğrudan yazmaz; plan ve analiz üretir, değişiklikleri sen uygularsın.

### Örnek komutlar

**Genel / izin**
- \`yetkilerimi göster\` · \`hermes ne yapabilir\`

**Memory & Tasks**
- \`bunu hatırla: …\` · \`ne hatırlıyorsun\`
- \`görev ekle: …\` · \`görevlerim\` · \`görevi tamamla 1\`

**Project Reader / File Reader / File Analysis**
- \`proje yapısını göster\`
- \`dosya oku: lib/hermes/router.ts\`
- \`dosyayı analiz et: app/page.tsx\`

**Patch Planner** (çıktı Security Review'dan geçer)
- \`değişiklik planı oluştur: …\`
- \`bu özelliği nasıl ekleriz: …\`
- \`hangi dosyalar değişmeli: …\`

**Business Identity**
- \`iş profilini göster\` · \`hermes kim\` · \`sektörümüz ne\`

**Agent Registry**
- \`agentleri göster\` · \`hangi agent aktif\`
- \`CTO agent olarak düşün\` · \`bu işi hangi agent yapmalı: …\`

**Market Intelligence**
- \`pazar analizi: AI SaaS fikir doğrulama\`
- \`fırsat analizi: B2B otomasyon aracı\`
- \`rakip analizi planı: …\`
- \`bu fikir mantıklı mı: …\`

**Research Memory**
- \`araştırma hafızası\` · \`geçmiş fırsatlar\`
- \`son araştırmalar\` · \`eski analizleri göster\`
- \`hangi fikir daha mantıklı: …\`

**Sector Registry** (iç kullanım — müşteriye Hermes Core açılmaz)
- \`sektörleri göster\` · \`dentalos nedir\` · \`emlakos nedir\`
- \`hangi sektörden başlamalıyız\`
- \`sektör analizi: DENTAL_OS\`

**Business Instances** (izole işletme bağlamı)
- \`işletmeleri göster\` · \`dentalos işletmeleri\`
- \`klinik nova nedir\` · \`hangi işletme hangi sektörde\`
- \`işletme analizi: Klinik Nova\`

Pazar komutları başarılı olduğunda özetler Research Memory'ye otomatik kaydedilir.`;
}
