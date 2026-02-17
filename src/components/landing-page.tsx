"use client";

import { useEffect, useState } from "react";
import type {
  AiSuggestionResult,
  ProviderProfile,
  ServiceCategory,
} from "@/domain/models";

interface LandingPageProps {
  categories: ServiceCategory[];
  providers: ProviderProfile[];
}

interface QuoteFormState {
  title: string;
  description: string;
  categoryId: ServiceCategory["id"] | "";
  city: string;
  budgetMin: string;
  budgetMax: string;
}

const INITIAL_FORM: QuoteFormState = {
  title: "",
  description: "",
  categoryId: "",
  city: "",
  budgetMin: "",
  budgetMax: "",
};

export function LandingPage({ categories, providers }: LandingPageProps) {
  const [form, setForm] =
    useState<QuoteFormState>(INITIAL_FORM);
  const [aiResult, setAiResult] = useState<AiSuggestionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestsCount, setRequestsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/requests")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.data)) {
          setRequestsCount(data.data.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAnalyze = async () => {
    if (!form.description.trim()) {
      setError("Lütfen ihtiyacınızı kısaca açıklayın.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          categoryId: form.categoryId || undefined,
          city: form.city || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Analiz sırasında hata oluştu.");
      }
      setAiResult(json.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Analiz sırasında beklenmeyen bir hata oluştu.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.categoryId || !form.city) {
      setError("Başlık, açıklama, kategori ve şehir alanları zorunludur.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: "demo-buyer-1",
          title: form.title.trim(),
          description: form.description.trim(),
          categoryId: form.categoryId,
          city: form.city.trim(),
          budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Teklif talebi oluşturulamadı.");
      }
      setRequestsCount((count) => count + 1);
      setForm(INITIAL_FORM);
      setAiResult(json.data.aiSummary ? json.data : aiResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Teklif talebi oluşturulurken beklenmeyen bir hata oluştu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const featuredProviders = providers.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 lg:flex-row lg:items-center lg:gap-12 lg:py-16">
        <section className="mb-10 flex-1 space-y-8 lg:mb-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-medium text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Yapay zeka destekli B2B hizmet pazaryeri
          </div>
          <div className="space-y-4">
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Kurumsal ihtiyacını anlat,{" "}
              <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                en uygun tedarikçiyi
              </span>{" "}
              yapay zeka eşleştirsin.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Armut mantığında, fakat tamamen B2B odaklı: tek form ile onlarca onaylı
              tedarikçiden teklif al, AI skorlaması ile riskini azalt, süreci uçtan
              uca dijital yönet.
            </p>
          </div>
          <div className="grid max-w-xl grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                Aktif tedarikçi
              </div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">
                {providers.length.toString().padStart(2, "0")}+
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Sadece doğrulanmış şirketler
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                Oluşturulan talep
              </div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">
                {requestsCount.toString().padStart(2, "0")}+
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Demo ortamında gerçek zamanlı
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                AI eşleşme skoru
              </div>
              <div className="mt-1 text-lg font-semibold sm:text-xl">
                %{Math.round(
                  featuredProviders.reduce((acc, p) => acc + p.aiScore, 0) /
                    Math.max(featuredProviders.length, 1),
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Tedarikçi puanlama motoru
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Popüler kurumsal ihtiyaçlar
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      categoryId: cat.id,
                      title: prev.title || cat.name,
                    }))
                  }
                  className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-slate-200 transition hover:border-sky-500 hover:bg-slate-900"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full max-w-md flex-1">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/90 shadow-[0_0_80px_rgba(15,23,42,0.8)] backdrop-blur">
            <div className="border-b border-slate-800 px-5 py-3 text-xs text-slate-300">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-slate-100">
                  Teklif Al • B2B Yapay Zeka Asistanı
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Canlı demo
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Tek form ile talebini oluştur, AI analiz etsin, uygun tedarikçilere
                dağıtsın.
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-3 px-5 py-4 text-xs sm:text-sm"
            >
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-300">
                  Talep başlığı
                </label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Örn: 500 m² ofis tadilatı ve taşıma"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-medium text-slate-300">
                    İhtiyacını kısaca anlat
                  </label>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="text-[11px] font-medium text-sky-400 hover:text-sky-300 disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    {isAnalyzing ? "Analiz ediliyor..." : "AI ile analiz et"}
                  </button>
                </div>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Metrekare, lokasyon, mevcut durum ve beklentilerini yaz. Örn: Maslak'ta 2 katlı ofisimizin açık ofis tasarımı, elektrik ve altyapı yenilemesi ile taşınması..."
                  className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Kategori
                  </label>
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">Seçiniz</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Şehir
                  </label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Örn: İstanbul"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Minimum bütçe (₺)
                  </label>
                  <input
                    name="budgetMin"
                    value={form.budgetMin}
                    onChange={handleChange}
                    placeholder="Örn: 50000"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Maksimum bütçe (₺)
                  </label>
                  <input
                    name="budgetMax"
                    value={form.budgetMax}
                    onChange={handleChange}
                    placeholder="Örn: 250000"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/30 transition hover:from-sky-400 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Talebin oluşturuluyor..." : "Teklif al • 3 dakikada talep oluştur"}
              </button>

              <div className="pb-1 text-[10px] text-slate-500">
                Demo versiyon: Talebin bu tarayıcı oturumu içinde hafızada tutulur ve
                AI motoru heuristik olarak çalışır. Gerçek projede kimlik, sözleşme ve
                puanlama katmanları eklenecektir.
              </div>
            </form>

            <div className="border-t border-slate-800 bg-slate-950/70 px-5 py-3">
              <div className="text-[11px] font-medium text-slate-300">
                AI özet ve kontrol listesi
              </div>
              {aiResult ? (
                <div className="mt-2 space-y-2 text-[11px] text-slate-200">
                  <p className="text-slate-300">{aiResult.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiResult.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-sky-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Teklif vermeden önce yanıtlaman önerilen sorular
                    </div>
                    <ul className="space-y-1.5">
                      {aiResult.questions.map((q) => (
                        <li key={q} className="flex gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400" />
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Tahmini proje karmaşıklığı:{" "}
                    <span className="font-semibold text-sky-300">
                      {aiResult.estimatedComplexity.toUpperCase()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-slate-400">
                  İhtiyacını yazıp{" "}
                  <span className="font-medium text-sky-300">AI ile analiz et</span>{" "}
                  butonuna tıkladığında, sistem açıklamanı özetler, etiketler üretir ve
                  satın alma sürecine başlamadan önce yanıtlaman için sorular önerir.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-gradient-to-tr from-sky-500 to-emerald-500" />
              <span>
                TeklifAl B2B • Web, Android ve iOS için ortak API mimarisiyle tasarlandı.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

