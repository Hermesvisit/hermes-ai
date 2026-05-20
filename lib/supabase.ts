import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let cachedClient: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (cachedClient === undefined) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient;
}

export function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Supabase bağlantı hatası.";
}

export function isDeveloperMode(): boolean {
  return process.env.NODE_ENV === "development";
}

export function describeSupabaseError(error: unknown): string {
  if (error && typeof error === "object") {
    const row = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };

    const parts = [
      row.message,
      row.code ? `code=${row.code}` : null,
      row.details ? `details=${row.details}` : null,
      row.hint ? `hint=${row.hint}` : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return getSupabaseErrorMessage(error);
}

export function logHermesSupabaseInsert(
  table: string,
  operation: string,
  error: unknown
) {
  console.error(
    `[hermes][supabase] ${operation} insert on "${table}" failed`,
    {
      detail: describeSupabaseError(error),
      error,
    }
  );
}

export function formatHermesInsertFallbackMessage(
  userMessage: string,
  errorDetail: string
): string {
  if (!isDeveloperMode()) {
    return `${userMessage} (veritabanına yazılamadı, yerel kayıt kullanıldı.)`;
  }

  return `${userMessage} (yerel kayıt kullanıldı.)\n\n[Developer] Supabase insert: ${errorDetail}`;
}

/** Geriye dönük importlar için; kullanmadan önce null kontrolü yapın. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        "Supabase kullanılamıyor. Bağlantı yok veya ortam değişkenleri eksik."
      );
    }
    return Reflect.get(client, prop);
  },
});
