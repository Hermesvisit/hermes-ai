import {
  describeSupabaseError,
  formatHermesInsertFallbackMessage,
  getSupabaseClient,
  getSupabaseErrorMessage,
  logHermesSupabaseInsert,
} from "@/lib/supabase";

export const USER_ID = "kemal";

type LocalMemory = {
  content: string;
  category: string;
  created_at: string;
};

const localMemories: LocalMemory[] = [];

function rememberLocally(content: string, category: string) {
  localMemories.unshift({
    content,
    category,
    created_at: new Date().toISOString(),
  });

  if (localMemories.length > 50) {
    localMemories.length = 50;
  }
}

function formatLocalMemories(limit = 20) {
  return localMemories
    .slice(0, limit)
    .map((item, index) => `${index + 1}. ${item.content}`)
    .join("\n");
}

function getLocalMemoryContext(limit = 10) {
  if (localMemories.length === 0) {
    return "";
  }

  return localMemories
    .slice(0, limit)
    .map((m) => `- ${m.content}`)
    .join("\n");
}

export async function saveMemory(content: string, category = "manual") {
  const text = content.trim();

  if (!text) {
    return {
      success: false,
      message: "Neyi hatırlamamı istediğini yazmalısın.",
    };
  }

  const client = getSupabaseClient();

  if (!client) {
    rememberLocally(text, category);
    return {
      success: true,
      message: "Tamam, bunu hatırlayacağım.",
    };
  }

  try {
    const { error } = await client.from("memory").insert([
      {
        user_id: USER_ID,
        content: text,
        category,
      },
    ]);

    if (error) {
      logHermesSupabaseInsert("memory", "saveMemory", error);
      rememberLocally(text, category);
      return {
        success: true,
        message: formatHermesInsertFallbackMessage(
          "Tamam, bunu hatırlayacağım.",
          describeSupabaseError(error)
        ),
      };
    }

    return {
      success: true,
      message: "Tamam, bunu hatırlayacağım.",
    };
  } catch (error) {
    logHermesSupabaseInsert("memory", "saveMemory", error);
    rememberLocally(text, category);
    return {
      success: true,
      message: formatHermesInsertFallbackMessage(
        "Tamam, bunu hatırlayacağım.",
        describeSupabaseError(error)
      ),
    };
  }
}

export async function listMemories(limit = 20) {
  const client = getSupabaseClient();
  let remoteLines = "";

  if (client) {
    try {
      const { data, error } = await client
        .from("memory")
        .select("*")
        .eq("user_id", USER_ID)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          success: false,
          message: "Hafızayı okurken hata oldu: " + error.message,
          memories: [],
        };
      }

      if (data && data.length > 0) {
        remoteLines = data
          .map((item: { content: string }, index: number) => `${index + 1}. ${item.content}`)
          .join("\n");

        return {
          success: true,
          message: `Hatırladıklarım:\n${remoteLines}`,
          memories: data,
        };
      }
    } catch (error) {
      const localLines = formatLocalMemories(limit);

      if (localLines) {
        return {
          success: true,
          message: `Hatırladıklarım (yerel):\n${localLines}`,
          memories: [],
        };
      }

      return {
        success: false,
        message: "Hafızayı okurken bağlantı hatası: " + getSupabaseErrorMessage(error),
        memories: [],
      };
    }
  }

  const localLines = formatLocalMemories(limit);

  if (!localLines) {
    return {
      success: true,
      message: "Şu an kayıtlı bir hafızam yok.",
      memories: [],
    };
  }

  return {
    success: true,
    message: `Hatırladıklarım (yerel):\n${localLines}`,
    memories: [],
  };
}

export async function getMemoryContext(limit = 10) {
  const parts: string[] = [];
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from("memory")
        .select("*")
        .eq("user_id", USER_ID)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        parts.push(
          ...data.map((m: { content: string }) => `- ${m.content}`)
        );
      }
    } catch {
      // Supabase erişilemezse yerel hafızayla devam et
    }
  }

  const localContext = getLocalMemoryContext(limit);

  if (localContext) {
    parts.push(localContext);
  }

  if (parts.length === 0) {
    return "Kayıtlı hafıza yok.";
  }

  return parts.join("\n");
}

export function shouldAutoRemember(message: string) {
  const lower = message.toLowerCase();

  const shouldRemember =
    lower.includes("ben ") ||
    lower.includes("benim ") ||
    lower.includes("annem ") ||
    lower.includes("babam ") ||
    lower.includes("kardeşim ") ||
    lower.includes("kardesim ") ||
    lower.includes("tercihim ") ||
    lower.includes("bundan sonra ") ||
    lower.includes("seviyorum") ||
    lower.includes("sevmiyorum");

  const sensitive =
    lower.includes("şifre") ||
    lower.includes("sifre") ||
    lower.includes("parola") ||
    lower.includes("kart") ||
    lower.includes("banka") ||
    lower.includes("tc kimlik");

  return shouldRemember && !sensitive;
}
