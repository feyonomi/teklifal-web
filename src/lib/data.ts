import {
  AiSuggestionInput,
  AiSuggestionResult,
  ProviderProfile,
  QuoteRequest,
  ServiceCategory,
} from "@/domain/models";

let requests: QuoteRequest[] = [];

const categories: ServiceCategory[] = [
  {
    id: "tadilat",
    name: "Tadilat & İnşaat",
    description: "Ofis, depo, üretim alanı tadilatı ve anahtar teslim projeler",
    icon: "building",
  },
  {
    id: "nakliye",
    name: "Lojistik & Nakliye",
    description: "Şehir içi / şehirler arası nakliye, depolama ve dağıtım",
    icon: "truck",
  },
  {
    id: "temizlik",
    name: "Kurumsal Temizlik",
    description: "Ofis, plaza, fabrika ve inşaat sonrası profesyonel temizlik",
    icon: "sparkles",
  },
  {
    id: "beyaz-esya",
    name: "Teknik Servis",
    description: "Beyaz eşya, klima, jeneratör ve ekipman bakım & onarım",
    icon: "wrench",
  },
  {
    id: "bilisim",
    name: "BT & Yazılım Çözümleri",
    description: "Altyapı, yazılım geliştirme, bulut, siber güvenlik ve destek",
    icon: "cpu",
  },
  {
    id: "diger",
    name: "Diğer Tüm Hizmetler",
    description: "Listede olmayan özel kurumsal ihtiyaçlar için teklif alın",
    icon: "dots",
  },
];

const providers: ProviderProfile[] = [
  {
    id: "p1",
    companyName: "ProFix Tadilat A.Ş.",
    email: "iletisim@profix.com",
    phone: "+90 212 000 00 00",
    sectors: ["Ofis", "Perakende", "Depo"],
    categories: ["tadilat"],
    city: "İstanbul",
    rating: 4.8,
    completedJobs: 240,
    minBudget: 50000,
    maxBudget: 1500000,
    aiScore: 93,
  },
  {
    id: "p2",
    companyName: "HızlıNakliye Lojistik",
    email: "teklif@hizlinakliye.com",
    phone: "+90 216 000 00 00",
    sectors: ["E-ticaret", "FMCG"],
    categories: ["nakliye"],
    city: "Kocaeli",
    rating: 4.6,
    completedJobs: 410,
    minBudget: 10000,
    maxBudget: 750000,
    aiScore: 88,
  },
  {
    id: "p3",
    companyName: "CloudBridge Teknoloji",
    email: "sales@cloudbridge.com",
    phone: "+90 850 000 00 00",
    sectors: ["Finans", "SaaS", "Sağlık"],
    categories: ["bilisim"],
    city: "İstanbul",
    rating: 4.9,
    completedJobs: 120,
    minBudget: 30000,
    maxBudget: 2000000,
    aiScore: 96,
  },
];

export function getCategories() {
  return categories;
}

export function getProviders() {
  return providers;
}

export function getRequests() {
  return requests;
}

export function addRequest(request: QuoteRequest) {
  requests = [request, ...requests];
  return request;
}

export function generateRequestFromInput(params: {
  buyerId: string;
  title: string;
  description: string;
  categoryId: QuoteRequest["categoryId"];
  city: string;
  budgetMin?: number;
  budgetMax?: number;
}): QuoteRequest {
  const ai = getAiSuggestion({
    description: params.description,
    categoryId: params.categoryId,
    city: params.city,
  });

  const now = new Date().toISOString();

  return {
    id: `r-${Date.now()}`,
    buyerId: params.buyerId,
    title: params.title,
    description: params.description,
    categoryId: params.categoryId,
    city: params.city,
    budgetMin: params.budgetMin,
    budgetMax: params.budgetMax,
    createdAt: now,
    status: "open",
    aiSummary: ai.summary,
    aiTags: ai.tags,
  };
}

export function getAiSuggestion(
  input: AiSuggestionInput,
): AiSuggestionResult {
  const description = input.description.trim();

  const lengthScore =
    description.length < 120 ? "düşük" : description.length < 400 ? "orta" : "yüksek";

  const tags = new Set<string>();

  const lower = description.toLowerCase();

  if (lower.includes("ofis") || lower.includes("plaza")) {
    tags.add("ofis");
  }
  if (lower.includes("depo") || lower.includes("lojistik")) {
    tags.add("lojistik");
  }
  if (lower.includes("sunucu") || lower.includes("cloud") || lower.includes("bulut")) {
    tags.add("bulut altyapı");
  }
  if (lower.includes("mobil") || lower.includes("android") || lower.includes("ios")) {
    tags.add("mobil uygulama");
  }
  if (lower.includes("temizlik")) {
    tags.add("temizlik");
  }
  if (lower.includes("acil") || lower.includes("en kısa sürede")) {
    tags.add("acil ihtiyaç");
  }

  if (input.categoryId === "bilisim") {
    tags.add("BT projesi");
  }
  if (input.categoryId === "tadilat") {
    tags.add("tadilat projesi");
  }

  if (input.city) {
    tags.add(input.city);
  }

  if (tags.size === 0) {
    tags.add("keşif gerekli");
  }

  const questions: string[] = [
    "Planlanan başlangıç ve bitiş tarihleriniz nedir?",
    "Tahmini bütçe aralığınız nedir?",
    "Daha önce benzer bir hizmet aldınız mı?",
  ];

  if (input.categoryId === "bilisim") {
    questions.push(
      "Mevcut altyapınız ve kullandığınız teknolojiler nelerdir?",
      "Proje için başarı kriterlerini nasıl tanımlarsınız?",
    );
  }

  if (input.categoryId === "tadilat") {
    questions.push(
      "Toplam metrekare ve kat sayısı nedir?",
      "Mekân kullanım amacı nedir (ofis, depo, üretim vb.)?",
    );
  }

  const summaryBase = description
    ? description
    : "Kurumsal hizmet talebi için yapay zeka destekli ön analiz oluşturuldu.";

  const summary = `${summaryBase} Sistem, uygun tedarikçilerle eşleştirme için ön analiz yaptı.`;

  return {
    summary,
    tags: Array.from(tags),
    questions,
    estimatedComplexity: lengthScore,
  };
}

