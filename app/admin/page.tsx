"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type MemoryRow = {
  id: number;
  content: string;
  category: string;
  created_at: string;
};

type TaskRow = {
  id: number;
  title: string;
  description?: string;
  status: string;
  created_at: string;
};

const sections = [
  "Genel Durum",
  "Kullanıcılar",
  "Model Router",
  "API Keyler",
  "Telegram",
  "Voice",
  "Hafıza",
  "Görevler",
  "Research",
  "Loglar",
  "Güvenlik",
];

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState("Genel Durum");

  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const loadMemories = async () => {
    const client = getSupabaseClient();

    if (!client) {
      setMemories([]);
      return;
    }

    try {
      const { data } = await client
        .from("memory")
        .select("*")
        .eq("user_id", "kemal")
        .order("created_at", { ascending: false })
        .limit(50);

      setMemories(data || []);
    } catch {
      setMemories([]);
    }
  };

  const loadTasks = async () => {
    const client = getSupabaseClient();

    if (!client) {
      setTasks([]);
      return;
    }

    try {
      const { data } = await client
        .from("tasks")
        .select("*")
        .eq("user_id", "kemal")
        .order("created_at", { ascending: false });

      setTasks(data || []);
    } catch {
      setTasks([]);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMemories();
      void loadTasks();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex">
        <aside className="w-80 min-h-screen border-r border-zinc-800 p-6 bg-zinc-950">
          <h1 className="text-3xl font-bold mb-2 text-violet-300">
            Hermes Admin
          </h1>

          <p className="text-zinc-500 mb-8">Core Control Center</p>

          <nav className="space-y-2">
            {sections.map((item) => (
              <button
                key={item}
                onClick={() => setActiveSection(item)}
                className={`w-full text-left px-4 py-3 rounded-2xl border transition ${
                  activeSection === item
                    ? "bg-violet-700 text-white border-violet-500/40"
                    : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <h2 className="text-5xl font-bold mb-3">{activeSection}</h2>

          <p className="text-zinc-400 mb-10">
            Hermes sisteminin {activeSection.toLowerCase()} bölümü.
          </p>

          <AdminContent
            section={activeSection}
            memories={memories}
            tasks={tasks}
            reloadMemories={loadMemories}
            reloadTasks={loadTasks}
            editingId={editingId}
            setEditingId={setEditingId}
            editText={editText}
            setEditText={setEditText}
          />
        </section>
      </div>
    </main>
  );
}

function AdminContent({
  section,
  memories,
  tasks,
  reloadMemories,
  reloadTasks,
  editingId,
  setEditingId,
  editText,
  setEditText,
}: {
  section: string;
  memories: MemoryRow[];
  tasks: TaskRow[];
  reloadMemories: () => Promise<void>;
  reloadTasks: () => Promise<void>;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  editText: string;
  setEditText: (text: string) => void;
}) {
  if (section === "Genel Durum") {
    return (
      <Grid>
        <Card title="Sistem Durumu" value="Aktif" desc="Hermes çalışıyor." />
        <Card title="Memory" value={String(memories.length)} desc="Kayıtlı hafıza." />
        <Card title="Tasks" value={String(tasks.length)} desc="Aktif görev." />
      </Grid>
    );
  }

  if (section === "Hafıza") {
    return (
      <div className="space-y-6">
        <Panel>
          <h3 className="text-2xl font-bold mb-5">Son Hafızalar</h3>

          <div className="space-y-3">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="bg-black border border-zinc-800 rounded-2xl p-4"
              >
                {editingId === memory.id ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full min-h-24 bg-zinc-950 border border-zinc-700 rounded-2xl p-3 outline-none"
                    />

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={async () => {
                          const client = getSupabaseClient();
                          if (!client) return;

                          try {
                            await client
                              .from("memory")
                              .update({ content: editText })
                              .eq("id", memory.id);
                          } catch {
                            return;
                          }

                          setEditingId(null);
                          setEditText("");

                          await reloadMemories();
                        }}
                        className="bg-violet-700 hover:bg-violet-600 px-4 py-2 rounded-xl"
                      >
                        Kaydet
                      </button>

                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-300">{memory.content}</p>

                    <p className="text-zinc-600 text-xs mt-2">
                      {memory.category} • {memory.created_at}
                    </p>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setEditingId(memory.id);
                          setEditText(memory.content);
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-sm"
                      >
                        Düzenle
                      </button>

                      <button
                        onClick={async () => {
                          const client = getSupabaseClient();
                          if (!client) return;

                          try {
                            await client
                              .from("memory")
                              .delete()
                              .eq("id", memory.id);
                          } catch {
                            return;
                          }

                          await reloadMemories();
                        }}
                        className="bg-red-900 hover:bg-red-800 px-4 py-2 rounded-xl text-sm"
                      >
                        Sil
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  if (section === "Görevler") {
    return (
      <div className="space-y-6">
        <Grid>
          <Card
            title="Toplam Görev"
            value={String(tasks.length)}
            desc="Kayıtlı görev sayısı."
          />

          <Card
            title="Tamamlanan"
            value={String(tasks.filter((t) => t.status === "done").length)}
            desc="Bitmiş görevler."
          />

          <Card
            title="Bekleyen"
            value={String(tasks.filter((t) => t.status !== "done").length)}
            desc="Aktif görevler."
          />
        </Grid>

        <Panel>
          <h3 className="text-2xl font-bold mb-5">Görevler</h3>

          <div className="space-y-3">
            {tasks.length === 0 && (
              <p className="text-zinc-500">Henüz görev yok.</p>
            )}

            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-black border border-zinc-800 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold">{task.title}</h4>

                    <p className="text-zinc-400 mt-1">
                      {task.description || "Açıklama yok"}
                    </p>

                    <p className="text-zinc-600 text-xs mt-2">
                      {task.status || "pending"} • {task.created_at}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const client = getSupabaseClient();
                        if (!client) return;

                        try {
                          await client
                            .from("tasks")
                            .update({
                              status:
                                task.status === "done"
                                  ? "pending"
                                  : "done",
                            })
                            .eq("id", task.id);
                        } catch {
                          return;
                        }

                        await reloadTasks();
                      }}
                      className="bg-violet-700 hover:bg-violet-600 px-4 py-2 rounded-xl text-sm"
                    >
                      {task.status === "done"
                        ? "Geri Aç"
                        : "Tamamla"}
                    </button>

                    <button
                      onClick={async () => {
                        const client = getSupabaseClient();
                        if (!client) return;

                        try {
                          await client
                            .from("tasks")
                            .delete()
                            .eq("id", task.id);
                        } catch {
                          return;
                        }

                        await reloadTasks();
                      }}
                      className="bg-red-900 hover:bg-red-800 px-4 py-2 rounded-xl text-sm"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <Panel>
      <Setting title="Durum" value="Hazırlanıyor" />
      <Setting title="Not" value="Bu bölüm geliştirilecek." />
    </Panel>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {children}
    </div>
  );
}

function Card({
  title,
  value,
  desc,
}: {
  title: string;
  value: string;
  desc: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <p className="text-zinc-500 mb-2">{title}</p>

      <h3 className="text-3xl font-bold mb-2">{value}</h3>

      <p className="text-zinc-500">{desc}</p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-5xl">
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Setting({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex justify-between border-b border-zinc-800 pb-3">
      <span className="text-zinc-400">{title}</span>
      <span>{value}</span>
    </div>
  );
}