import { getBusinessInstance } from "@/lib/hermes/business-instances";
import { USER_ID } from "@/lib/hermes/memory";
import {
  describeSupabaseError,
  formatHermesInsertFallbackMessage,
  getSupabaseClient,
  logHermesSupabaseInsert,
} from "@/lib/supabase";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "booked"
  | "lost";

export type LeadPriority = "low" | "medium" | "high";

export type CustomerRecord = {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  source: string;
  notes: string;
  createdAt: string;
};

export type LeadRecord = {
  id: string;
  businessId: string;
  customerId: string;
  interest: string;
  status: LeadStatus;
  priority: LeadPriority;
  lastMessage: string;
  followUpNeeded: boolean;
  createdAt: string;
};

export type ConversationMessage = {
  role: "customer" | "assistant" | "system";
  content: string;
  at: string;
};

export type ConversationRecord = {
  id: string;
  businessId: string;
  customerId: string;
  channel: string;
  messages: ConversationMessage[];
  summary: string;
  intent: string;
  createdAt: string;
};

export type LeadMemoryResult =
  | { success: true; message: string }
  | { success: false; message: string };

const LEAD_BOUNDARY = `LEAD & KONUŞMA HAFIZASI (iç kullanım):
Veriler işletme örneği (businessId) bazında izole tutulur. Müşteriler Hermes Core veya başka işletme kayıtlarına erişemez.`;

const customers: CustomerRecord[] = [];
const leads: LeadRecord[] = [];
const conversations: ConversationRecord[] = [];

let hydrationPromise: Promise<void> | null = null;

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();

  for (const item of base) {
    map.set(item.id, item);
  }

  for (const item of incoming) {
    map.set(item.id, item);
  }

  return [...map.values()];
}

function rememberCustomerLocally(customer: CustomerRecord) {
  const index = customers.findIndex((item) => item.id === customer.id);

  if (index >= 0) {
    customers[index] = customer;
    return;
  }

  customers.push(customer);
}

function rememberLeadLocally(lead: LeadRecord) {
  const index = leads.findIndex((item) => item.id === lead.id);

  if (index >= 0) {
    leads[index] = lead;
    return;
  }

  leads.push(lead);
}

function rememberConversationLocally(conversation: ConversationRecord) {
  const index = conversations.findIndex((item) => item.id === conversation.id);

  if (index >= 0) {
    conversations[index] = conversation;
    return;
  }

  conversations.push(conversation);
}

function parseMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      role: (item.role === "assistant" || item.role === "system"
        ? item.role
        : "customer") as ConversationMessage["role"],
      content: String(item.content ?? ""),
      at: String(item.at ?? new Date().toISOString()),
    }));
}

function mapCustomerRow(row: Record<string, unknown>): CustomerRecord {
  return {
    id: String(row.id ?? createId("cust")),
    businessId: String(row.business_id ?? row.businessId ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    source: String(row.source ?? "manual"),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function mapLeadRow(row: Record<string, unknown>): LeadRecord {
  const status = String(row.status ?? "new");

  return {
    id: String(row.id ?? createId("lead")),
    businessId: String(row.business_id ?? row.businessId ?? ""),
    customerId: String(row.customer_id ?? row.customerId ?? ""),
    interest: String(row.interest ?? ""),
    status: (
      ["new", "contacted", "qualified", "booked", "lost"].includes(status)
        ? status
        : "new"
    ) as LeadStatus,
    priority: (
      row.priority === "low" || row.priority === "high" ? row.priority : "medium"
    ) as LeadPriority,
    lastMessage: String(row.last_message ?? row.lastMessage ?? ""),
    followUpNeeded: Boolean(row.follow_up_needed ?? row.followUpNeeded ?? true),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function mapConversationRow(row: Record<string, unknown>): ConversationRecord {
  return {
    id: String(row.id ?? createId("conv")),
    businessId: String(row.business_id ?? row.businessId ?? ""),
    customerId: String(row.customer_id ?? row.customerId ?? ""),
    channel: String(row.channel ?? "manual"),
    messages: parseMessages(row.messages),
    summary: String(row.summary ?? ""),
    intent: String(row.intent ?? "genel_iletisim"),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function seedLeadMemory() {
  if (customers.length > 0) {
    return;
  }

  const novaId = "biz-klinik-nova";
  const whiteId = "biz-whitesmile";

  const novaCust1: CustomerRecord = {
    id: "cust-nova-ahmet",
    businessId: novaId,
    name: "Ahmet Yılmaz",
    phone: "+90 532 000 11 22",
    source: "WhatsApp",
    notes: "İmplant fiyatı sordu",
    createdAt: "2025-03-01T09:00:00.000Z",
  };

  const novaCust2: CustomerRecord = {
    id: "cust-nova-elif",
    businessId: novaId,
    name: "Elif Kaya",
    phone: "+90 533 000 33 44",
    source: "Web formu",
    notes: "Diş taşı temizliği",
    createdAt: "2025-03-02T11:00:00.000Z",
  };

  const whiteCust1: CustomerRecord = {
    id: "cust-white-selin",
    businessId: whiteId,
    name: "Selin Demir",
    phone: "+90 534 000 55 66",
    source: "Instagram DM",
    notes: "Beyazlatma kampanyası",
    createdAt: "2025-03-03T14:00:00.000Z",
  };

  rememberCustomerLocally(novaCust1);
  rememberCustomerLocally(novaCust2);
  rememberCustomerLocally(whiteCust1);

  rememberLeadLocally({
    id: "lead-nova-ahmet-implant",
    businessId: novaId,
    customerId: novaCust1.id,
    interest: "İmplant fiyatı ve randevu",
    status: "contacted",
    priority: "high",
    lastMessage: "İmplant fiyatı nedir, bu hafta müsait misiniz?",
    followUpNeeded: true,
    createdAt: "2025-03-01T09:15:00.000Z",
  });

  rememberLeadLocally({
    id: "lead-nova-elif-cleaning",
    businessId: novaId,
    customerId: novaCust2.id,
    interest: "Diş taşı temizliği randevusu",
    status: "new",
    priority: "medium",
    lastMessage: "Cumartesi öğleden sonra uygun mu?",
    followUpNeeded: true,
    createdAt: "2025-03-02T11:30:00.000Z",
  });

  rememberLeadLocally({
    id: "lead-white-selin-whiten",
    businessId: whiteId,
    customerId: whiteCust1.id,
    interest: "Diş beyazlatma kampanyası",
    status: "qualified",
    priority: "medium",
    lastMessage: "Kampanya fiyatını öğrenmek istiyorum",
    followUpNeeded: false,
    createdAt: "2025-03-03T14:20:00.000Z",
  });

  rememberConversationLocally({
    id: "conv-nova-ahmet-1",
    businessId: novaId,
    customerId: novaCust1.id,
    channel: "WhatsApp",
    messages: [
      {
        role: "customer",
        content: "Merhaba, implant fiyatı nedir?",
        at: "2025-03-01T09:10:00.000Z",
      },
      {
        role: "assistant",
        content:
          "Merhaba, ön görüşme randevusu ile başlıyoruz. Uygun gününüzü paylaşır mısınız?",
        at: "2025-03-01T09:12:00.000Z",
      },
    ],
    summary: "İmplant fiyatı sordu, randevu istedi",
    intent: "randevu_talebi",
    createdAt: "2025-03-01T09:15:00.000Z",
  });
}

async function loadFromSupabase(): Promise<void> {
  const client = getSupabaseClient();

  if (!client) {
    return;
  }

  try {
    const [customerRes, leadRes, conversationRes] = await Promise.all([
      client.from("customers").select("*").eq("user_id", USER_ID),
      client.from("leads").select("*").eq("user_id", USER_ID),
      client.from("conversations").select("*").eq("user_id", USER_ID),
    ]);

    if (customerRes.error) {
      logHermesSupabaseInsert("customers", "loadFromSupabase", customerRes.error);
    } else if (customerRes.data) {
      const remote = customerRes.data.map((row) =>
        mapCustomerRow(row as Record<string, unknown>)
      );
      const merged = mergeById(customers, remote);
      customers.length = 0;
      customers.push(...merged);
    }

    if (leadRes.error) {
      logHermesSupabaseInsert("leads", "loadFromSupabase", leadRes.error);
    } else if (leadRes.data) {
      const remote = leadRes.data.map((row) =>
        mapLeadRow(row as Record<string, unknown>)
      );
      const merged = mergeById(leads, remote);
      leads.length = 0;
      leads.push(...merged);
    }

    if (conversationRes.error) {
      logHermesSupabaseInsert(
        "conversations",
        "loadFromSupabase",
        conversationRes.error
      );
    } else if (conversationRes.data) {
      const remote = conversationRes.data.map((row) =>
        mapConversationRow(row as Record<string, unknown>)
      );
      const merged = mergeById(conversations, remote);
      conversations.length = 0;
      conversations.push(...merged);
    }
  } catch (error) {
    console.error("[hermes][leads] loadFromSupabase failed", {
      detail: describeSupabaseError(error),
    });
  }
}

export async function ensureLeadDataLoaded(): Promise<void> {
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      seedLeadMemory();
      await loadFromSupabase();
    })();
  }

  await hydrationPromise;
}

async function persistCustomer(
  customer: CustomerRecord
): Promise<{ ok: boolean; detail?: string }> {
  rememberCustomerLocally(customer);

  const client = getSupabaseClient();

  if (!client) {
    return { ok: false, detail: "Supabase yapılandırılmamış" };
  }

  try {
    const { error } = await client.from("customers").upsert({
      id: customer.id,
      user_id: USER_ID,
      business_id: customer.businessId,
      name: customer.name,
      phone: customer.phone,
      source: customer.source,
      notes: customer.notes,
      created_at: customer.createdAt,
    });

    if (error) {
      logHermesSupabaseInsert("customers", "persistCustomer", error);
      return { ok: false, detail: describeSupabaseError(error) };
    }

    return { ok: true };
  } catch (error) {
    console.error("[hermes][leads] persistCustomer failed", {
      detail: describeSupabaseError(error),
    });
    return { ok: false, detail: describeSupabaseError(error) };
  }
}

async function persistLead(
  lead: LeadRecord
): Promise<{ ok: boolean; detail?: string }> {
  rememberLeadLocally(lead);

  const client = getSupabaseClient();

  if (!client) {
    return { ok: false, detail: "Supabase yapılandırılmamış" };
  }

  try {
    const { error } = await client.from("leads").upsert({
      id: lead.id,
      user_id: USER_ID,
      business_id: lead.businessId,
      customer_id: lead.customerId,
      interest: lead.interest,
      status: lead.status,
      priority: lead.priority,
      last_message: lead.lastMessage,
      follow_up_needed: lead.followUpNeeded,
      created_at: lead.createdAt,
    });

    if (error) {
      logHermesSupabaseInsert("leads", "persistLead", error);
      return { ok: false, detail: describeSupabaseError(error) };
    }

    return { ok: true };
  } catch (error) {
    console.error("[hermes][leads] persistLead failed", {
      detail: describeSupabaseError(error),
    });
    return { ok: false, detail: describeSupabaseError(error) };
  }
}

async function persistConversation(
  conversation: ConversationRecord
): Promise<{ ok: boolean; detail?: string }> {
  rememberConversationLocally(conversation);

  const client = getSupabaseClient();

  if (!client) {
    return { ok: false, detail: "Supabase yapılandırılmamış" };
  }

  try {
    const { error } = await client.from("conversations").upsert({
      id: conversation.id,
      user_id: USER_ID,
      business_id: conversation.businessId,
      customer_id: conversation.customerId,
      channel: conversation.channel,
      messages: conversation.messages,
      summary: conversation.summary,
      intent: conversation.intent,
      created_at: conversation.createdAt,
    });

    if (error) {
      logHermesSupabaseInsert("conversations", "persistConversation", error);
      return { ok: false, detail: describeSupabaseError(error) };
    }

    return { ok: true };
  } catch (error) {
    console.error("[hermes][leads] persistConversation failed", {
      detail: describeSupabaseError(error),
    });
    return { ok: false, detail: describeSupabaseError(error) };
  }
}

function resolveBusinessId(businessIdOrName: string): string | null {
  const trimmed = businessIdOrName.trim();

  if (!trimmed) {
    return null;
  }

  const byId = getBusinessInstance(trimmed);

  return byId?.id ?? null;
}

function assertBusiness(businessIdOrName: string): string | LeadMemoryResult {
  const businessId = resolveBusinessId(businessIdOrName);

  if (!businessId) {
    return {
      success: false,
      message: `İşletme bulunamadı: ${businessIdOrName}`,
    };
  }

  return businessId;
}

function filterByBusiness<T extends { businessId: string }>(
  items: T[],
  businessId: string
): T[] {
  return items.filter((item) => item.businessId === businessId);
}

export async function createCustomer(input: {
  businessId: string;
  name: string;
  phone?: string;
  source?: string;
  notes?: string;
}): Promise<LeadMemoryResult> {
  await ensureLeadDataLoaded();

  const businessCheck = assertBusiness(input.businessId);

  if (typeof businessCheck !== "string") {
    return businessCheck;
  }

  const name = input.name.trim();

  if (!name) {
    return { success: false, message: "Müşteri adı gerekli." };
  }

  const existing = customers.find(
    (item) =>
      item.businessId === businessCheck &&
      item.name.toLowerCase() === name.toLowerCase() &&
      (input.phone?.trim() ? item.phone === input.phone.trim() : true)
  );

  if (existing) {
    return {
      success: true,
      message: `Mevcut müşteri kullanıldı: **${existing.name}** (\`${existing.id}\`).`,
    };
  }

  const customer: CustomerRecord = {
    id: createId("cust"),
    businessId: businessCheck,
    name,
    phone: input.phone?.trim() ?? "",
    source: input.source?.trim() || "manual",
    notes: input.notes?.trim() ?? "",
    createdAt: new Date().toISOString(),
  };

  const persisted = await persistCustomer(customer);

  const baseMessage = `Müşteri kaydedildi: **${customer.name}** (\`${customer.id}\`).`;

  if (!persisted.ok && persisted.detail) {
    return {
      success: true,
      message: formatHermesInsertFallbackMessage(baseMessage, persisted.detail),
    };
  }

  return { success: true, message: baseMessage };
}

export async function createLead(input: {
  businessId: string;
  customerId: string;
  interest: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  lastMessage?: string;
  followUpNeeded?: boolean;
}): Promise<LeadMemoryResult> {
  await ensureLeadDataLoaded();

  const businessCheck = assertBusiness(input.businessId);

  if (typeof businessCheck !== "string") {
    return businessCheck;
  }

  const customer = customers.find(
    (item) => item.id === input.customerId && item.businessId === businessCheck
  );

  if (!customer) {
    return {
      success: false,
      message: "Bu işletmeye ait müşteri bulunamadı.",
    };
  }

  const interest = input.interest.trim();

  if (!interest) {
    return { success: false, message: "Lead ilgi alanı gerekli." };
  }

  const lead: LeadRecord = {
    id: createId("lead"),
    businessId: businessCheck,
    customerId: customer.id,
    interest,
    status: input.status ?? "new",
    priority: input.priority ?? "medium",
    lastMessage: input.lastMessage?.trim() ?? interest,
    followUpNeeded: input.followUpNeeded ?? true,
    createdAt: new Date().toISOString(),
  };

  const persisted = await persistLead(lead);
  const baseMessage = `Lead kaydedildi: **${customer.name}** — ${interest} (\`${lead.id}\`).`;

  if (!persisted.ok && persisted.detail) {
    return {
      success: true,
      message: formatHermesInsertFallbackMessage(baseMessage, persisted.detail),
    };
  }

  return { success: true, message: baseMessage };
}

export async function createConversation(input: {
  businessId: string;
  customerId: string;
  channel: string;
  messages: ConversationMessage[];
  summary?: string;
  intent?: string;
}): Promise<LeadMemoryResult> {
  await ensureLeadDataLoaded();

  const businessCheck = assertBusiness(input.businessId);

  if (typeof businessCheck !== "string") {
    return businessCheck;
  }

  const customer = customers.find(
    (item) => item.id === input.customerId && item.businessId === businessCheck
  );

  if (!customer) {
    return {
      success: false,
      message: "Bu işletmeye ait müşteri bulunamadı.",
    };
  }

  if (input.messages.length === 0) {
    return { success: false, message: "En az bir mesaj gerekli." };
  }

  const lastCustomerMessage = [...input.messages]
    .reverse()
    .find((msg) => msg.role === "customer");

  const summary =
    input.summary?.trim() ||
    lastCustomerMessage?.content.slice(0, 200) ||
    "Konuşma özeti yok.";

  const intent = input.intent?.trim() || inferIntent(summary);

  const conversation: ConversationRecord = {
    id: createId("conv"),
    businessId: businessCheck,
    customerId: customer.id,
    channel: input.channel.trim() || "manual",
    messages: input.messages,
    summary,
    intent,
    createdAt: new Date().toISOString(),
  };

  const persisted = await persistConversation(conversation);
  const extraction = await extractLeadFromConversation(conversation.id);

  let message = `Konuşma kaydedildi (\`${conversation.id}\`, ${customer.name}).\n\n${extraction.message}`;

  if (!persisted.ok && persisted.detail) {
    message = formatHermesInsertFallbackMessage(message, persisted.detail);
  }

  return { success: true, message };
}

export async function listCustomers(
  businessIdOrName?: string
): Promise<CustomerRecord[]> {
  await ensureLeadDataLoaded();

  if (!businessIdOrName) {
    return [...customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const businessId = resolveBusinessId(businessIdOrName);

  if (!businessId) {
    return [];
  }

  return filterByBusiness(customers, businessId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function listLeads(businessIdOrName?: string): Promise<LeadRecord[]> {
  await ensureLeadDataLoaded();

  if (!businessIdOrName) {
    return [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const businessId = resolveBusinessId(businessIdOrName);

  if (!businessId) {
    return [];
  }

  return filterByBusiness(leads, businessId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function listConversations(
  businessIdOrName?: string
): Promise<ConversationRecord[]> {
  await ensureLeadDataLoaded();

  if (!businessIdOrName) {
    return [...conversations].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  const businessId = resolveBusinessId(businessIdOrName);

  if (!businessId) {
    return [];
  }

  return filterByBusiness(conversations, businessId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

function getCustomerName(customerId: string, businessId: string): string {
  return (
    customers.find(
      (item) => item.id === customerId && item.businessId === businessId
    )?.name ?? "Bilinmeyen"
  );
}

function getBusinessLabel(businessId: string): string {
  return getBusinessInstance(businessId)?.businessName ?? businessId;
}

export async function summarizeBusinessLeads(
  businessIdOrName: string
): Promise<LeadMemoryResult> {
  const businessCheck = assertBusiness(businessIdOrName);

  if (typeof businessCheck !== "string") {
    return businessCheck;
  }

  const businessLeads = await listLeads(businessCheck);
  const label = getBusinessLabel(businessCheck);

  if (businessLeads.length === 0) {
    return {
      success: true,
      message: `## Lead Özeti — ${label}\n\nKayıtlı lead yok.`,
    };
  }

  const followUp = businessLeads.filter((item) => item.followUpNeeded);
  const byStatus = new Map<LeadStatus, number>();

  for (const lead of businessLeads) {
    byStatus.set(lead.status, (byStatus.get(lead.status) ?? 0) + 1);
  }

  const statusLines = [...byStatus.entries()]
    .map(([status, count]) => `- ${status}: ${count}`)
    .join("\n");

  const lines = businessLeads.map((lead, index) => {
    const name = getCustomerName(lead.customerId, businessCheck);

    return `${index + 1}. **${name}** — ${lead.interest}
   Durum: ${lead.status} | Öncelik: ${lead.priority} | Takip: ${lead.followUpNeeded ? "evet" : "hayır"}
   Son mesaj: ${lead.lastMessage.slice(0, 120)}`;
  });

  return {
    success: true,
    message: `## Lead Özeti — ${label}

${LEAD_BOUNDARY}

**Toplam lead:** ${businessLeads.length}
**Takip gerekli:** ${followUp.length}

**Durumlara göre:**
${statusLines}

**Lead listesi:**
${lines.join("\n\n")}`,
  };
}

export async function summarizeBusinessConversations(
  businessIdOrName: string
): Promise<LeadMemoryResult> {
  const businessCheck = assertBusiness(businessIdOrName);

  if (typeof businessCheck !== "string") {
    return businessCheck;
  }

  const businessConversations = await listConversations(businessCheck);
  const label = getBusinessLabel(businessCheck);

  if (businessConversations.length === 0) {
    return {
      success: true,
      message: `## Konuşmalar — ${label}\n\nKayıtlı konuşma yok.`,
    };
  }

  const lines = businessConversations.map((conv, index) => {
    const name = getCustomerName(conv.customerId, businessCheck);

    return `${index + 1}. **${name}** (${conv.channel}) — ${conv.intent}
   Özet: ${conv.summary.slice(0, 160)}...
   Tarih: ${conv.createdAt.slice(0, 16).replace("T", " ")}`;
  });

  return {
    success: true,
    message: `## Konuşmalar — ${label}

${LEAD_BOUNDARY}

${lines.join("\n\n")}`,
  };
}

function inferIntent(text: string): string {
  const lower = text.toLowerCase();

  if (/randevu|appointment|müsait|musait/i.test(lower)) {
    return "randevu_talebi";
  }

  if (/fiyat|ücret|ucret|kaç para|cost/i.test(lower)) {
    return "fiyat_sorgusu";
  }

  if (/bilgi|detay|nasıl|nasil/i.test(lower)) {
    return "bilgi_talebi";
  }

  if (/şikayet|sikayet|sorun/i.test(lower)) {
    return "şikayet";
  }

  return "genel_iletisim";
}

function inferPriority(text: string): LeadPriority {
  const lower = text.toLowerCase();

  if (/acil|hemen|bugün|bugun|yarın|yarin/i.test(lower)) {
    return "high";
  }

  if (/fiyat|randevu|implant|satın|satin/i.test(lower)) {
    return "medium";
  }

  return "low";
}

export async function extractLeadFromConversation(
  conversationId: string
): Promise<LeadMemoryResult> {
  await ensureLeadDataLoaded();

  const conversation = conversations.find((item) => item.id === conversationId);

  if (!conversation) {
    return {
      success: false,
      message: "Konuşma bulunamadı.",
    };
  }

  const customer = customers.find(
    (item) =>
      item.id === conversation.customerId &&
      item.businessId === conversation.businessId
  );

  if (!customer) {
    return {
      success: false,
      message: "Konuşmaya bağlı müşteri bulunamadı.",
    };
  }

  const customerText = conversation.messages
    .filter((msg) => msg.role === "customer")
    .map((msg) => msg.content)
    .join(" ");

  const interest = conversation.summary || customerText.slice(0, 200);
  const priority = inferPriority(customerText || interest);
  const followUpNeeded =
    /randevu|fiyat|geri dön|geri don|takip|arama/i.test(
      (customerText + interest).toLowerCase()
    ) || conversation.intent !== "genel_iletisim";

  const existingLead = leads.find(
    (item) =>
      item.businessId === conversation.businessId &&
      item.customerId === customer.id &&
      item.interest.toLowerCase() === interest.toLowerCase()
  );

  if (existingLead) {
    existingLead.lastMessage = customerText.slice(0, 300) || interest;
    existingLead.followUpNeeded = followUpNeeded;
    existingLead.priority = priority;

    const persisted = await persistLead(existingLead);

    let message = `Mevcut lead güncellendi: **${customer.name}** (\`${existingLead.id}\`).`;

    if (!persisted.ok && persisted.detail) {
      message = formatHermesInsertFallbackMessage(message, persisted.detail);
    }

    return { success: true, message };
  }

  const lead: LeadRecord = {
    id: createId("lead"),
    businessId: conversation.businessId,
    customerId: customer.id,
    interest,
    status: "new",
    priority,
    lastMessage: customerText.slice(0, 300) || interest,
    followUpNeeded,
    createdAt: new Date().toISOString(),
  };

  const persisted = await persistLead(lead);
  let message = `Konuşmadan lead çıkarıldı: **${customer.name}** — ${interest} (\`${lead.id}\`).`;

  if (!persisted.ok && persisted.detail) {
    message = formatHermesInsertFallbackMessage(message, persisted.detail);
  }

  return { success: true, message };
}

async function summarizeAllLeads(): Promise<string> {
  const allLeads = await listLeads();

  if (allLeads.length === 0) {
    return `## Tüm Leadler\n\n${LEAD_BOUNDARY}\n\nKayıtlı lead yok.`;
  }

  const lines = allLeads.map((lead, index) => {
    const business = getBusinessLabel(lead.businessId);
    const name = getCustomerName(lead.customerId, lead.businessId);

    return `${index + 1}. **${business}** — ${name}: ${lead.interest} (${lead.status})`;
  });

  return `## Tüm Leadler

${LEAD_BOUNDARY}

${lines.join("\n")}`;
}

async function summarizeAllCustomers(): Promise<string> {
  const allCustomers = await listCustomers();

  if (allCustomers.length === 0) {
    return `## Müşteri Kayıtları\n\nKayıt yok.`;
  }

  const lines = allCustomers.map((customer, index) => {
    const business = getBusinessLabel(customer.businessId);

    return `${index + 1}. **${customer.name}** — ${business} (${customer.source}) ${customer.phone || ""}`;
  });

  return `## Müşteri Kayıtları

${LEAD_BOUNDARY}

${lines.join("\n")}`;
}

async function saveConversationFromCommand(
  payload: string
): Promise<LeadMemoryResult> {
  const parts = payload.split("|").map((part) => part.trim());

  if (parts.length < 3) {
    return {
      success: false,
      message:
        "Kullanım: konuşma kaydet: Klinik Nova | Ahmet | implant fiyatı sordu, randevu istedi",
    };
  }

  const [businessName, customerName, ...messageParts] = parts;
  const messageText = messageParts.join("|").trim();

  const businessCheck = assertBusiness(businessName);

  if (typeof businessCheck !== "string") {
    return businessCheck;
  }

  await createCustomer({
    businessId: businessCheck,
    name: customerName,
    source: "konuşma_kaydı",
  });

  const customerList = await listCustomers(businessCheck);
  const customer = customerList.find(
    (item) => item.name.toLowerCase() === customerName.toLowerCase()
  );

  if (!customer) {
    return { success: false, message: "Müşteri oluşturulamadı." };
  }

  const now = new Date().toISOString();

  return createConversation({
    businessId: businessCheck,
    customerId: customer.id,
    channel: "manual",
    messages: [
      {
        role: "customer",
        content: messageText,
        at: now,
      },
    ],
    summary: messageText.slice(0, 200),
    intent: inferIntent(messageText),
  });
}

export async function handleLeadRouterCommand(
  message: string
): Promise<LeadMemoryResult | null> {
  const lower = message.toLowerCase().trim();

  if (
    lower === "leadleri göster" ||
    lower === "leadleri goster" ||
    lower.includes("leadleri göster")
  ) {
    return { success: true, message: await summarizeAllLeads() };
  }

  if (
    lower.includes("klinik nova leadleri") ||
    lower.includes("klinik nova lead")
  ) {
    return summarizeBusinessLeads("Klinik Nova");
  }

  if (
    lower.includes("müşteri kayıtları") ||
    lower.includes("musteri kayitlari") ||
    lower.includes("müşteri kayitlari")
  ) {
    return { success: true, message: await summarizeAllCustomers() };
  }

  if (
    lower.includes("klinik nova konuşmaları") ||
    lower.includes("klinik nova konusmalari")
  ) {
    return summarizeBusinessConversations("Klinik Nova");
  }

  if (lower.startsWith("lead özeti:") || lower.startsWith("lead ozeti:")) {
    const target = message
      .replace(/^lead\s+özeti\s*:\s*/i, "")
      .replace(/^lead\s+ozeti\s*:\s*/i, "")
      .trim();

    if (!target) {
      return {
        success: false,
        message: "Kullanım: lead özeti: Klinik Nova",
      };
    }

    return summarizeBusinessLeads(target);
  }

  if (
    lower.startsWith("konuşma kaydet:") ||
    lower.startsWith("konusma kaydet:")
  ) {
    const payload = message
      .replace(/^konuşma\s+kaydet\s*:\s*/i, "")
      .replace(/^konusma\s+kaydet\s*:\s*/i, "")
      .trim();

    return saveConversationFromCommand(payload);
  }

  return null;
}
