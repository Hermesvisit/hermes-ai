import {
  saveMemory,
  listMemories,
  shouldAutoRemember,
  getMemoryContext,
} from "@/lib/hermes/memory";

import {
  addTask,
  listTasks,
  completeTask,
} from "@/lib/hermes/tasks";

import {
  detectMode,
  detectPersona,
  buildSystemPrompt,
} from "@/lib/hermes/prompts";

import {
  summarizeProjectStructure,
  readProjectFile,
  extractProjectFilePath,
} from "@/lib/hermes/project-reader";

import {
  createPatchPlan,
  analyzeTargetFiles,
  extractPatchPlannerRequest,
} from "@/lib/hermes/patch-planner";

import {
  canReadProject,
  canPlanPatch,
  explainPermissionLimits,
} from "@/lib/hermes/permissions";

import {
  summarizeBusinessIdentity,
  getBusinessFieldAnswer,
} from "@/lib/hermes/business";

import {
  summarizeAllAgents,
  formatActiveAgentStatus,
  recommendAgentForTask,
  resolveAgentForMessage,
  parseExplicitAgentFromMessage,
  setPinnedAgent,
  getAgentById,
} from "@/lib/hermes/agents";

import OpenAI from "openai";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

export async function handleHermesMessage(params: {
  message: string;
  selectedPersona: string;
  selectedMode: string;
}) {
  const { message, selectedPersona, selectedMode } = params;

  const lower = message.toLowerCase();

  if (
    lower.startsWith("bunu hatırla") ||
    lower.startsWith("bunu hatirla")
  ) {
    const memoryText = message
      .replace(/^bunu hatırla[:：]?\s*/i, "")
      .replace(/^bunu hatirla[:：]?\s*/i, "");

    return await saveMemory(memoryText, "manual");
  }

  if (
    lower.includes("ne hatırlıyorsun") ||
    lower.includes("ne hatirliyorsun") ||
    lower.includes("hafızanda ne var") ||
    lower.includes("hafizanda ne var")
  ) {
    return await listMemories();
  }

  if (
    lower.startsWith("görev ekle") ||
    lower.startsWith("gorev ekle") ||
    lower.startsWith("bana görev ekle") ||
    lower.startsWith("bana gorev ekle")
  ) {
    const taskTitle = message
      .replace(/^görev ekle[:：]?\s*/i, "")
      .replace(/^gorev ekle[:：]?\s*/i, "")
      .replace(/^bana görev ekle[:：]?\s*/i, "")
      .replace(/^bana gorev ekle[:：]?\s*/i, "");

    return await addTask(taskTitle);
  }

  if (
    lower.includes("görevlerim") ||
    lower.includes("gorevlerim") ||
    lower.includes("yapılacaklar") ||
    lower.includes("yapilacaklar")
  ) {
    return await listTasks();
  }

  if (
    lower.startsWith("görevi tamamla") ||
    lower.startsWith("gorevi tamamla") ||
    lower.startsWith("görev tamamla") ||
    lower.startsWith("gorev tamamla")
  ) {
    const numberMatch = lower.match(/\d+/);

    const taskNumber = numberMatch ? Number(numberMatch[0]) : 1;

    return await completeTask(taskNumber);
  }

  if (
    lower.includes("yetkilerimi göster") ||
    lower.includes("yetkilerimi goster") ||
    lower.includes("hermes ne yapabilir")
  ) {
    return {
      success: true,
      message: explainPermissionLimits(),
    };
  }

  if (
    lower.includes("iş profilini göster") ||
    lower.includes("is profilini goster")
  ) {
    return {
      success: true,
      message: summarizeBusinessIdentity(),
    };
  }

  if (lower.includes("hermes kim")) {
    return {
      success: true,
      message: getBusinessFieldAnswer("identity"),
    };
  }

  if (lower.includes("sektörümüz ne") || lower.includes("sektorumuz ne")) {
    return {
      success: true,
      message: getBusinessFieldAnswer("industry"),
    };
  }

  if (
    lower.includes("hedef kitlemiz kim") ||
    lower.includes("hedef kitlemiz")
  ) {
    return {
      success: true,
      message: getBusinessFieldAnswer("audience"),
    };
  }

  if (lower.includes("iş modelimiz ne") || lower.includes("is modelimiz ne")) {
    return {
      success: true,
      message: getBusinessFieldAnswer("monetization"),
    };
  }

  if (lower.includes("agentleri göster") || lower.includes("agentleri goster")) {
    return {
      success: true,
      message: summarizeAllAgents(),
    };
  }

  if (lower.includes("hangi agent aktif")) {
    return {
      success: true,
      message: formatActiveAgentStatus(),
    };
  }

  if (
    lower.includes("bu işi hangi agent yapmalı") ||
    lower.includes("bu isi hangi agent yapmali")
  ) {
    const task =
      message
        .replace(/bu işi hangi agent yapmalı\s*:?\s*/i, "")
        .replace(/bu isi hangi agent yapmali\s*:?\s*/i, "")
        .trim() || message;

    return {
      success: true,
      message: recommendAgentForTask(task),
    };
  }

  const explicitAgent = parseExplicitAgentFromMessage(message);

  if (explicitAgent) {
    setPinnedAgent(explicitAgent);
    const agent = getAgentById(explicitAgent);

    const isPinOnly =
      /agent\s+olarak|gibi\s+düşün|gibi\s+dusun|olarak\s+düşün|olarak\s+dusun|olarak\s+cevapla/i.test(
        lower
      ) && message.trim().split(/\s+/).length <= 8;

    if (isPinOnly) {
      return {
        success: true,
        message: `**${agent?.name ?? explicitAgent}** aktif edildi. Sonraki mesajlarda bu agent kimliğiyle devam edeceğim.`,
      };
    }
  }

  if (
    lower.includes("proje yapısını göster") ||
    lower.includes("proje yapisini goster")
  ) {
    if (!canReadProject()) {
      return {
        success: false,
        message:
          "Proje okuma yetkisi kapalı. `yetkilerimi göster` yazarak sınırları gör.",
      };
    }

    const summary = await summarizeProjectStructure();

    return {
      success: summary.success,
      message: summary.success ? summary.data : summary.message,
    };
  }

  if (lower.startsWith("dosya oku:") || lower.startsWith("dosya oku :")) {
    if (!canReadProject()) {
      return {
        success: false,
        message:
          "Dosya okuma yetkisi kapalı. `yetkilerimi göster` yazarak sınırları gör.",
      };
    }

    const filePath = extractProjectFilePath(
      message,
      /^dosya\s+oku\s*:\s*(.+)$/i
    );

    if (!filePath) {
      return {
        success: false,
        message: "Kullanım: dosya oku: app/page.tsx",
      };
    }

    const readResult = await readProjectFile(filePath);

    if (!readResult.success) {
      return { success: false, message: readResult.message };
    }

    const { relativePath, content, truncated } = readResult.data;

    return {
      success: true,
      message: `Dosya: ${relativePath}\n\n\`\`\`\n${content}\n\`\`\`${truncated ? "\n\nNot: İçerik karakter limiti nedeniyle kısaltıldı." : ""}`,
    };
  }

  if (
    lower.startsWith("dosyayı analiz et:") ||
    lower.startsWith("dosyayi analiz et:") ||
    lower.startsWith("dosyayı analiz et :") ||
    lower.startsWith("dosyayi analiz et :")
  ) {
    if (!canReadProject()) {
      return {
        success: false,
        message:
          "Dosya analizi için proje okuma yetkisi gerekir. `yetkilerimi göster`",
      };
    }

    const filePath = extractProjectFilePath(
      message,
      /^dosyay[ıi]\s+analiz\s+et\s*:\s*(.+)$/i
    );

    if (!filePath) {
      return {
        success: false,
        message: "Kullanım: dosyayı analiz et: app/page.tsx",
      };
    }

    const readResult = await readProjectFile(filePath);

    if (!readResult.success) {
      return { success: false, message: readResult.message };
    }

    const openai = getOpenAIClient();

    if (!openai) {
      return {
        success: false,
        message:
          "OpenAI yapılandırması eksik. Dosya analizi için OPENAI_API_KEY gerekli.",
      };
    }

    const { relativePath, content, truncated } = readResult.data;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Sen Hermes Developer AI'sın. Verilen proje dosyasını kısa, net ve güvenli şekilde analiz et. Amaç, yapı, riskler ve önerilen sonraki adımları belirt.",
          },
          {
            role: "user",
            content: `Dosya: ${relativePath}${truncated ? " (kısaltılmış içerik)" : ""}\n\n\`\`\`\n${content}\n\`\`\``,
          },
        ],
      });

      return {
        success: true,
        message:
          completion.choices[0]?.message?.content ||
          "Dosya analizi tamamlandı ama cevap boş geldi.",
      };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Bilinmeyen model hatası";

      return {
        success: false,
        message: "Dosya analizi başarısız: " + detail,
      };
    }
  }

  if (
    lower.startsWith("değişiklik planı oluştur") ||
    lower.startsWith("degisiklik plani olustur")
  ) {
    if (!canPlanPatch()) {
      return {
        success: false,
        message:
          "Patch planlama yetkisi kapalı. `yetkilerimi göster` yazarak sınırları gör.",
      };
    }

    const request =
      extractPatchPlannerRequest(
        message,
        /^de[gğ]işiklik plan[ıi] oluştur\s*:\s*(.+)$/i
      ) ||
      extractPatchPlannerRequest(
        message,
        /^degisiklik plani olustur\s*:\s*(.+)$/i
      );

    if (!request) {
      return {
        success: false,
        message: "Kullanım: değişiklik planı oluştur: <istek>",
      };
    }

    const plan = await createPatchPlan(request);
    return { success: plan.success, message: plan.message };
  }

  if (
    lower.startsWith("bu özelliği nasıl ekleriz") ||
    lower.startsWith("bu ozelligi nasil ekleriz")
  ) {
    if (!canPlanPatch()) {
      return {
        success: false,
        message:
          "Özellik planlama yetkisi kapalı. `yetkilerimi göster` yazarak sınırları gör.",
      };
    }

    const request =
      extractPatchPlannerRequest(
        message,
        /^bu özelli[gğ]i nas[ıi]l ekleriz\s*:\s*(.+)$/i
      ) ||
      extractPatchPlannerRequest(
        message,
        /^bu ozelligi nasil ekleriz\s*:\s*(.+)$/i
      );

    if (!request) {
      return {
        success: false,
        message: "Kullanım: bu özelliği nasıl ekleriz: <özellik açıklaması>",
      };
    }

    const plan = await createPatchPlan(request);
    return { success: plan.success, message: plan.message };
  }

  if (
    lower.includes("hangi dosyalar değişmeli") ||
    lower.includes("hangi dosyalar degismeli")
  ) {
    if (!canPlanPatch()) {
      return {
        success: false,
        message:
          "Dosya kapsamı analizi için planlama yetkisi gerekir. `yetkilerimi göster`",
      };
    }

    const request =
      extractPatchPlannerRequest(
        message,
        /^hangi dosyalar de[gğ]işmeli\s*:\s*(.+)$/i
      ) ||
      extractPatchPlannerRequest(
        message,
        /^hangi dosyalar degismeli\s*:\s*(.+)$/i
      ) ||
      message
        .replace(/hangi dosyalar de[gğ]işmeli\s*:?\s*/i, "")
        .replace(/hangi dosyalar degismeli\s*:?\s*/i, "")
        .trim();

    const analysis = await analyzeTargetFiles(
      request || "Genel özellik/değişiklik analizi"
    );

    return { success: analysis.success, message: analysis.message };
  }

  if (shouldAutoRemember(message)) {
    void saveMemory(message, "auto").catch(() => {});
  }

  const persona = detectPersona(message, selectedPersona);
  const mode = detectMode(message, selectedMode);
  const agent = resolveAgentForMessage(message);

  const memoryContext = await getMemoryContext();

  const systemPrompt = buildSystemPrompt({
    memoryContext,
    persona,
    mode,
    agent,
  });

  const openai = getOpenAIClient();

  if (!openai) {
    return {
      success: false,
      message:
        "OpenAI yapılandırması eksik. Sohbet için OPENAI_API_KEY gerekli.",
    };
  }

  try {
    if (mode === "Research") {
      const result = await openai.responses.create({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: `${systemPrompt}

Kullanıcı sorusu:
${message}`,
      });

      return {
        success: true,
        message:
          result.output_text ||
          "Araştırma tamamlandı ama cevap boş geldi.",
      };
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
          content: message,
        },
      ],
    });

    return {
      success: true,
      message:
        completion.choices[0]?.message?.content || "Cevap boş geldi.",
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Bilinmeyen model hatası";

    return {
      success: false,
      message: "Hermes cevap üretemedi: " + detail,
    };
  }
}
