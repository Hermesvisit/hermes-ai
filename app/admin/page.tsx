export default function AdminPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex">
        
        {/* Sidebar */}
        <aside className="w-72 border-r border-zinc-800 min-h-screen p-6">
          <h1 className="text-3xl font-bold mb-10">Hermes Admin</h1>

          <nav className="space-y-3">
            <div className="bg-zinc-900 p-4 rounded-2xl cursor-pointer hover:bg-zinc-800">
              Genel Sistem
            </div>

            <div className="bg-zinc-900 p-4 rounded-2xl cursor-pointer hover:bg-zinc-800">
              Model Router
            </div>

            <div className="bg-zinc-900 p-4 rounded-2xl cursor-pointer hover:bg-zinc-800">
              Telegram
            </div>

            <div className="bg-zinc-900 p-4 rounded-2xl cursor-pointer hover:bg-zinc-800">
              Hafıza Sistemi
            </div>

            <div className="bg-zinc-900 p-4 rounded-2xl cursor-pointer hover:bg-zinc-800">
              Aile Üyeleri
            </div>

            <div className="bg-zinc-900 p-4 rounded-2xl cursor-pointer hover:bg-zinc-800">
              Görevler
            </div>

            <div className="bg-zinc-900 p-4 rounded-2xl cursor-pointer hover:bg-zinc-800">
              Voice Mode
            </div>

            <div className="bg-zinc-900 p-4 rounded-2xl cursor-pointer hover:bg-zinc-800">
              Güvenlik
            </div>
          </nav>
        </aside>

        {/* Main */}
        <section className="flex-1 p-10">
          <div className="mb-10">
            <h2 className="text-4xl font-bold mb-3">
              Hermes Core Control Panel
            </h2>

            <p className="text-zinc-400">
              Hermes sistemini buradan yönetebilirsin.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-xl font-semibold mb-3">
                Aktif Model
              </h3>

              <p className="text-zinc-400">
                GPT-4o Mini
              </p>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-xl font-semibold mb-3">
                Telegram Durumu
              </h3>

              <p className="text-green-400">
                Aktif
              </p>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-xl font-semibold mb-3">
                Hafıza Sistemi
              </h3>

              <p className="text-yellow-400">
                Yakında
              </p>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-xl font-semibold mb-3">
                Voice System
              </h3>

              <p className="text-yellow-400">
                Geliştiriliyor
              </p>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-xl font-semibold mb-3">
                Aile Üyesi Sayısı
              </h3>

              <p className="text-zinc-400">
                1
              </p>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-xl font-semibold mb-3">
                Sistem Durumu
              </h3>

              <p className="text-green-400">
                Stabil
              </p>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}