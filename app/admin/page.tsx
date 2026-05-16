export default function AdminPage() {
  const cards = [
    ["Aktif Çekirdek", "Hermes Core"],
    ["Model Router", "Hibrit / Otomatik"],
    ["OpenAI", "Aktif"],
    ["Telegram", "Aktif"],
    ["Hafıza", "Yakında"],
    ["Aile Sistemi", "Hazırlanıyor"],
    ["Voice Core", "Alpha"],
    ["Research Radar", "Aktif"],
    ["Güvenlik", "Admin panel geliştiriliyor"],
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex">
        <aside className="w-72 border-r border-zinc-800 min-h-screen p-6">
          <h1 className="text-3xl font-bold mb-10">Hermes Admin</h1>

          {["Genel Sistem", "Model Router", "Telegram", "Hafıza", "Aile Üyeleri", "Görevler", "Voice", "Güvenlik"].map((item) => (
            <div key={item} className="bg-zinc-900 p-4 rounded-2xl mb-3 border border-zinc-800">
              {item}
            </div>
          ))}
        </aside>

        <section className="flex-1 p-10">
          <h2 className="text-4xl font-bold mb-3">Hermes Core Control Panel</h2>
          <p className="text-zinc-400 mb-10">Sistem ayarları, modeller, aile ve hafıza burada yönetilecek.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cards.map(([title, value]) => (
              <div key={title} className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                <h3 className="text-xl font-semibold mb-3">{title}</h3>
                <p className="text-zinc-400">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}