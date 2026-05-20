export type SecurityFinding = {
  id: string;
  label: string;
  match: string;
  whyDangerous: string;
  saferAlternative: string;
};

export type SecurityReviewResult = {
  safe: boolean;
  findings: SecurityFinding[];
  message: string;
};

type DangerousRule = {
  id: string;
  label: string;
  regex: RegExp;
  whyDangerous: string;
  saferAlternative: string;
};

const DANGEROUS_RULES: DangerousRule[] = [
  {
    id: "child_process",
    label: "child_process kullanımı",
    regex: /\bchild_process\b/i,
    whyDangerous:
      "Alt süreç açmak sunucuda keyfi komut çalıştırmaya kapı aralar.",
    saferAlternative:
      "İş mantığını uygulama kodunda tut; shell yerine API/SDK veya onaylı servis katmanı kullan.",
  },
  {
    id: "exec_call",
    label: "exec( çağrısı",
    regex: /\bexec\s*\(/i,
    whyDangerous: "exec ile shell komutu çalıştırmak en yüksek riskli yürütmedir.",
    saferAlternative:
      "Komut çalıştırma yerine tip güvenli fonksiyonlar veya kısıtlı izinli servisler kullan.",
  },
  {
    id: "spawn_call",
    label: "spawn( çağrısı",
    regex: /\bspawn\s*\(/i,
    whyDangerous:
      "spawn ile başlatılan süreçler kullanıcı girdisiyle tehlikeli hale gelebilir.",
    saferAlternative:
      "Harici süreç yerine kütüphane/API entegrasyonu veya kuyruk tabanlı işleyici tercih et.",
  },
  {
    id: "eval_execution",
    label: "Dinamik kod yürütme (eval)",
    regex: /\beval\s*\(/i,
    whyDangerous:
      "eval ve benzeri yöntemler keyfi kod çalıştırmasına izin verir.",
    saferAlternative:
      "Sabit, gözden geçirilmiş kod yolları ve açık fonksiyon sözleşmeleri kullan.",
  },
  {
    id: "rm_rf",
    label: "rm -rf",
    regex: /\brm\s+-rf\b/i,
    whyDangerous: "Toplu silme komutu geri dönüşsüz veri kaybına yol açar.",
    saferAlternative:
      "Tekil, onaylı silme akışı ve yedek/geri alma planı ile sınırlı dosya işlemleri öner.",
  },
  {
    id: "del_recursive",
    label: "del /s",
    regex: /\bdel\s+\/s\b/i,
    whyDangerous: "Windows’ta özyinelemeli silme kritik dosyaları yok edebilir.",
    saferAlternative:
      "Hedefli silme ve audit log ile sınırlı bir temizlik adımı planla.",
  },
  {
    id: "fs_unlink_delete",
    label: "Dosya silme API’si",
    regex: /\b(unlinkSync|rmSync|rmdirSync|fs\.promises\.unlink|fs\.unlink)\s*\(/i,
    whyDangerous:
      "Kontrolsüz dosya silme üretim verisini veya yapılandırmayı kalıcı silebilir.",
    saferAlternative:
      "Soft-delete, arşivleme veya yalnızca belirli dizinlere izin veren güvenli silme katmanı kullan.",
  },
  {
    id: "dotenv_direct_access",
    label: "Doğrudan .env erişimi",
    regex: /\.env(\.local)?\b|readFileSync\s*\(\s*['"`].*\.env/i,
    whyDangerous:
      "Ortam dosyalarının doğrudan okunması/yazılması gizli anahtar sızıntısı riski taşır.",
    saferAlternative:
      "process.env üzerinden sunucu tarafında oku; .env dosyasını asla patch ile yazdırma.",
  },
  {
    id: "api_key_exposure",
    label: "API anahtarı ifşası",
    regex:
      /\b(sk-[a-zA-Z0-9]{10,}|OPENAI_API_KEY\s*=\s*['"][^'"]+['"]|api[_-]?key\s*[:=]\s*['"][^'"]+['"])/i,
    whyDangerous: "Plan içinde düz metin anahtar paylaşımı sızıntıya neden olur.",
    saferAlternative:
      "Anahtarları yalnızca ortam değişkeninde tut; koda veya sohbete yapıştırma.",
  },
  {
    id: "unrestricted_write",
    label: "Kısıtsız dosya yazma",
    regex:
      /\b(writeFileSync|writeFile|appendFile|createWriteStream)\s*\(\s*[^'"`\s]/i,
    whyDangerous:
      "Dinamik yola yazma path traversal veya istenmeyen dosya üzerine yazmaya açıktır.",
    saferAlternative:
      "Sabit, doğrulanmış yollar ve patch-planner gibi salt okunur planlama akışı kullan.",
  },
  {
    id: "shell_command_runner",
    label: "Terminal komut çalıştırıcı",
    regex:
      /\b(runTerminalCommand|shell\.open|os\.system|subprocess\.(run|Popen)|powershell\s+-)/i,
    whyDangerous:
      "Genel terminal komut çalıştırıcıları kullanıcı girdisiyle kötüye kullanılabilir.",
    saferAlternative:
      "İzin verilen işlemler için dar kapsamlı, test edilmiş server action veya API uçları tanımla.",
  },
];

function extractMatchSnippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + length + 24);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function detectDangerousPatterns(text: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const seen = new Set<string>();

  for (const rule of DANGEROUS_RULES) {
    const match = rule.regex.exec(text);

    if (!match || seen.has(rule.id)) {
      continue;
    }

    seen.add(rule.id);

    findings.push({
      id: rule.id,
      label: rule.label,
      match: extractMatchSnippet(text, match.index, match[0].length),
      whyDangerous: rule.whyDangerous,
      saferAlternative: rule.saferAlternative,
    });
  }

  return findings;
}

function formatUnsafePlanMessage(findings: SecurityFinding[]): string {
  const unsafeItems = findings
    .map((f, i) => `${i + 1}. **${f.label}** — eşleşen: \`${f.match}\``)
    .join("\n");

  const whyDangerous = findings
    .map((f, i) => `${i + 1}. ${f.whyDangerous}`)
    .join("\n");

  const saferAlternatives = findings
    .map((f, i) => `${i + 1}. ${f.saferAlternative}`)
    .join("\n");

  return `## Hermes Security Review — Plan reddedildi

Plan çıktısında güvenli olmayan uygulama örüntüleri tespit edildi. Orijinal plan döndürülmedi.

### 1) Tespit edilen riskli öğeler
${unsafeItems}

### 2) Neden tehlikeli
${whyDangerous}

### 3) Daha güvenli alternatif
${saferAlternatives}

### 4) Önerilen güvenli sonraki adım
- İsteği yeniden yaz: yalnızca TypeScript/React/Next.js kod değişikliği ve mevcut API katmanları.
- \`değişiklik planı oluştur:\` komutunu shell, dosya silme veya .env yazma içermeden tekrar dene.
- Gerekirse \`hangi dosyalar değişmeli:\` ile önce dosya kapsamını netleştir.
- Uygulamayı manuel ve gözden geçirilmiş patch ile uygula; Hermes dosya yazmaz.`;
}

export function reviewPlanSafety(planText: string): SecurityReviewResult {
  const findings = detectDangerousPatterns(planText);

  if (findings.length === 0) {
    return {
      safe: true,
      findings: [],
      message: planText,
    };
  }

  return {
    safe: false,
    findings,
    message: formatUnsafePlanMessage(findings),
  };
}
