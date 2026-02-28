"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type React from "react";
import type {
  AiSuggestionResult,
  ProviderProfile,
} from "@/domain/models";
import { getAllCategories, type ServiceCategory as UiServiceCategory } from "@/lib/categories";

interface LandingPageProps {
  providers: ProviderProfile[];
}

interface QuoteFormState {
  title: string;
  description: string;
  categoryId: string;
  city: string;
  budgetMin: string;
  budgetMax: string;
}

interface JobListItem {
  id: string;
  title: string;
  status: string;
  city: string;
  category: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  _count?: {
    offers?: number;
  };
}

interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  receiverId: string;
  text: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  readAt?: string | null;
  createdAt: string;
  isMine: boolean;
}

interface ScenarioOffer {
  id: string;
  name: string;
  rating: number;
  reviews?: number;
  jobs?: number;
  price: number;
  eta: string;
  speedRank: number;
  trustScore: number;
  priceSuitability: number;
  distanceKm: number;
  note: string;
  badge: string;
  extras: string[];
  videoUrl: string;
  gallery: string[];
  verificationDate: string;
  cancelRate: string;
  avgResponseMinutes: number;
}

type OfferScenario = "hukuk" | "tadilat";

const INITIAL_FORM: QuoteFormState = {
  title: "",
  description: "",
  categoryId: "",
  city: "",
  budgetMin: "",
  budgetMax: "",
};

const AUTH_TOKEN_STORAGE_KEY = "authToken";

function formatTl(value: number) {
  return `${value.toLocaleString("tr-TR")} TL`;
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SEARCH_STOP_WORDS = new Set([
  "firma",
  "firmasi",
  "ustasi",
  "usta",
  "hizmet",
  "hizmeti",
  "servis",
  "servisi",
  "ariyorum",
  "ariyor",
  "ariyom",
]);

const SEARCH_SYNONYMS: Record<string, string[]> = {
  bebek: ["cocuk", "bakici", "dadi", "oyun ablasi", "yeni dogan", "gelisim"],
  cocuk: ["bebek", "pedagog", "bakici", "oyun ablasi", "gelisim"],
  dadi: ["bakici", "bebek", "cocuk"],
  bakici: ["dadi", "bebek", "cocuk", "hasta bakimi"],
  asansor: ["asansorlu", "montaj", "bakim", "ariza"],
  psikolog: ["terapist", "pedagog", "danismanlik"],
};

const TURKIYE_ILLERI = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin",
  "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
  "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan",
  "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkâri", "Hatay", "Isparta",
  "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
  "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla",
  "Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt",
  "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak",
  "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman",
  "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce",
] as const;

function expandSearchTokens(baseTokens: string[]) {
  const expanded = new Set<string>();

  for (const token of baseTokens) {
    const normalizedToken = normalizeSearchText(token);
    if (!normalizedToken) continue;

    expanded.add(normalizedToken);

    const synonyms = SEARCH_SYNONYMS[normalizedToken] ?? [];
    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeSearchText(synonym);
      if (!normalizedSynonym) continue;
      expanded.add(normalizedSynonym);

      for (const part of normalizedSynonym.split(" ")) {
        if (part) {
          expanded.add(part);
        }
      }
    }
  }

  return Array.from(expanded);
}

export function LandingPage({ providers }: Omit<LandingPageProps, 'categories'>) {
  const allCategories = getAllCategories();
  const providerCities = Array.from(
    new Set(providers.map((provider) => provider.city).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "tr"));
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const cityOptions = Array.from(
    new Set([...(detectedCity ? [detectedCity] : []), ...TURKIYE_ILLERI, ...providerCities]),
  ).sort((a, b) => a.localeCompare(b, "tr"));
  const [form, setForm] = useState<QuoteFormState>(INITIAL_FORM);
  const [aiResult, setAiResult] = useState<AiSuggestionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestsCount, setRequestsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [myJobs, setMyJobs] = useState<JobListItem[]>([]);
  const [sortBy, setSortBy] = useState<
    "ai" | "price-asc" | "price-desc" | "rating" | "speed"
  >("ai");
  const [chatHintKey, setChatHintKey] = useState<string | null>(null);
  const [rippleKey, setRippleKey] = useState<string | null>(null);
  const [gaugeProgress, setGaugeProgress] = useState(0);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ScenarioOffer | null>(null);
  const [isTrustAccordionOpen, setIsTrustAccordionOpen] = useState(false);
  const [paymentOffer, setPaymentOffer] = useState<ScenarioOffer | null>(null);
  const [paymentStep, setPaymentStep] = useState<1 | 2 | 3>(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<ScenarioOffer | null>(null);
  const [liveOfferBadgeVisible, setLiveOfferBadgeVisible] = useState(false);
  const [themePreference, setThemePreference] = useState<"auto" | "dark" | "light">("auto");
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [isTemplatePopupOpen, setIsTemplatePopupOpen] = useState(false);
  const [videoBonusEarned, setVideoBonusEarned] = useState(false);
  const [favoriteProviderIds, setFavoriteProviderIds] = useState<string[]>([]);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<string | null>(null);
  const [depositPercent, setDepositPercent] = useState(18);
  const [payOnDelivery, setPayOnDelivery] = useState(true);
  const [trustJobsProgress, setTrustJobsProgress] = useState(13);
  const [trustCommentsProgress, setTrustCommentsProgress] = useState(3);
  const [trustBadgeUnlocked, setTrustBadgeUnlocked] = useState(false);
  const [postJobRating, setPostJobRating] = useState(0);
  const [postJobComment, setPostJobComment] = useState("");
  const [isAnonymousSuggestion, setIsAnonymousSuggestion] = useState(true);
  const [heartBurstProviderId, setHeartBurstProviderId] = useState<string | null>(null);
  const [followUpScheduled, setFollowUpScheduled] = useState(false);
  const [showFollowUpPush, setShowFollowUpPush] = useState(false);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dismissedOfferIds, setDismissedOfferIds] = useState<string[]>([]);
  const [favoriteToastVisible, setFavoriteToastVisible] = useState(false);
  const [sidebarToastMessage, setSidebarToastMessage] = useState<string | null>(null);
  const [insightTab, setInsightTab] = useState<"weekly" | "analysis" | "feedback">("weekly");
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState<
    Record<string, { price: boolean; duration: boolean; rating: boolean; extras: boolean }>
  >({});

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobTitle, setActiveJobTitle] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>(cityOptions[0] ?? "İstanbul");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [isChatSending, setIsChatSending] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const loadMyJobs = async (token: string) => {
    try {
      const res = await fetch("/api/jobs?mine=true&status=open", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (Array.isArray(json.data)) {
        setMyJobs(json.data);
        setRequestsCount(json.data.length);
      }
    } catch {
    }
  };

  useEffect(() => {
    const hydrateAuthSession = async () => {
      try {
        const storedToken =
          typeof window !== "undefined"
            ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
            : null;

        if (!storedToken) {
          return;
        }

        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!res.ok) {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          }
          return;
        }

        setAuthToken(storedToken);
        await loadMyJobs(storedToken);
      } catch {
      }
    };

    hydrateAuthSession();
  }, []);

  useEffect(() => {
    if (!chatHintKey) return;
    const timeout = window.setTimeout(() => setChatHintKey(null), 1500);
    return () => window.clearTimeout(timeout);
  }, [chatHintKey]);

  useEffect(() => {
    if (!rippleKey) return;
    const timeout = window.setTimeout(() => setRippleKey(null), 550);
    return () => window.clearTimeout(timeout);
  }, [rippleKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setGaugeProgress(92), 180);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setSystemPrefersDark(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
    setIsReducedMotion(reduced || lowCpu);
  }, []);

  useEffect(() => {
    if (!showConfetti) return;
    const timeout = window.setTimeout(() => setShowConfetti(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [showConfetti]);

  useEffect(() => {
    if (!heartBurstProviderId) return;
    const timeout = window.setTimeout(() => setHeartBurstProviderId(null), 700);
    return () => window.clearTimeout(timeout);
  }, [heartBurstProviderId]);

  useEffect(() => {
    if (!followUpScheduled) return;
    const timeout = window.setTimeout(() => setShowFollowUpPush(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [followUpScheduled]);

  useEffect(() => {
    if (!favoriteToastVisible) return;
    const timeout = window.setTimeout(() => setFavoriteToastVisible(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [favoriteToastVisible]);

  useEffect(() => {
    if (!sidebarToastMessage) return;
    const timeout = window.setTimeout(() => setSidebarToastMessage(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [sidebarToastMessage]);

  useEffect(() => {
    if (!isThemeTransitioning) return;
    const timeout = window.setTimeout(() => setIsThemeTransitioning(false), 400);
    return () => window.clearTimeout(timeout);
  }, [isThemeTransitioning]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const liveOfferData: ScenarioOffer = {
        id: "live-offer-1",
        name: "Usta Kerem Can",
        rating: 4.93,
        jobs: 176,
        price: 4900,
        eta: "Bugün 16:30",
        speedRank: 1,
        trustScore: 96,
        priceSuitability: 94,
        distanceKm: 2.1,
        note: "Canlı gelen teklif • Hemen başlayabilir",
        badge: "Yeni Teklif",
        extras: ["2 yıl garanti", "Video rapor"],
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        gallery: ["Çatı hasarı önce", "Onarım sonrası"],
        verificationDate: "17.01.2026",
        cancelRate: "%0",
        avgResponseMinutes: 1,
      };
      setIncomingOffer(liveOfferData);
      setLiveOfferBadgeVisible(true);
      try {
        const audioContext = new window.AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 780;
        gainNode.gain.value = 0.02;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.12);
      } catch {
      }
    }, 9000);

    const hideTimeout = window.setTimeout(() => {
      setLiveOfferBadgeVisible(false);
    }, 14000);

    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(hideTimeout);
    };
  }, []);

  useEffect(() => {
    if (cityOptions.length === 0) return;
    if (!cityOptions.includes(selectedCity)) {
      setSelectedCity(cityOptions[0]);
    }
  }, [cityOptions, selectedCity]);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    const controller = new AbortController();

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const params = new URLSearchParams({
            format: "jsonv2",
            lat: String(coords.latitude),
            lon: String(coords.longitude),
            "accept-language": "tr",
          });
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
            {
              signal: controller.signal,
            },
          );

          if (!response.ok) {
            return;
          }

          const data = (await response.json()) as {
            address?: {
              city?: string;
              town?: string;
              state?: string;
              province?: string;
            };
          };

          const cityFromLocation =
            data.address?.city ?? data.address?.town ?? data.address?.province ?? data.address?.state;

          if (!cityFromLocation) {
            return;
          }

          const normalizedCity = cityFromLocation.trim();
          if (!normalizedCity) {
            return;
          }

          setDetectedCity(normalizedCity);
          setSelectedCity(normalizedCity);
        } catch {
        }
      },
      () => {
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 5 * 60 * 1000,
      },
    );

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!activeJobId || !authToken) return;

    let cancelled = false;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const load = async (withLoading: boolean) => {
      try {
        if (withLoading) {
          setIsChatLoading(true);
        }
        const res = await fetch(`/api/jobs/${activeJobId}/messages`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const json = await res.json();
        if (!res.ok) {
          return;
        }
        if (!cancelled && Array.isArray(json.data)) {
          setChatMessages(json.data);
        }
      } catch {
      } finally {
        if (withLoading && !cancelled) {
          setIsChatLoading(false);
        }
      }
    };

    const connect = () => {
      if (cancelled) return;

      const url = new URL(
        `/api/jobs/${activeJobId}/messages/stream`,
        window.location.origin,
      );
      url.searchParams.set("token", authToken);

      const es = new EventSource(url.toString());
      eventSource = es;

      es.addEventListener("message", (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(
            (event as MessageEvent).data,
          ) as ChatMessage;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) {
              return prev;
            }
            return [...prev, data];
          });
        } catch {
        }
      });

      es.addEventListener("heartbeat", () => {});

      es.onopen = async () => {
        if (cancelled) return;
        reconnectAttempts = 0;
        if (reconnectTimeout !== null) {
          window.clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        await load(false);
      };

      es.onerror = () => {
        es.close();
        if (cancelled) return;
        if (reconnectTimeout === null && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts += 1;
          const delay = Math.min(3000 * 2 ** (reconnectAttempts - 1), 30000);
          reconnectTimeout = window.setTimeout(() => {
            reconnectTimeout = null;
            connect();
          }, delay);
        }
      };
    };

    load(true).then(() => {
      connect();
    });

    return () => {
      cancelled = true;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
      }
    };
  }, [activeJobId, authToken]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendMessage = async () => {
    if (!activeJobId || !authToken) return;
    if (!chatInput.trim() && !chatFile) return;

    setIsChatSending(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentType: string | undefined;

      if (chatFile) {
        const formData = new FormData();
        formData.append("file", chatFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadJson = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadJson.error || "Dosya yüklenemedi.");
        }

        attachmentUrl = uploadJson.url;
        attachmentType = uploadJson.type;
      }

      const res = await fetch(`/api/jobs/${activeJobId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          text: chatInput.trim() || undefined,
          attachmentUrl,
          attachmentType,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Mesaj gönderilemedi.");
      }

      setChatInput("");
      setChatFile(null);

      const listRes = await fetch(
        `/api/jobs/${activeJobId}/messages?markAsRead=true`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      const listJson = await listRes.json();
      if (Array.isArray(listJson.data)) {
        setChatMessages(listJson.data);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Mesaj gönderilirken beklenmeyen bir hata oluştu.",
      );
    } finally {
      setIsChatSending(false);
    }
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

    if (!authToken) {
      setError("Profiliniz oluşturulurken lütfen bekleyin...");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.categoryId,
          city: form.city.trim(),
          budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Teklif talebi oluşturulamadı.");
      }
      const createdJob = json.data;
      setMyJobs((prev) => [createdJob, ...prev]);
      setRequestsCount((count) => count + 1);
      setForm(INITIAL_FORM);
      setIsFormOpen(false);
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

  const normalizedSearch = normalizeSearchText(search);
  const baseTokens = normalizedSearch
    .split(" ")
    .filter((token) => token.length > 0 && !SEARCH_STOP_WORDS.has(token));
  const effectiveBaseTokens = baseTokens.length > 0 ? baseTokens : [normalizedSearch].filter(Boolean);
  const expandedTokens = expandSearchTokens(effectiveBaseTokens);
  const baseTokenSet = new Set(effectiveBaseTokens);
  const filteredCategories =
    normalizedSearch.length === 0
      ? allCategories.slice(0, 12)
      : allCategories
          .map((cat) => {
            const normalizedName = normalizeSearchText(cat.name);
            const normalizedDescription = normalizeSearchText(cat.description);
            const normalizedId = normalizeSearchText(cat.id.replaceAll("-", " "));
            const normalizedSubcategories = cat.subcategories.map((sub) => normalizeSearchText(sub));

            let score = 0;
            let matchedBaseTokenCount = 0;

            for (const token of expandedTokens) {
              if (!token) continue;

              let tokenMatched = false;

              if (normalizedName === token || normalizedName.startsWith(`${token} `)) {
                score += 120;
                tokenMatched = true;
              } else if (normalizedName.includes(token)) {
                score += 60;
                tokenMatched = true;
              }

              if (normalizedSubcategories.some((sub) => sub.includes(token))) {
                score += 80;
                tokenMatched = true;
              }

              if (normalizedDescription.includes(token)) {
                score += 35;
                tokenMatched = true;
              }

              if (normalizedId.includes(token)) {
                score += 30;
                tokenMatched = true;
              }

              if (tokenMatched) {
                if (baseTokenSet.has(token)) {
                  matchedBaseTokenCount += 1;
                }
              }
            }

            return {
              cat,
              score,
              matchedAllBaseTokens: matchedBaseTokenCount === effectiveBaseTokens.length,
            };
          })
          .filter((item) => item.score > 0 && item.matchedAllBaseTokens)
          .sort((a, b) => b.score - a.score || b.cat.aiScore - a.cat.aiScore)
          .map((item) => item.cat);

  const handleCategoryClick = (cat: UiServiceCategory) => {
    setForm({
      title: cat.name,
      description: "",
      categoryId: cat.id,
      city: "",
      budgetMin: "",
      budgetMax: "",
    });
    setIsFormOpen(true);
  };

  const legalOffers: ScenarioOffer[] = [
    {
      id: "legal-1",
      name: "Av. Mehmet Yılmaz",
      rating: 4.8,
      reviews: 287,
      price: 28500,
      eta: "7 gün",
      speedRank: 7,
      trustScore: 94,
      priceSuitability: 88,
      distanceKm: 4.2,
      note: "Aile hukuku uzmanı • Başarı oranı %92",
      badge: "AI önerisi",
      extras: ["Video danışma", "Ödeme garantisi"],
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      gallery: ["Dava dosyası hazırlık", "Duruşma takibi", "Sonuç özeti"],
      verificationDate: "02.11.2025",
      cancelRate: "%0",
      avgResponseMinutes: 2,
    },
    {
      id: "legal-2",
      name: "Av. Elif Kaya",
      rating: 4.9,
      reviews: 164,
      price: 32000,
      eta: "5 gün",
      speedRank: 5,
      trustScore: 97,
      priceSuitability: 80,
      distanceKm: 2.8,
      note: "Video görüşme dahil • 12 yıl deneyim",
      badge: "En yüksek puan",
      extras: ["Video tanıtım", "Kimlik doğrulama", "TeklifAl Güvence"],
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      gallery: ["Müvekkil geri bildirimi", "Dosya yönetimi", "Duruşma planı"],
      verificationDate: "18.10.2025",
      cancelRate: "%0",
      avgResponseMinutes: 2,
    },
    {
      id: "legal-3",
      name: "Av. Burak Demir",
      rating: 4.2,
      reviews: 98,
      price: 19000,
      eta: "9 gün",
      speedRank: 9,
      trustScore: 79,
      priceSuitability: 95,
      distanceKm: 6.3,
      note: "Daha ekonomik • Deneyim orta seviye",
      badge: "Bütçe dostu",
      extras: ["Esnek ödeme", "Mesajla hızlı dönüş"],
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      gallery: ["Dosya örneği", "Süreç takibi", "Müşteri yorumu"],
      verificationDate: "12.08.2025",
      cancelRate: "%1",
      avgResponseMinutes: 4,
    },
  ];

  const roofOffers: ScenarioOffer[] = [
    {
      id: "roof-1",
      name: "Usta Ali Çetin",
      rating: 4.95,
      jobs: 142,
      price: 5200,
      eta: "Yarın 10:00",
      speedRank: 1,
      trustScore: 95,
      priceSuitability: 90,
      distanceKm: 3.1,
      note: "Malzeme dahil • 2 yıl garanti",
      badge: "Hızlı başlangıç",
      extras: ["2 yıl garanti", "Öncesi-sonrası foto", "TeklifAl Güvence"],
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      gallery: ["Çatı onarım önce", "Çatı onarım sonra", "Malzeme teslim"],
      verificationDate: "28.11.2025",
      cancelRate: "%0",
      avgResponseMinutes: 2,
    },
    {
      id: "roof-2",
      name: "Usta Murat Acar",
      rating: 4.6,
      jobs: 91,
      price: 4300,
      eta: "2 gün içinde",
      speedRank: 2,
      trustScore: 84,
      priceSuitability: 98,
      distanceKm: 4.8,
      note: "Malzeme hariç • Uygun fiyat",
      badge: "Düşük fiyat",
      extras: ["Uygun fiyat", "Hızlı keşif"],
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      gallery: ["Keşif raporu", "İşçilik detay", "Teslim fotoğrafı"],
      verificationDate: "05.09.2025",
      cancelRate: "%1",
      avgResponseMinutes: 5,
    },
    {
      id: "roof-3",
      name: "ÇatıPro İzmir",
      rating: 4.85,
      jobs: 203,
      price: 6500,
      eta: "1 gün içinde",
      speedRank: 1,
      trustScore: 92,
      priceSuitability: 82,
      distanceKm: 2.5,
      note: "Drone keşif dahil • Kurumsal ekip",
      badge: "Premium servis",
      extras: ["Drone keşif", "Video rapor", "Kurumsal ekip"],
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      gallery: ["Drone görüntüsü", "Onarım süreci", "Son kontrol"],
      verificationDate: "10.12.2025",
      cancelRate: "%0",
      avgResponseMinutes: 3,
    },
  ];

  const calculateAiScore = (offer: ScenarioOffer) => {
    const speedScore = Math.max(0, 100 - offer.speedRank * 9);
    const ratingScore = (offer.rating / 5) * 100;
    const extrasScore = Math.min(100, offer.extras.length * 26);
    return (
      offer.trustScore * 0.32 +
      speedScore * 0.22 +
      offer.priceSuitability * 0.24 +
      extrasScore * 0.12 +
      ratingScore * 0.1
    );
  };

  const getWinnerReason = (offer: ScenarioOffer) => {
    const reasons: string[] = [];
    if (offer.priceSuitability >= 90) reasons.push("Bütçene en yakın");
    if (offer.speedRank <= 1) reasons.push("yarın müsait");
    if (offer.trustScore >= 92) reasons.push("%98 memnuniyet");
    return reasons.length > 0 ? reasons.join(" + ") : "güven ve hız dengesinde en iyi";
  };

  const buildOfferId = (scenario: OfferScenario, name: string) => `${scenario}:${name}`;

  const toggleOfferSelection = (scenario: OfferScenario, offer: ScenarioOffer) => {
    const id = buildOfferId(scenario, offer.name);
    setSelectedOfferIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const openPaymentFlow = (offer: ScenarioOffer) => {
    setPaymentOffer(offer);
    setPaymentStep(1);
    setDepositPercent(18);
    setPayOnDelivery(true);
  };

  const handleCardSwipe = (offer: ScenarioOffer, deltaX: number) => {
    if (Math.abs(deltaX) < 45) return;
    if (deltaX < 0) {
      setDismissedOfferIds((prev) => (prev.includes(offer.id) ? prev : [...prev, offer.id]));
      return;
    }
    setFavoriteProviderIds((prev) =>
      prev.includes(offer.id) ? prev : [...prev, offer.id],
    );
    setHeartBurstProviderId(offer.id);
    setFavoriteToastVisible(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(45);
    }
  };

  const toggleMobileCompareRow = (
    offerId: string,
    row: "price" | "duration" | "rating" | "extras",
  ) => {
    setMobileAccordionOpen((prev) => ({
      ...prev,
      [offerId]: {
        price: prev[offerId]?.price ?? false,
        duration: prev[offerId]?.duration ?? false,
        rating: prev[offerId]?.rating ?? false,
        extras: prev[offerId]?.extras ?? false,
        [row]: !(prev[offerId]?.[row] ?? false),
      },
    }));
  };

  const sortOffers = (offers: ScenarioOffer[]) => {
    return [...offers].sort((a, b) => {
      if (sortBy === "ai") return calculateAiScore(b) - calculateAiScore(a);
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "speed") return a.speedRank - b.speedRank;
      return b.rating - a.rating;
    });
  };

  const sortedLegalOffers = sortOffers(
    legalOffers.filter((offer) => !dismissedOfferIds.includes(offer.id)),
  );
  const sortedRoofOffers = sortOffers(
    (incomingOffer ? [incomingOffer, ...roofOffers] : roofOffers).filter(
      (offer) => !dismissedOfferIds.includes(offer.id),
    ),
  );
  const allOffers = [
    ...legalOffers.map((offer) => ({ scenario: "hukuk" as const, offer })),
    ...roofOffers.map((offer) => ({ scenario: "tadilat" as const, offer })),
  ];
  const compareOffers = allOffers.filter(({ scenario, offer }) =>
    selectedOfferIds.includes(buildOfferId(scenario, offer.name)),
  );
  const compareWinner = [...compareOffers].sort(
    (a, b) => calculateAiScore(b.offer) - calculateAiScore(a.offer),
  )[0];
  const chatTemplates = [
    "Merhaba, detayları konuşabilir miyiz?",
    "Fotoğraf gönderebilir misiniz?",
    "Ne zaman müsaitsiniz?",
  ];
  const isDarkMode =
    themePreference === "auto" ? systemPrefersDark : themePreference === "dark";
  const boostProgressCompleted = trustJobsProgress >= 14 && trustCommentsProgress >= 5;
  const themeIcon =
    themePreference === "dark" ? "🌙" : themePreference === "light" ? "☀️" : "🖥️";
  const themeLabel =
    themePreference === "dark"
      ? "Gece"
      : themePreference === "light"
        ? "Gündüz"
        : "Otomatik";

  const sidebarItems = [
    { key: "ai", label: "TeklifAl", icon: "⟳" },
    { key: "basla", label: "Başla", icon: "▶" },
    { key: "avatarlar", label: "Avatarlar", icon: "🙂" },
    { key: "teklifler", label: "Teklifler", icon: "✉" },
    { key: "destek", label: "Destek", icon: "?" },
    { key: "ayarlar", label: "Ayarlar", icon: "⚙" },
    { key: "profilim", label: "Profilim", icon: "👤" },
    { key: "bildirimler", label: "Bildirimler", icon: "🔔" },
    { key: "dosyalarim", label: "Dosyalarım", icon: "📁" },
    { key: "istatistikler", label: "İstatistikler", icon: "📊" },
    { key: "cikis", label: "Çıkış Yap", icon: "⏻" },
  ] as const;

  type SidebarKey = (typeof sidebarItems)[number]["key"];
  const [activeSidebarItem, setActiveSidebarItem] = useState<SidebarKey>("ai");

  const scrollToSection = (id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSidebarClick = (itemKey: SidebarKey) => {
    setActiveSidebarItem(itemKey);

    if (itemKey === "ai") {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    if (itemKey === "basla") {
      setIsFormOpen(true);
      return;
    }

    if (itemKey === "avatarlar") {
      const topOffer = sortedLegalOffers[0] ?? sortedRoofOffers[0] ?? null;
      if (topOffer) {
        setSelectedProvider(topOffer);
      } else {
        setSidebarToastMessage("Gösterilecek profil bulunamadı");
      }
      return;
    }

    if (itemKey === "teklifler") {
      scrollToSection("teklifler-bolumu");
      return;
    }

    if (itemKey === "destek") {
      setIsFeedbackModalOpen(true);
      return;
    }

    if (itemKey === "ayarlar") {
      setIsThemeTransitioning(true);
      setThemePreference((prev) =>
        prev === "auto" ? "dark" : prev === "dark" ? "light" : "auto",
      );
      setSidebarToastMessage("Tema ayarı güncellendi");
      return;
    }

    if (itemKey === "profilim") {
      scrollToSection("profil-karti");
      return;
    }

    if (itemKey === "bildirimler") {
      setInsightTab("weekly");
      setIsSecondaryOpen(true);
      return;
    }

    if (itemKey === "dosyalarim") {
      if (myJobs.length > 0 && !activeJobId) {
        setActiveJobId(myJobs[0].id);
        setActiveJobTitle(myJobs[0].title);
      }
      scrollToSection("dosyalar-paneli");
      return;
    }

    if (itemKey === "istatistikler") {
      setInsightTab("analysis");
      setIsSecondaryOpen(true);
      return;
    }

    if (itemKey === "cikis") {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }

      fetch("/api/auth/logout", {
        method: "POST",
        keepalive: true,
      }).catch(() => {
      }).finally(() => {
        if (typeof window !== "undefined") {
          window.location.replace("/login");
        }
      });

      setAuthToken(null);
      setMyJobs([]);
      setRequestsCount(0);
      setActiveJobId(null);
      setActiveJobTitle(null);
      setChatMessages([]);
      setChatInput("");
      setChatFile(null);
      setSidebarToastMessage("Çıkış yapıldı");
      return;
    }
  };

  return (
    <div
      className={`flex min-h-screen ${
        isDarkMode
          ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50"
          : "bg-gradient-to-br from-slate-100 via-slate-50 to-white text-slate-900"
      } transition-colors duration-[400ms]`}
    >
      <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-950/80 px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-500 text-sm font-semibold text-slate-950">
            B
          </div>
          <div className="text-lg font-semibold tracking-tight">Bağla</div>
        </div>
        <nav className="space-y-1 text-sm">
          {sidebarItems.map((item) => {
            const isActive = activeSidebarItem === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSidebarClick(item.key)}
                className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-slate-300 transition ${
                  isActive
                    ? "bg-slate-900 text-slate-50 shadow-[0_0_24px_rgba(8,47,73,0.75)]"
                    : "hover:bg-slate-900/70"
                }`}
              >
                <span
                  className={`relative flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
                    isActive
                      ? "bg-slate-900 text-cyan-300"
                      : "bg-slate-900 text-slate-200 group-hover:text-cyan-300"
                  }`}
                >
                  {item.key === "ai" && isActive && (
                    <span className="pointer-events-none absolute inset-[-4px] rounded-full border border-cyan-400/70 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
                  )}
                  {item.key === "ai" && isActive && (
                    <span className="pointer-events-none absolute inset-[-8px] rounded-full border-t-2 border-cyan-400/80 animate-spin" />
                  )}
                  <span className="relative">{item.icon}</span>
                </span>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 text-xs text-slate-400">
          <div className="rounded-xl bg-slate-900/80 px-3 py-2">
            <div className="flex items-center justify-between">
              <span>Aktif tedarikçi</span>
              <span className="text-sky-300">
                {providers.length.toString().padStart(2, "0")}+
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Toplam talep</span>
              <span className="text-emerald-300">
                {requestsCount.toString().padStart(2, "0")}+
              </span>
            </div>
          </div>
          <div id="profil-karti" className="flex items-center gap-2 px-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-emerald-500 text-xs font-semibold text-slate-950">
              KT
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-100">
                Kurumsal hesap
              </div>
              <div className="text-[10px] text-slate-500">TeklifAl B2B demo</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-500 text-xs font-semibold text-slate-950">
                B
              </div>
              <div className="text-sm font-semibold tracking-tight">Bağla</div>
            </div>
            <div className="hidden flex-col text-xs text-slate-400 sm:flex">
              <span>Seçtiğin şehir</span>
              <label className="mt-1 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-100">
                <select
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value)}
                  className="bg-transparent text-[11px] text-slate-100 outline-none"
                >
                  {cityOptions.map((city) => (
                    <option key={city} value={city} className="bg-slate-900 text-slate-100">
                      {city}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500">▼</span>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!authToken && (
              <>
                <Link
                  href="/login"
                  className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:border-sky-500 hover:text-sky-200"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-sky-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
                >
                  Kayıt Ol
                </Link>
              </>
            )}
            <div className="group relative hidden sm:block">
              <button
                type="button"
                onClick={() =>
                  {
                    setIsThemeTransitioning(true);
                    setThemePreference((prev) =>
                      prev === "auto" ? "dark" : prev === "dark" ? "light" : "auto",
                    );
                  }
                }
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-100"
              >
                {themeIcon} {themeLabel}
                {themePreference === "auto" && (
                  <span className="ml-1 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] text-blue-300">
                    AI
                  </span>
                )}
              </button>
              <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-44 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 shadow-xl group-hover:block">
                Gece modu gözleri korur, otomatik sistem temana uyar.
              </div>
            </div>
            <button
              type="button"
              className="hidden rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:border-sky-500 hover:text-sky-200 sm:inline-flex"
            >
              İndir
            </button>
            <button
              type="button"
              onClick={() => setIsSecondaryOpen(true)}
              className="relative flex h-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-300"
            >
              İçgörüler
              <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                3
              </span>
            </button>
          </div>
        </header>
        <section className="flex flex-1 items-stretch justify-center px-3 py-4 pb-24 sm:px-6 md:px-10 md:py-8 md:pb-8">
          <div className="relative flex w-full max-w-6xl gap-4">
            <div className="flex-1 space-y-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/85 p-5 shadow-[0_0_48px_rgba(15,23,42,0.75)] sm:p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Aradığını bul
                </div>
                <div className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                  Hizmet türünü seç ve bağlan
                </div>
                <div className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                  Ev, işyeri veya endüstriyel tüm ihtiyaçların için tek panel.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#00F0FF] to-[#00FF9D] px-4 py-2 text-[11px] font-semibold text-slate-950 shadow-md shadow-[#00F0FF]/30 transition-all duration-200 hover:scale-[1.02] hover:from-[#6EF7FF] hover:to-[#61FFC2]"
              >
                Teklif talebi oluştur
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2.5 sm:px-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm text-slate-200">
                🔍
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Aradığın hizmeti yaz (örn. ev aletleri tamiri, elektrikçi, hukuk danışmanlık)"
                className="h-8 flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500 sm:text-sm"
              />
              <button
                type="button"
                className="hidden rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900 sm:inline-flex"
              >
                Ara
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={(e) => {e.stopPropagation(); handleCategoryClick(cat);}}
                  className="group relative flex h-36 flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left shadow-[0_0_24px_rgba(15,23,42,0.85)] transition-all duration-200 hover:scale-[1.01] hover:border-[#00F0FF]/70 hover:bg-slate-900 hover:shadow-[0_0_16px_rgba(0,240,255,0.18)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-lg">
                      {cat.icon}
                    </div>
                    <div
                      className={`h-8 w-1 rounded-full ${
                        cat.color === "blue"
                          ? "bg-gradient-to-b from-sky-400 to-cyan-500"
                          : cat.color === "green"
                            ? "bg-gradient-to-b from-emerald-400 to-lime-400"
                            : cat.color === "red"
                              ? "bg-gradient-to-b from-red-400 to-pink-400"
                              : cat.color === "orange"
                                ? "bg-gradient-to-b from-amber-400 to-orange-400"
                                : cat.color === "purple"
                                  ? "bg-gradient-to-b from-purple-400 to-pink-400"
                                  : cat.color === "pink"
                                    ? "bg-gradient-to-b from-pink-400 to-rose-400"
                                    : cat.color === "cyan"
                                      ? "bg-gradient-to-b from-cyan-400 to-blue-400"
                                      : "bg-gradient-to-b from-lime-400 to-green-400"
                      }`}
                    />
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-slate-50 sm:text-base">
                      {cat.name}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                      {cat.description}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>AI skor ortalaması</span>
                    <span className="font-semibold text-sky-300">
                      %{cat.aiScore}
                    </span>
                  </div>
                  <span className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent opacity-0 transition group-hover:border-sky-400/60 group-hover:opacity-100" />
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Sol menüden tekliflerini, tedarikçilerini ve yüklediğin dosyaları
                yönetebilirsin.
              </span>
              <span className="hidden rounded-full bg-slate-900/80 px-3 py-1 text-[10px] text-slate-300 sm:inline-block">
                Arayüz, Android ve iOS için ortak API ile tasarlandı.
              </span>
            </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section id="teklifler-bolumu" className="rounded-3xl border border-slate-800 bg-slate-950/85 p-4 shadow-[0_0_40px_rgba(15,23,42,0.75)] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        Örnek Talep • Hukuk
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-slate-50 sm:text-base">
                        Hukuk Danışmanlığı Teklifleri
                      </h3>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                      3 yeni teklif
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-[10px]">
                    <span className="text-slate-400">
                      Karşılaştırma seçimi: {selectedOfferIds.length}/3
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCompareOpen(true)}
                      disabled={selectedOfferIds.length < 2}
                      className="rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#FF6B00] px-2 py-1 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Karşılaştır
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-[11px] text-slate-300">
                    <div className="font-medium text-slate-100">
                      Boşanma davası • Mal paylaşımı + velayet
                    </div>
                    <div className="mt-1 text-slate-400">
                      Konum: İzmir / Bornova • Bütçe: 15.000 TL - 35.000 TL • Kalan süre: 5 gün
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <span className="text-[10px] text-slate-400">Sırala</span>
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(
                          e.target.value as
                            | "ai"
                            | "price-asc"
                            | "price-desc"
                            | "rating"
                            | "speed",
                        )
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 outline-none"
                    >
                      <option value="ai">TeklifAl Önerisi</option>
                      <option value="price-asc">Fiyata göre (artan)</option>
                      <option value="price-desc">Fiyata göre (azalan)</option>
                      <option value="rating">Puana göre</option>
                      <option value="speed">Hıza göre</option>
                    </select>
                  </div>

                  {liveOfferBadgeVisible && (
                    <div className="mt-3 rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF10] px-3 py-2 text-[10px] text-[#00F0FF] animate-pulse">
                      🔔 Yeni teklif geldi! Kartlar canlı olarak güncellendi.
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    {sortedLegalOffers.map((offer) => (
                      <article
                        key={offer.name}
                        onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
                        onTouchEnd={(e) => {
                          if (touchStartX == null) return;
                          const endX = e.changedTouches[0]?.clientX ?? touchStartX;
                          handleCardSwipe(offer, endX - touchStartX);
                          setTouchStartX(null);
                        }}
                        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 transition-all duration-200 hover:scale-[1.005] hover:border-[#00F0FF]/65 hover:shadow-[0_0_16px_rgba(0,240,255,0.16)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedProvider(offer)}
                            className="text-[11px] font-semibold text-slate-100 hover:text-[#00F0FF]"
                          >
                            {offer.name}
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                              {offer.badge}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedOfferIds.includes(buildOfferId("hukuk", offer.name))}
                              onChange={() => toggleOfferSelection("hukuk", offer)}
                              className="h-3.5 w-3.5 accent-[#00F0FF]"
                              aria-label={`${offer.name} karşılaştırma seç`}
                            />
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                          <span>
                            ★ {offer.rating} ({offer.reviews} yorum)
                          </span>
                          <span>{offer.eta}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-200">{formatTl(offer.price)}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{offer.note}</div>
                        <div className="mt-1 text-[10px] text-[#00FF9D]">
                          Neden bu? Bütçene yakın + puanı yüksek + hızlı dönüş
                        </div>
                        <div className="relative mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const key = `legal-${offer.name}`;
                              setChatHintKey(key);
                              setRippleKey(key);
                            }}
                            className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8F3A] px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-md shadow-[#FF6B00]/20 transition-all duration-200 hover:scale-[1.01] hover:from-[#FF8126] hover:to-[#FFA95E]"
                          >
                            {rippleKey === `legal-${offer.name}` && <span className="ripple-effect" />}
                            Sohbete Başla
                          </button>
                          <div className="mt-1 text-[9px] text-slate-400">💬 Ücretsiz konuş</div>
                          {chatHintKey === `legal-${offer.name}` && (
                            <div className="tooltip-fade absolute right-0 top-full z-10 mt-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 shadow-xl">
                              Kapora ödemeden önce konuş, %100 ücretsiz
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openPaymentFlow(offer)}
                          className="mt-2 w-full rounded-xl border border-[#00FF9D]/40 bg-[#00FF9D10] px-3 py-2 text-[11px] font-semibold text-[#00FF9D] hover:border-[#00FF9D]"
                        >
                          Kabul Et & Kapora Öde
                        </button>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {chatTemplates.map((template) => (
                            <button
                              key={`${offer.name}-${template}`}
                              type="button"
                              className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-[#00F0FF] hover:text-[#00F0FF]"
                            >
                              {template}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="mt-3 rounded-2xl border border-[#00FF9D]/40 bg-[#00FF9D10] p-3 text-[10px] text-white">
                    <div className="flex items-start gap-2">
                      <span className="text-sm">🤖</span>
                      <div className="flex-1">
                        <div className="font-semibold text-[#00FF9D] text-[11px]">AI tarafından önerildi</div>
                        <div className="mt-1">Ortalama teklif 26.800 TL • En hızlı hazırlık 5 gün • En güvenli aday Av. Elif Kaya</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-800 bg-slate-950/85 p-4 shadow-[0_0_40px_rgba(15,23,42,0.75)] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        Senaryo 02 • Tadilat
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-slate-50 sm:text-base">
                        Çatı tamiri için ustalardan teklif bekleme
                      </h3>
                    </div>
                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-[10px] font-semibold text-orange-300">
                      12 teklif
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-[10px]">
                    <span className="text-slate-400">
                      Karşılaştırma seçimi: {selectedOfferIds.length}/3
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCompareOpen(true)}
                      disabled={selectedOfferIds.length < 2}
                      className="rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#FF6B00] px-2 py-1 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Karşılaştır
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-[11px] text-slate-300">
                    <div className="font-medium text-slate-100">
                      Kiremit çatı akıtıyor • 120m² acil onarım
                    </div>
                    <div className="mt-1 text-slate-400">
                      Konum: İzmir / Karşıyaka • Bütçe: 4.000 TL - 8.000 TL • Başlangıç: 1-3 gün
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <span className="text-[10px] text-slate-400">Sırala</span>
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(
                          e.target.value as
                            | "ai"
                            | "price-asc"
                            | "price-desc"
                            | "rating"
                            | "speed",
                        )
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 outline-none"
                    >
                      <option value="ai">TeklifAl Önerisi</option>
                      <option value="price-asc">Fiyata göre (artan)</option>
                      <option value="price-desc">Fiyata göre (azalan)</option>
                      <option value="rating">Puana göre</option>
                      <option value="speed">Hıza göre</option>
                    </select>
                  </div>

                  <div className="mt-3 space-y-2">
                    {sortedRoofOffers.map((offer) => (
                      <article
                        key={offer.name}
                        onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
                        onTouchEnd={(e) => {
                          if (touchStartX == null) return;
                          const endX = e.changedTouches[0]?.clientX ?? touchStartX;
                          handleCardSwipe(offer, endX - touchStartX);
                          setTouchStartX(null);
                        }}
                        className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-3 transition-all duration-200 hover:scale-[1.005] hover:border-[#FF6B00]/65 hover:shadow-[0_0_16px_rgba(255,107,0,0.16)] ${
                          incomingOffer?.id === offer.id
                            ? "animate-[tooltipFade_1s_ease] border-[#00F0FF]/60"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedProvider(offer)}
                            className="text-[11px] font-semibold text-slate-100 hover:text-[#00F0FF]"
                          >
                            {offer.name}
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[10px] text-fuchsia-300">
                              {offer.badge}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedOfferIds.includes(buildOfferId("tadilat", offer.name))}
                              onChange={() => toggleOfferSelection("tadilat", offer)}
                              className="h-3.5 w-3.5 accent-[#00F0FF]"
                              aria-label={`${offer.name} karşılaştırma seç`}
                            />
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                          <span>
                            ★ {offer.rating} ({offer.jobs} iş)
                          </span>
                          <span>{offer.eta}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-200">{formatTl(offer.price)}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{offer.note}</div>
                        <div className="mt-1 text-[10px] text-[#00FF9D]">
                          Neden bu? Mahallene yakın + hızlı ekip + bütçe uyumu yüksek
                        </div>
                        <div className="relative mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const key = `roof-${offer.name}`;
                              setChatHintKey(key);
                              setRippleKey(key);
                            }}
                            className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8F3A] px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-md shadow-[#FF6B00]/20 transition-all duration-200 hover:scale-[1.01] hover:from-[#FF8126] hover:to-[#FFA95E]"
                          >
                            {rippleKey === `roof-${offer.name}` && <span className="ripple-effect" />}
                            Sohbete Başla
                          </button>
                          <div className="mt-1 text-[9px] text-slate-400">💬 Ücretsiz konuş</div>
                          {chatHintKey === `roof-${offer.name}` && (
                            <div className="tooltip-fade absolute right-0 top-full z-10 mt-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 shadow-xl">
                              Kapora ödemeden önce konuş, %100 ücretsiz
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openPaymentFlow(offer)}
                          className="mt-2 w-full rounded-xl border border-[#00FF9D]/40 bg-[#00FF9D10] px-3 py-2 text-[11px] font-semibold text-[#00FF9D] hover:border-[#00FF9D]"
                        >
                          Kabul Et & Kapora Öde
                        </button>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {chatTemplates.map((template) => (
                            <button
                              key={`${offer.name}-${template}`}
                              type="button"
                              className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-[#00F0FF] hover:text-[#00F0FF]"
                            >
                              {template}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="mt-3 rounded-2xl border border-[#00FF9D]/40 bg-[#00FF9D10] p-3 text-[10px] text-white">
                    <div className="flex items-start gap-2">
                      <span className="text-sm">🤖</span>
                      <div className="flex-1">
                        <div className="font-semibold text-[#00FF9D] text-[11px]">AI tarafından önerildi</div>
                        <div className="mt-1">Piyasa analizi: Karşıyaka 30 gün ort. 5.600 TL • Teklifler %8 avantajlı</div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-3xl border border-slate-800 bg-slate-950/85 p-4 shadow-[0_0_35px_rgba(15,23,42,0.75)] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      Kullanıcı Paneli
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-slate-50 sm:text-base">
                      Profil özeti • güven skoru • aktif işler
                    </h3>
                  </div>
                  <div className="group relative flex items-center gap-3">
                    <div className="relative h-20 w-20">
                      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64" aria-label="Güven skoru göstergesi">
                        <defs>
                          <linearGradient id="trustGaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00FF9D" stopOpacity="0.85" />
                            <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.85" />
                          </linearGradient>
                        </defs>
                        <circle cx="32" cy="32" r="26" stroke="rgb(51 65 85)" strokeWidth="8" fill="none" />
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="url(#trustGaugeGradient)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray={163.36}
                          strokeDashoffset={163.36 - (163.36 * gaugeProgress) / 100}
                          style={{ transition: "stroke-dashoffset 1s ease" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-bold text-white">{Math.round(gaugeProgress)}</div>
                        <div className="text-[10px] text-slate-400">/100</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-300">
                      <div className="font-semibold text-emerald-300">Güven skoru</div>
                      <div>{Math.round(gaugeProgress)}/100</div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 text-[10px] text-slate-300"
                    >
                      i
                    </button>
                    <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-64 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-200 shadow-xl group-hover:block">
                      92/100 • Kimlik doğrulandı • Son 30 işte %98 memnuniyet.
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="text-[10px] text-slate-400">Açık taleplerim</div>
                    <div className="mt-1 text-lg font-semibold text-slate-100">4</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="text-[10px] text-slate-400">Gelen teklif</div>
                    <div className="mt-1 text-lg font-semibold text-sky-300">27</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                    <div className="text-[10px] text-slate-400">Tamamlanan iş</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-300">13</div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="text-[11px] font-semibold text-slate-100">Bugünkü Öneriler</div>
                  <div className="mt-1 text-[10px] text-slate-300">
                    En yüksek potansiyelli talebin: <span className="text-[#00FF9D]">Çatı tamiri</span> – 12 teklif, ortalama 5.600 TL.
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-100">Güven Skoru Artır</div>
                    <button
                      type="button"
                      onClick={() => {
                        setTrustJobsProgress((prev) => Math.min(14, prev + 1));
                        setTrustCommentsProgress((prev) => Math.min(5, prev + 2));
                        if (!trustBadgeUnlocked) {
                          setTrustBadgeUnlocked(true);
                          setGaugeProgress(97);
                        }
                      }}
                      className="rounded-lg border border-[#00F0FF]/40 px-2 py-1 text-[10px] text-[#00F0FF]"
                    >
                      Başlat
                    </button>
                  </div>
                  <div className="mt-2 space-y-2 text-[10px] text-slate-300">
                    <div>
                      <div className="flex items-center justify-between">
                        <span>Kimlik doğrula (Tamamlandı)</span>
                        <span className="text-[#00FF9D]">✓</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                        <div className="h-full w-full rounded-full bg-[#00FF9D]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span>1 iş daha tamamla</span>
                        <span>{trustJobsProgress}/14</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-[#00F0FF] transition-all"
                          style={{ width: `${(trustJobsProgress / 14) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span>5 yorum al</span>
                        <span>{trustCommentsProgress}/5</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-[#FF6B00] transition-all"
                          style={{ width: `${(trustCommentsProgress / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {boostProgressCompleted && (
                    <div className="mt-2 rounded-xl border border-[#00FF9D]/50 bg-[#00FF9D10] px-2 py-1 text-[10px] text-white animate-pulse">
                      +5 puan! Yeni skor: 97/100 • Badge kazanıldı: Güven Elçisi
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div id="dosyalar-paneli" className="hidden w-80 flex-shrink-0 flex-col rounded-3xl border border-slate-800 bg-slate-950/85 p-4 text-[11px] text-slate-200 shadow-[0_0_40px_rgba(15,23,42,0.75)] lg:flex">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold text-slate-50">Taleplerim</div>
                <div className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
                  {requestsCount.toString().padStart(2, "0")} açık
                </div>
              </div>
              {myJobs.length === 0 ? (
                <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-[11px] text-slate-300">
                  <div className="relative mx-auto mb-3 grid h-20 w-20 place-items-center rounded-2xl border border-slate-700 bg-slate-950/80">
                    <span className="text-4xl">👷‍♂️</span>
                    <span className="absolute -right-1 -top-1 text-2xl animate-bounce">👋</span>
                  </div>
                  <div className="text-center text-slate-100">
                    <span className="inline-block animate-pulse">Hadi ilk talebi oluşturalım!</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(true)}
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-3 py-2 text-[11px] font-semibold text-slate-950 shadow-md shadow-emerald-500/30 hover:from-sky-400 hover:to-emerald-400"
                  >
                    Talep Oluştur
                  </button>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto pb-1">
                  {myJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => {
                        setActiveJobId(job.id);
                        setActiveJobTitle(job.title);
                      }}
                      className={`cursor-pointer rounded-2xl border px-3 py-2 ${
                        activeJobId === job.id
                          ? "border-sky-500 bg-slate-900"
                          : "border-slate-800 bg-slate-900/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="line-clamp-1 text-[11px] font-semibold text-slate-50">
                          {job.title}
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            job.status === "open"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : job.status === "assigned"
                                ? "bg-sky-500/10 text-sky-300"
                                : "bg-slate-700/40 text-slate-300"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="line-clamp-1">
                          {job.city} • {job.category}
                        </span>
                        <span>
                          {job._count?.offers != null
                            ? `${job._count.offers} teklif`
                            : "0 teklif"}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {job.budgetMin || job.budgetMax
                          ? `Bütçe: ${
                              job.budgetMin ? formatTl(job.budgetMin) : "? TL"
                            } - ${
                              job.budgetMax ? formatTl(job.budgetMax) : "? TL"
                            }`
                          : "Bütçe belirtilmedi"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeJobId && (
                <div className="mt-3 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-100">
                      Sohbet • {activeJobTitle}
                    </div>
                    {isChatLoading && (
                      <div className="text-[10px] text-slate-400">
                        Yükleniyor...
                      </div>
                    )}
                  </div>
                  <div className="mb-2 h-40 space-y-1 overflow-y-auto rounded-xl bg-slate-950/80 p-2 text-[11px]">
                    {chatMessages.length === 0 ? (
                      <div className="text-[10px] text-slate-500">
                        Bu iş için henüz mesaj yok. İlk mesajı sen yazabilirsin.
                      </div>
                    ) : (
                      chatMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            m.isMine ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-1.5 ${
                              m.isMine
                                ? "bg-sky-500 text-slate-950"
                                : "bg-slate-800 text-slate-100"
                            }`}
                          >
                            {m.attachmentUrl &&
                              m.attachmentType?.startsWith("image/") && (
                                <img
                                  src={m.attachmentUrl}
                                  alt="Ek"
                                  className="mb-1 max-h-40 w-full rounded-xl object-cover"
                                />
                              )}
                            {m.attachmentUrl &&
                              !m.attachmentType?.startsWith("image/") && (
                                <a
                                  href={m.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mb-1 block text-[10px] underline"
                                >
                                  Ek dosyayı aç
                                </a>
                              )}
                            {m.text && (
                              <div className="whitespace-pre-wrap text-[11px]">
                                {m.text}
                              </div>
                            )}
                          </div>
                          {m.isMine && (
                            <div className="mt-0.5 text-[9px] text-slate-400">
                              {m.readAt ? "Görüldü" : "Gönderildi"}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Mesaj yaz..."
                      className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) =>
                        setChatFile(e.target.files?.[0] ?? null)
                      }
                      className="w-28 text-[9px] text-slate-400 file:mr-1 file:rounded-md file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-[9px] file:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={
                        isChatSending || (!chatInput.trim() && !chatFile)
                      }
                      className="rounded-lg bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Gönder
                    </button>
                  </div>
                  {chatFile && (
                    <div className="mt-1 text-[9px] text-slate-400">
                      Seçilen dosya: {chatFile.name}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {isFormOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-3 py-4 sm:px-4 sm:py-8" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}>
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/95 shadow-[0_0_48px_rgba(15,23,42,0.75)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-800 px-5 py-3 pr-10 text-xs text-slate-300 sticky top-0 bg-slate-950/95 z-0 relative">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-slate-100 active:bg-slate-500 cursor-pointer transition-all duration-150 shadow-lg text-base font-bold"
              >
                ✕
              </button>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-slate-100">
                  Teklif Al • B2B Yapay Zeka Asistanı
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Canlı demo
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                İhtiyacını yaz, AI açıklamanı analiz etsin ve doğru tedarikçiyle
                buluştursun.
              </div>
              {form.categoryId && (() => {
                const selectedCategory = allCategories.find(c => c.id === form.categoryId);
                return selectedCategory ? (
                  <div className="mt-2 rounded-lg bg-slate-900/50 border border-sky-500/30 p-2">
                    <div className="text-[10px] text-slate-400">Seçilen hizmet:</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg">{selectedCategory.icon}</span>
                      <div>
                        <div className="font-semibold text-slate-100">{selectedCategory.name}</div>
                        <div className="text-[10px] text-slate-400">{selectedCategory.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, categoryId: "" }))}
                        className="ml-auto text-[10px] text-slate-400 hover:text-slate-200"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : null;
              })()}
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
                  placeholder="Örn: Ev aletleri tamiri ve bakım"
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
                  placeholder="Cihaz türü, marka, arıza durumu, lokasyon ve zaman planını yaz."
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
                    {allCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
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
                    placeholder="Örn: 1000"
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
                    placeholder="Örn: 5000"
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
                {isSubmitting
                  ? "Talebin oluşturuluyor..."
                  : "Teklif al • 3 dakikada talep oluştur"}
              </button>

              <div className="pb-1 text-[10px] text-slate-500">
                Demo versiyon: Talebin demo alıcı hesabıyla veritabanına kaydedilir ve
                AI motoru heuristik olarak çalışır.
              </div>
            </form>

            <div className="border-t border-slate-800 bg-slate-950/80 px-5 py-3">
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
        </div>
      )}

      {isCompareOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 px-0 md:items-center md:px-3">
          <div className="h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-950 p-4 shadow-[0_0_48px_rgba(0,0,0,0.5)] md:h-auto md:max-w-4xl md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">Teklif Karşılaştırma</div>
                <div className="text-[11px] text-slate-400">2-3 teklifi yan yana değerlendir</div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareOpen(false)}
                className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-300"
              >
                ✕
              </button>
            </div>

            {compareWinner && (
              <div className="mb-3 rounded-xl border border-[#00FF9D]/60 bg-[#00FF9D15] px-3 py-2 text-[11px] text-white">
                <span className={`${isReducedMotion ? "" : "winner-badge-pop"} rounded-full bg-[#00FF9D]/20 px-2 py-0.5 text-[10px] font-semibold text-[#00FF9D]`}>
                  TeklifAl&apos;ın En İyisi
                </span>
                <div className="mt-1">
                  <span className="font-semibold text-[#00FF9D]">Kazanan Teklif:</span>{" "}
                  {compareWinner.offer.name} • {getWinnerReason(compareWinner.offer)}
                </div>
              </div>
            )}

            <div className="hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-slate-900/80 text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Kriter</th>
                    {compareOffers.map(({ scenario, offer }) => (
                      <th key={buildOfferId(scenario, offer.name)} className="px-3 py-2 text-slate-100">
                        {offer.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  <tr>
                    <td className="px-3 py-2">Fiyat</td>
                    {compareOffers.map(({ scenario, offer }) => (
                      <td key={`price-${buildOfferId(scenario, offer.name)}`} className="px-3 py-2">
                        {formatTl(offer.price)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Süre</td>
                    {compareOffers.map(({ scenario, offer }) => (
                      <td key={`eta-${buildOfferId(scenario, offer.name)}`} className="px-3 py-2">
                        {offer.eta}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Puan</td>
                    {compareOffers.map(({ scenario, offer }) => (
                      <td key={`rating-${buildOfferId(scenario, offer.name)}`} className="px-3 py-2">
                        {offer.rating}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Ekstra Hizmet</td>
                    {compareOffers.map(({ scenario, offer }) => (
                      <td key={`extra-${buildOfferId(scenario, offer.name)}`} className="px-3 py-2">
                        {offer.extras.join(" • ")}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2">AI Öneri Puanı</td>
                    {compareOffers.map(({ scenario, offer }) => (
                      <td key={`ai-${buildOfferId(scenario, offer.name)}`} className="px-3 py-2 font-semibold text-[#00FF9D]">
                        {Math.round(calculateAiScore(offer))}/100
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-2">
                      <div className="group relative inline-flex items-center gap-1">
                        <span>AI Puanı</span>
                        <span className="cursor-help text-[#00F0FF]">ⓘ</span>
                        <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-72 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 shadow-xl group-hover:block">
                          AI Puanı = (Güven Skoru × 40%) + (Hız × 30%) + (Fiyat Uygunluğu × 20%) + (Ekstra Hizmetler × 10%)
                        </div>
                      </div>
                    </td>
                    {compareOffers.map(({ scenario, offer }) => (
                      <td key={`ai-score-${buildOfferId(scenario, offer.name)}`} className="px-3 py-2 font-semibold text-[#00F0FF]">
                        {Math.round(calculateAiScore(offer))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {compareOffers.map(({ scenario, offer }) => (
                <div
                  key={`mobile-compare-${buildOfferId(scenario, offer.name)}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-2"
                >
                  <div className="text-[11px] font-semibold text-slate-100">
                    {offer.name} • {formatTl(offer.price)}
                  </div>
                  <div className="mt-2 space-y-1 text-[10px] text-slate-300">
                    <button
                      type="button"
                      onClick={() => toggleMobileCompareRow(offer.id, "price")}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 p-1"
                    >
                      <span>₺ Fiyat</span>
                      <span>{mobileAccordionOpen[offer.id]?.price ? "▲" : "▼"}</span>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        mobileAccordionOpen[offer.id]?.price ? "max-h-16 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="px-1 pb-1">{formatTl(offer.price)}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleMobileCompareRow(offer.id, "duration")}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 p-1"
                    >
                      <span>⏱ Süre</span>
                      <span>{mobileAccordionOpen[offer.id]?.duration ? "▲" : "▼"}</span>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        mobileAccordionOpen[offer.id]?.duration ? "max-h-16 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="px-1 pb-1">{offer.eta}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleMobileCompareRow(offer.id, "rating")}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 p-1"
                    >
                      <span>⭐ Puan</span>
                      <span>{mobileAccordionOpen[offer.id]?.rating ? "▲" : "▼"}</span>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        mobileAccordionOpen[offer.id]?.rating ? "max-h-16 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="px-1 pb-1">{offer.rating}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleMobileCompareRow(offer.id, "extras")}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 p-1"
                    >
                      <span>✨ Ekstra Hizmetler</span>
                      <span>{mobileAccordionOpen[offer.id]?.extras ? "▲" : "▼"}</span>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        mobileAccordionOpen[offer.id]?.extras ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <ul className="list-disc px-5 pb-1">
                        {offer.extras.map((item) => (
                          <li key={`${offer.id}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-[#00FF9D]">AI Puanı: {Math.round(calculateAiScore(offer))}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!compareWinner}
                onClick={() => {
                  if (!compareWinner) return;
                  const key = `winner-${compareWinner.offer.name}`;
                  setChatHintKey(key);
                  setRippleKey(key);
                  openPaymentFlow(compareWinner.offer);
                  setIsCompareOpen(false);
                }}
                className="rounded-xl bg-gradient-to-r from-[#00FF9D] to-[#23d77a] px-4 py-2 text-[12px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Bu teklifi seç
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProvider && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-[0_0_48px_rgba(0,0,0,0.5)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-[#00F0FF] to-[#FF6B00] text-lg font-bold text-slate-950">
                  {selectedProvider.name.slice(0, 1)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-100">{selectedProvider.name}</div>
                  <div className="text-[11px] text-slate-400">Kimlik doğrulanmış sağlayıcı</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFavoriteProviderIds((prev) => {
                      const isAlreadyFavorite = prev.includes(selectedProvider.id);
                      if (isAlreadyFavorite) {
                        return prev.filter((id) => id !== selectedProvider.id);
                      }
                      setHeartBurstProviderId(selectedProvider.id);
                      return [...prev, selectedProvider.id];
                    })
                  }
                  className="relative rounded-full border border-[#FF6B00]/40 bg-[#FF6B0010] px-2 py-1 text-xs text-[#FF6B00]"
                >
                  {favoriteProviderIds.includes(selectedProvider.id)
                    ? `♥ Favorilerimde (${favoriteProviderIds.length})`
                    : "♡ Favorilere Ekle"}
                  {heartBurstProviderId === selectedProvider.id && (
                    <span className={`${isReducedMotion ? "" : "heart-burst"} pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-sm`}>
                      💥💖
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider(null)}
                  className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-300"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl border border-slate-800">
                <iframe
                  src={selectedProvider.videoUrl}
                  title={`${selectedProvider.name} video tanıtım`}
                  className="h-44 w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <button
                  type="button"
                  onClick={() => {
                    setVideoBonusEarned(true);
                    setGaugeProgress((prev) => Math.min(100, prev + 2));
                  }}
                  className="absolute inset-x-3 bottom-3 rounded-lg border border-[#00F0FF]/50 bg-black/60 px-3 py-1.5 text-[10px] text-[#00F0FF]"
                >
                  Video İzle ve Güven Kazan (+2 bonus)
                </button>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-[11px] font-semibold text-slate-100">Son İş Galerisi</div>
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {selectedProvider.gallery.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setSelectedGalleryItem(item)}
                      className="min-w-36 rounded-lg border border-slate-700 bg-slate-950 p-2 text-[10px] text-slate-300"
                    >
                      📸 {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {videoBonusEarned && (
              <div className="mt-2 rounded-lg border border-[#00FF9D]/50 bg-[#00FF9D10] px-2 py-1 text-[10px] text-[#00FF9D]">
                Bonus kazanıldı: Güven skoruna +2 eklendi.
              </div>
            )}

            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <button
                type="button"
                onClick={() => setIsTrustAccordionOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-[11px] font-semibold text-slate-100"
              >
                Güven Detayları
                <span>{isTrustAccordionOpen ? "▲" : "▼"}</span>
              </button>
              {isTrustAccordionOpen && (
                <div className="mt-2 space-y-1 text-[10px] text-slate-300">
                  <div>Kimlik doğrulanma tarihi: {selectedProvider.verificationDate}</div>
                  <div>İptal Oranı: {selectedProvider.cancelRate}</div>
                  <div>Ortalama Yanıt Süresi: 1 dk 47 sn</div>
                  <div>Toplam Tamamlanan İş: {selectedProvider.jobs ?? 142}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedGalleryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-3">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Galeri Detayı</div>
              <button
                type="button"
                onClick={() => setSelectedGalleryItem(null)}
                className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-center text-slate-200">
              🔍 {selectedGalleryItem}
            </div>
            <div className="mt-2 flex items-center gap-1 text-yellow-400">
              <span className="star-pop">★</span>
              <span className="star-pop [animation-delay:120ms]">★</span>
              <span className="star-pop [animation-delay:240ms]">★</span>
              <span className="star-pop [animation-delay:360ms]">★</span>
              <span className="star-pop [animation-delay:480ms]">★</span>
              <span className="ml-1 text-[11px] text-slate-200">Bu iş için 4.9/5 puan aldı</span>
            </div>
            <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-[10px] text-slate-300">
              Önceki müşteri yorumu: “Söz verdiği saatte geldi, temiz işçilik yaptı.”
            </div>
          </div>
        </div>
      )}

      {paymentOffer && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 px-0 md:items-center md:px-3">
          <div className="h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-950 p-4 shadow-[0_0_48px_rgba(0,0,0,0.5)] md:h-auto md:max-w-lg md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">Kapora Ödeme Akışı</div>
                <div className="text-[11px] text-slate-400">{paymentOffer.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentOffer(null)}
                className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 text-[10px] text-slate-400">Adım {paymentStep}/3</div>

            {paymentStep === 1 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px] text-slate-300">
                <div className="mb-2">AI öneri: Benzer işlerde <span className="font-semibold text-[#00FF9D]">%18 kapora</span> yeterli.</div>
                <input
                  type="range"
                  min={10}
                  max={40}
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(Number(e.target.value))}
                  className="w-full accent-[#00F0FF]"
                />
                <div className="mt-1">Seçilen kapora (%{depositPercent}): <span className="font-semibold text-white">{formatTl(Math.round(paymentOffer.price * (depositPercent / 100)))}</span></div>
                <label className="mt-2 flex items-center gap-2 text-[10px]">
                  <input
                    type="checkbox"
                    checked={payOnDelivery}
                    onChange={(e) => setPayOnDelivery(e.target.checked)}
                    className="accent-[#00F0FF]"
                  />
                  Tamamı teslimde
                </label>
              </div>
            )}

            {paymentStep === 2 && (
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px] text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="radio" name="gateway" defaultChecked className="accent-[#00F0FF]" /> iyzico
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="gateway" className="accent-[#00F0FF]" /> PayTR
                </label>
              </div>
            )}

            {paymentStep === 3 && (
              <div className="rounded-xl border border-[#00FF9D]/40 bg-[#00FF9D10] p-3 text-[11px] text-white">
                <div className="flex items-center gap-2">
                  <span className={`inline-block ${isReducedMotion ? "" : "animate-pulse"}`}>🛡️</span>
                  <span>10.000 TL&apos;ye kadar iade – TeklifAl üstlenir</span>
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              {paymentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setPaymentStep((prev) => (prev === 1 ? prev : ((prev - 1) as 1 | 2 | 3)))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300"
                >
                  Geri
                </button>
              )}
              {paymentStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setPaymentStep((prev) => (prev === 3 ? prev : ((prev + 1) as 1 | 2 | 3)))}
                  className="rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#FF6B00] px-3 py-1.5 text-[11px] font-semibold text-slate-950"
                >
                  Devam Et
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowConfetti(true);
                    setPaymentOffer(null);
                    setFollowUpScheduled(true);
                    window.setTimeout(() => setIsTemplatePopupOpen(true), 3000);
                  }}
                  className="rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#00FF9D] px-3 py-1.5 text-[11px] font-semibold text-slate-950"
                >
                  Ödemeyi Tamamla
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/20">
          <div className="rounded-2xl border border-[#00FF9D]/40 bg-slate-950/95 px-5 py-4 text-center text-sm text-white shadow-2xl">
            🎉🎉🎉 İş Başladı! Usta ile sohbet odası açıldı. İlk mesajı sen atabilirsin.
          </div>
        </div>
      )}

      {isTemplatePopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-100">İlk Mesaj Şablonu Seç</div>
            <div className="space-y-2">
              {chatTemplates.map((template) => (
                <button
                  key={`post-payment-${template}`}
                  type="button"
                  className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-[11px] text-slate-200 hover:border-[#00F0FF]"
                  onClick={() => {
                    setChatInput(template);
                    setIsTemplatePopupOpen(false);
                  }}
                >
                  {template}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsTemplatePopupOpen(false)}
              className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] text-slate-300"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {showFollowUpPush && (
        <div className="fixed bottom-36 right-3 z-50 max-w-xs rounded-xl border border-[#00F0FF]/40 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-2xl">
          Usta işi bitirdi mi? Onay ver + yorum bırak
          <button
            type="button"
            onClick={() => setShowFollowUpPush(false)}
            className="mt-2 w-full rounded-lg bg-[#00F0FF]/20 px-2 py-1 text-[10px] text-[#00F0FF]"
          >
            İş Tamamlandı mı?
          </button>
        </div>
      )}

      {favoriteToastVisible && (
        <div className="fixed right-3 top-3 z-50 rounded-xl border border-[#00FF9D]/40 bg-slate-950/95 px-3 py-2 text-[11px] text-[#00FF9D] shadow-2xl animate-[tooltipFade_2s_ease]">
          Favorilere eklendi
        </div>
      )}

      {sidebarToastMessage && (
        <div className="fixed right-3 top-16 z-50 rounded-xl border border-[#00F0FF]/40 bg-slate-950/95 px-3 py-2 text-[11px] text-[#00F0FF] shadow-2xl animate-[tooltipFade_2.2s_ease]">
          {sidebarToastMessage}
        </div>
      )}

      {isThemeTransitioning && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-white/5 backdrop-blur-[1px] animate-[tooltipFade_0.4s_ease]" />
      )}

      {isSecondaryOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-0 md:items-center md:px-3">
          <div className="h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-950 p-4 md:h-auto md:max-w-xl md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">İçgörüler</div>
              <button
                type="button"
                onClick={() => setIsSecondaryOpen(false)}
                className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => setInsightTab("weekly")}
                className={`rounded-lg px-2 py-1.5 ${
                  insightTab === "weekly"
                    ? "bg-[#00F0FF]/20 text-[#00F0FF]"
                    : "bg-slate-900 text-slate-300"
                }`}
              >
                Haftalık Özet
              </button>
              <button
                type="button"
                onClick={() => setInsightTab("analysis")}
                className={`rounded-lg px-2 py-1.5 ${
                  insightTab === "analysis"
                    ? "bg-[#00F0FF]/20 text-[#00F0FF]"
                    : "bg-slate-900 text-slate-300"
                }`}
              >
                Analiz
              </button>
              <button
                type="button"
                onClick={() => setInsightTab("feedback")}
                className={`rounded-lg px-2 py-1.5 ${
                  insightTab === "feedback"
                    ? "bg-[#00F0FF]/20 text-[#00F0FF]"
                    : "bg-slate-900 text-slate-300"
                }`}
              >
                Geri Bildirim
              </button>
            </div>

            <div className="space-y-3 text-[10px] text-slate-300">
              {insightTab === "weekly" && (
                <>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.6s_ease]">
                    <div className="font-semibold text-slate-100">Haftalık Özet</div>
                    <div>27 yeni teklif, +3 güven puanı.</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.7s_ease]" style={{ animationDelay: "100ms" }}>
                    <div className="font-semibold text-slate-100">Yeni İş Akışı</div>
                    <div>3 yeni teklif talep edildi, 2 cevaplandı (%67 yanıt oranı)</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.8s_ease]" style={{ animationDelay: "200ms" }}>
                    <div className="font-semibold text-slate-100">Güven Skoru</div>
                    <div>+3 puan kazandı. Şu an 92/100 seviyesi.</div>
                  </div>
                </>
              )}
              {insightTab === "analysis" && (
                <>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.6s_ease]">
                    <div className="font-semibold text-slate-100">Analiz</div>
                    <div>Kullanıcı davranış analizi: En çok tıklanan kart – Usta Ali (142 iş)</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.7s_ease]" style={{ animationDelay: "100ms" }}>
                    <div className="font-semibold text-slate-100">Piyasa Trendi</div>
                    <div>Tadilat taleplerinde %12 artış, ortalama fiyat ±%3 değişim</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.8s_ease]" style={{ animationDelay: "200ms" }}>
                    <div className="font-semibold text-slate-100">Rakip Durumu</div>
                    <div>Bölgedeki 45 sağlayıcıdan %82&apos;si aktif</div>
                  </div>
                </>
              )}
              {insightTab === "feedback" && (
                <>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.6s_ease]">
                    <div className="font-semibold text-slate-100">Geri Bildirim</div>
                    <button
                      type="button"
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="mt-2 rounded-lg bg-[#00F0FF]/20 px-3 py-1 text-[10px] text-[#00F0FF]"
                    >
                      İş sonu anketi aç
                    </button>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.7s_ease]" style={{ animationDelay: "100ms" }}>
                    <div className="font-semibold text-slate-100">Memnuniyet Oranı</div>
                    <div>Son 5 işde ortalama 4.8/5 yıldız aldı</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 animate-[slideInLeft_0.8s_ease]" style={{ animationDelay: "200ms" }}>
                    <div className="font-semibold text-slate-100">Tavsiyelere Yanıtlar</div>
                    <div>&quot;Hızlı, güvenilir ve iyi fiyatlı&quot; – müşteri yorum</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 backdrop-blur-[8px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">İş Sonu Anket</div>
              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(false)}
                className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setPostJobRating(star)}
                  className={star <= postJobRating ? "text-yellow-400" : "text-slate-500"}
                >
                  ★
                </button>
              ))}
            </div>
            <input
              value={postJobComment}
              onChange={(e) => setPostJobComment(e.target.value)}
              placeholder="Kısa yorum..."
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200"
            />
            <label className="mt-2 flex items-center gap-2 text-[10px] text-slate-300">
              <input
                type="checkbox"
                checked={isAnonymousSuggestion}
                onChange={(e) => setIsAnonymousSuggestion(e.target.checked)}
                className="accent-[#00F0FF]"
              />
              Bağla&apos;ya önerin var mı?
            </label>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-2 py-2 text-[11px] text-slate-300 md:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {sidebarItems.map((item) => {
            const isActive = activeSidebarItem === item.key;
            return (
              <button
                key={`mobile-${item.key}`}
                type="button"
                onClick={() => handleSidebarClick(item.key)}
                className={`flex min-w-[76px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition ${
                  isActive
                    ? "bg-slate-900 text-sky-300"
                    : "text-slate-300 hover:bg-slate-900/70"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span className="line-clamp-1 text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
