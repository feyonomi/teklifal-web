import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Çerez Politikası | TeklifAl",
  description: "TeklifAl çerez politikası.",
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
      <h1 className="text-2xl font-semibold text-slate-50">Çerez Politikası</h1>
      <p className="mt-4 text-sm text-slate-300">
        Bu sayfa platformda kullanılan zorunlu, analitik ve tercih çerezleri hakkında bilgi verir.
      </p>
      <section className="mt-6 space-y-3 text-sm text-slate-300">
        <p>Zorunlu çerezler hizmetin çalışması için gereklidir.</p>
        <p>Analitik çerezler ürün performansını geliştirmek için anonim ölçüm sağlar.</p>
        <p>Kullanıcılar tarayıcı ayarlarından çerez tercihlerini yönetebilir.</p>
      </section>
    </main>
  );
}
