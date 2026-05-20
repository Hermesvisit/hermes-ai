import OpenAI from "openai";
import {
  listProjectFiles,
  readProjectFile,
  summarizeProjectStructure,
} from "@/lib/hermes/project-reader";
import { reviewPlanSafety } from "@/lib/hermes/security-review";
import {
  checkPlanningPermission,
  getPermissionBoundariesForPrompt,
} from "@/lib/hermes/permissions";
import { getBusinessContextPrompt } from "@/lib/hermes/business";
import {
  formatPlannerAgentHeader,
  getAgentContextPrompt,
  resolveAgentForMessage,
  type HermesAgent,
} from "@/lib/hermes/agents";

const MAX_TARGET_FILES = 8;
const MAX_FILES_TO_READ = 6;
const MAX_FILE_SNIPPET_CHARS = 12_000;

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".md"];

export type PatchPlannerResult =
  | { success: true; message: string }
  | { success: false; message: string };

type TargetFilesAnalysis = {
  targetFiles: string[];
  reasoning: string;
};

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

function filterCandidateFiles(files: string[]): string[] {
  return files.filter((filePath) => {
    const lower = filePath.toLowerCase();
    return CODE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  });
}

function parseTargetFilesFromResponse(
  text: string,
  knownFiles: string[]
): string[] {
  const jsonMatch = text.match(/\[[\s\S]*?\]/);

  if (jsonMatch) {
    try {
      const parsed: unknown = JSON.parse(jsonMatch[0]);

      if (Array.isArray(parsed)) {
        const paths = parsed
          .filter((item): item is string => typeof item === "string")
          .filter((item) => knownFiles.includes(item));

        if (paths.length > 0) {
          return paths.slice(0, MAX_TARGET_FILES);
        }
      }
    } catch {
      // JSON parse failed; fall back to substring matching
    }
  }

  const matched = knownFiles.filter((filePath) => text.includes(filePath));

  return [...new Set(matched)].slice(0, MAX_TARGET_FILES);
}

async function loadFileContexts(
  targetFiles: string[]
): Promise<{ contexts: string; readErrors: string[] }> {
  const readErrors: string[] = [];
  const chunks: string[] = [];
  let usedChars = 0;

  for (const filePath of targetFiles.slice(0, MAX_FILES_TO_READ)) {
    if (usedChars >= MAX_FILE_SNIPPET_CHARS) {
      break;
    }

    const readResult = await readProjectFile(filePath);

    if (!readResult.success) {
      readErrors.push(`${filePath}: ${readResult.message}`);
      continue;
    }

    const remaining = MAX_FILE_SNIPPET_CHARS - usedChars;
    const content = readResult.data.content.slice(0, remaining);
    usedChars += content.length;

    chunks.push(
      `### ${readResult.data.relativePath}${readResult.data.truncated ? " (kısaltıldı)" : ""}\n\`\`\`\n${content}\n\`\`\``
    );
  }

  return {
    contexts: chunks.join("\n\n"),
    readErrors,
  };
}

function withPlannerContext(system: string, agent: HermesAgent): string {
  return `${system}\n\n${getBusinessContextPrompt()}\n\n${getAgentContextPrompt(agent)}\n\n${getPermissionBoundariesForPrompt()}`;
}

function getPlannerAgent(request: string): HermesAgent {
  return resolveAgentForMessage(request);
}

function guardPlanningRequest(request: string): PatchPlannerResult | null {
  const permission = checkPlanningPermission(request);

  if (!permission.allowed) {
    return { success: true, message: permission.message };
  }

  return null;
}

async function runOpenAIAnalysis(params: {
  system: string;
  user: string;
  agent: HermesAgent;
}): Promise<PatchPlannerResult> {
  const openai = getOpenAIClient();

  if (!openai) {
    return {
      success: false,
      message:
        "OpenAI yapılandırması eksik. Patch planı için OPENAI_API_KEY gerekli.",
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: withPlannerContext(params.system, params.agent) },
        { role: "user", content: params.user },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim();

    if (!message) {
      return {
        success: false,
        message: "Patch planı oluşturuldu ama cevap boş geldi.",
      };
    }

    return applySecurityReviewToPlan({ success: true, message });
  } catch (error) {
    return {
      success: false,
      message:
        "Patch planı oluşturulamadı: " +
        (error instanceof Error ? error.message : "bilinmeyen hata"),
    };
  }
}

function applySecurityReviewToPlan(
  result: PatchPlannerResult
): PatchPlannerResult {
  if (!result.success) {
    return result;
  }

  const review = reviewPlanSafety(result.message);

  if (review.safe) {
    return result;
  }

  return {
    success: true,
    message: review.message,
  };
}

export async function analyzeTargetFiles(
  request: string
): Promise<PatchPlannerResult> {
  const trimmedRequest = request.trim();

  if (!trimmedRequest) {
    return {
      success: false,
      message: "Hedef dosya analizi için bir istek yazmalısın.",
    };
  }

  const blocked = guardPlanningRequest(trimmedRequest);
  if (blocked) {
    return blocked;
  }

  const listed = await listProjectFiles();

  if (!listed.success) {
    return { success: false, message: listed.message };
  }

  const candidates = filterCandidateFiles(listed.data);

  if (candidates.length === 0) {
    return {
      success: false,
      message: "Analiz için uygun kod dosyası bulunamadı.",
    };
  }

  const fileListSample = candidates.slice(0, 200).join("\n");

  const plannerAgent = getPlannerAgent(trimmedRequest);

  const analysis = await runOpenAIAnalysis({
    system: `Sen Hermes Safe Patch Planner'sın.
Sadece okuma modundasın. Dosya yazma veya düzenleme yok.
Görev: kullanıcı isteğine göre değişmesi muhtemel dosyaları seç.
Yanıt formatı:
1) Kısa gerekçe (Türkçe)
2) Son satırda yalnızca JSON dizi: ["path/to/file.ts", ...]
En fazla ${MAX_TARGET_FILES} dosya seç. Sadece listedeki yolları kullan.`,
    user: `İstek:\n${trimmedRequest}\n\nProje dosyaları:\n${fileListSample}`,
    agent: plannerAgent,
  });

  if (!analysis.success) {
    return analysis;
  }

  const targetFiles = parseTargetFilesFromResponse(
    analysis.message,
    candidates
  );

  if (targetFiles.length === 0) {
    return applySecurityReviewToPlan({
      success: true,
      message: `${analysis.message}\n\nNot: Otomatik dosya seçimi yapılamadı. İsteği biraz daha netleştir.`,
    });
  }

  return applySecurityReviewToPlan({
    success: true,
    message: `${analysis.message}\n\nSeçilen dosyalar:\n${targetFiles.map((f) => `- ${f}`).join("\n")}`,
  });
}

export async function generateSuggestedChanges(
  request: string
): Promise<PatchPlannerResult> {
  const trimmedRequest = request.trim();

  if (!trimmedRequest) {
    return {
      success: false,
      message: "Öneri üretmek için bir istek yazmalısın.",
    };
  }

  const blocked = guardPlanningRequest(trimmedRequest);
  if (blocked) {
    return blocked;
  }

  const targets = await analyzeTargetFilesInternal(trimmedRequest);

  if (!targets.success) {
    return { success: false, message: targets.message };
  }

  const { contexts, readErrors } = await loadFileContexts(targets.data.targetFiles);

  if (!contexts) {
    return {
      success: false,
      message:
        "Hedef dosyalar okunamadı.\n" + readErrors.map((e) => `- ${e}`).join("\n"),
    };
  }

  const errorsNote =
    readErrors.length > 0
      ? `\n\nOkunamayan dosyalar:\n${readErrors.map((e) => `- ${e}`).join("\n")}`
      : "";

  const plannerAgent = getPlannerAgent(trimmedRequest);

  const suggestions = await runOpenAIAnalysis({
    system: `Sen Hermes Safe Patch Planner'sın.
KURALLAR:
- Dosya yazma/düzenleme YOK; yalnızca metin öneri.
- Her dosya için: amaç, önerilen değişiklik, metin patch/diff örneği.
- Riskler, test planı ve geri alma notu ekle.
- Türkçe, net ve uygulanabilir yaz.`,
    user: `İstek:\n${trimmedRequest}\n\nHedef dosyalar:\n${targets.data.targetFiles.map((f) => `- ${f}`).join("\n")}\n\nGerekçe:\n${targets.data.reasoning}\n\nDosya içerikleri:\n${contexts}${errorsNote}`,
    agent: plannerAgent,
  });

  return applySecurityReviewToPlan(suggestions);
}

async function analyzeTargetFilesInternal(
  request: string
): Promise<
  | { success: true; data: TargetFilesAnalysis }
  | { success: false; message: string }
> {
  const listed = await listProjectFiles();

  if (!listed.success) {
    return { success: false, message: listed.message };
  }

  const candidates = filterCandidateFiles(listed.data);

  if (candidates.length === 0) {
    return {
      success: false,
      message: "Analiz için uygun kod dosyası bulunamadı.",
    };
  }

  const plannerAgent = getPlannerAgent(request);

  const analysis = await runOpenAIAnalysis({
    system: `Sen Hermes Safe Patch Planner'sın. Sadece dosya seçimi yap.
Yanıtın son satırı yalnızca JSON dizi olsun: ["dosya/yolu", ...]
En fazla ${MAX_TARGET_FILES} dosya.`,
    user: `İstek:\n${request}\n\nDosyalar:\n${candidates.slice(0, 200).join("\n")}`,
    agent: plannerAgent,
  });

  if (!analysis.success) {
    return { success: false, message: analysis.message };
  }

  const targetFiles = parseTargetFilesFromResponse(
    analysis.message,
    candidates
  );

  if (targetFiles.length === 0) {
    return {
      success: false,
      message:
        "Hedef dosya seçilemedi. İsteği netleştir veya dosya yollarını belirt.",
    };
  }

  const reasoning = analysis.message
    .replace(/\[[\s\S]*\]\s*$/, "")
    .trim();

  return {
    success: true,
    data: { targetFiles, reasoning },
  };
}

export async function createPatchPlan(
  userRequest: string
): Promise<PatchPlannerResult> {
  const trimmedRequest = userRequest.trim();

  if (!trimmedRequest) {
    return {
      success: false,
      message: "Patch planı için bir istek yazmalısın.",
    };
  }

  const blocked = guardPlanningRequest(trimmedRequest);
  if (blocked) {
    return blocked;
  }

  const structure = await summarizeProjectStructure();
  const targets = await analyzeTargetFilesInternal(trimmedRequest);

  if (!targets.success) {
    return { success: false, message: targets.message };
  }

  const { contexts, readErrors } = await loadFileContexts(targets.data.targetFiles);

  const structureBlock = structure.success
    ? structure.data
    : "Proje yapısı özeti alınamadı.";

  const readNote =
    readErrors.length > 0
      ? `\n\nOkunamayan dosyalar:\n${readErrors.map((e) => `- ${e}`).join("\n")}`
      : "";

  const plannerAgent = getPlannerAgent(trimmedRequest);

  const plan = await runOpenAIAnalysis({
    system: `Sen Hermes Safe Patch Planner'sın.
Bu bir PLAN modudur; dosyalara yazma YOK.
Çıktı bölümleri:
1) Amaç
2) Etkilenecek dosyalar
3) Önerilen değişiklikler (metin patch/diff)
4) Riskler
5) Test planı
6) Geri alma notu
Türkçe ve uygulanabilir yaz.`,
    user: `Kullanıcı isteği:\n${trimmedRequest}\n\nProje özeti:\n${structureBlock}\n\nHedef dosyalar:\n${targets.data.targetFiles.map((f) => `- ${f}`).join("\n")}\n\nSeçim gerekçesi:\n${targets.data.reasoning}\n\nDosya içerikleri:\n${contexts || "(içerik okunamadı)"}${readNote}`,
    agent: plannerAgent,
  });

  if (!plan.success) {
    return plan;
  }

  return applySecurityReviewToPlan({
    success: true,
    message: `## Hermes Safe Patch Plan\n${formatPlannerAgentHeader(plannerAgent)}\n\n${plan.message}\n\n---\nNot: Bu plan salt okunurdur; Hermes dosya yazmaz.`,
  });
}

export function extractPatchPlannerRequest(
  message: string,
  pattern: RegExp
): string {
  const match = message.match(pattern);
  return match?.[1]?.trim() ?? "";
}
