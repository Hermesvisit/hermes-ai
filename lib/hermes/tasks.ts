import {
  describeSupabaseError,
  formatHermesInsertFallbackMessage,
  getSupabaseClient,
  getSupabaseErrorMessage,
  logHermesSupabaseInsert,
} from "@/lib/supabase";
import { USER_ID } from "@/lib/hermes/memory";

type LocalTask = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

const localTasks: LocalTask[] = [];

function rememberLocalTask(title: string) {
  localTasks.unshift({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    status: "pending",
    created_at: new Date().toISOString(),
  });

  if (localTasks.length > 100) {
    localTasks.length = 100;
  }
}

function formatTaskList(tasks: { title: string; status: string }[]) {
  return tasks
    .map((task, index) => `${index + 1}. ${task.title} (${task.status})`)
    .join("\n");
}

export async function addTask(title: string) {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    return {
      success: false,
      message: "Eklemem için görev başlığını yazmalısın.",
    };
  }

  const client = getSupabaseClient();

  if (!client) {
    rememberLocalTask(cleanTitle);
    return {
      success: true,
      message: "Görev eklendi.",
    };
  }

  try {
    const { error } = await client.from("tasks").insert([
      {
        user_id: USER_ID,
        title: cleanTitle,
        description: "",
        status: "pending",
      },
    ]);

    if (error) {
      logHermesSupabaseInsert("tasks", "addTask", error);
      rememberLocalTask(cleanTitle);
      return {
        success: true,
        message: formatHermesInsertFallbackMessage(
          "Görev eklendi.",
          describeSupabaseError(error)
        ),
      };
    }

    return {
      success: true,
      message: "Görev eklendi.",
    };
  } catch (error) {
    logHermesSupabaseInsert("tasks", "addTask", error);
    rememberLocalTask(cleanTitle);
    return {
      success: true,
      message: formatHermesInsertFallbackMessage(
        "Görev eklendi.",
        describeSupabaseError(error)
      ),
    };
  }
}

export async function listTasks() {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from("tasks")
        .select("*")
        .eq("user_id", USER_ID)
        .order("created_at", { ascending: false });

      if (error) {
        return {
          success: false,
          message: "Görevler okunurken hata oldu: " + error.message,
        };
      }

      if (data && data.length > 0) {
        return {
          success: true,
          message: `Görevlerin:\n\n${formatTaskList(data)}`,
        };
      }
    } catch (error) {
      if (localTasks.length > 0) {
        return {
          success: true,
          message: `Görevlerin (yerel):\n\n${formatTaskList(localTasks)}`,
        };
      }

      return {
        success: false,
        message:
          "Görevler okunurken bağlantı hatası: " +
          getSupabaseErrorMessage(error),
      };
    }
  }

  if (localTasks.length === 0) {
    return {
      success: true,
      message: "Şu anda kayıtlı görevin yok.",
    };
  }

  return {
    success: true,
    message: `Görevlerin (yerel):\n\n${formatTaskList(localTasks)}`,
  };
}

export async function completeTask(taskNumber: number) {
  const safeNumber =
    Number.isFinite(taskNumber) && taskNumber > 0 ? taskNumber : 1;

  const client = getSupabaseClient();

  if (!client) {
    const activeTasks = localTasks.filter((t) => t.status !== "done");
    const selectedTask = activeTasks[safeNumber - 1];

    if (!selectedTask) {
      return {
        success: false,
        message: `${safeNumber}. sırada aktif görev bulamadım.`,
      };
    }

    selectedTask.status = "done";

    return {
      success: true,
      message: `Tamamlandı: ${selectedTask.title}`,
    };
  }

  try {
    const { data, error } = await client
      .from("tasks")
      .select("*")
      .eq("user_id", USER_ID)
      .neq("status", "done")
      .order("created_at", { ascending: false });

    if (error) {
      return {
        success: false,
        message: "Görevler okunurken hata oldu: " + error.message,
      };
    }

    if (!data || data.length === 0) {
      const activeLocal = localTasks.filter((t) => t.status !== "done");

      if (activeLocal.length === 0) {
        return {
          success: true,
          message: "Tamamlanacak aktif görevin yok.",
        };
      }

      const selectedLocal = activeLocal[safeNumber - 1];

      if (!selectedLocal) {
        return {
          success: false,
          message: `${safeNumber}. sırada aktif görev bulamadım.`,
        };
      }

      selectedLocal.status = "done";

      return {
        success: true,
        message: `Tamamlandı: ${selectedLocal.title}`,
      };
    }

    const selectedTask = data[safeNumber - 1];

    if (!selectedTask) {
      return {
        success: false,
        message: `${safeNumber}. sırada aktif görev bulamadım.`,
      };
    }

    const { error: updateError } = await client
      .from("tasks")
      .update({ status: "done" })
      .eq("id", selectedTask.id);

    if (updateError) {
      return {
        success: false,
        message: "Görev tamamlanırken hata oldu: " + updateError.message,
      };
    }

    return {
      success: true,
      message: `Tamamlandı: ${selectedTask.title}`,
    };
  } catch (error) {
    const activeLocal = localTasks.filter((t) => t.status !== "done");
    const selectedLocal = activeLocal[safeNumber - 1];

    if (!selectedLocal) {
      return {
        success: false,
        message:
          "Görev tamamlanırken bağlantı hatası: " +
          getSupabaseErrorMessage(error),
      };
    }

    selectedLocal.status = "done";

    return {
      success: true,
      message: `Tamamlandı: ${selectedLocal.title}`,
    };
  }
}
