export type UserRole = "buyer" | "provider";

export type ServiceCategoryId =
  | "tadilat"
  | "nakliye"
  | "temizlik"
  | "beyaz-esya"
  | "bilisim"
  | "diger";

export interface ServiceCategory {
  id: ServiceCategoryId;
  name: string;
  description: string;
  icon: string;
}

export interface BuyerProfile {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  sector?: string;
  size?: "startup" | "kobi" | "kurumsal";
}

export interface ProviderProfile {
  id: string;
  companyName: string;
  email: string;
  phone?: string;
  sectors: string[];
  categories: ServiceCategoryId[];
  city: string;
  rating: number;
  completedJobs: number;
  minBudget: number;
  maxBudget: number;
  aiScore: number;
}

export type RequestStatus = "draft" | "open" | "matched" | "closed";

export interface QuoteRequest {
  id: string;
  buyerId: string;
  title: string;
  description: string;
  categoryId: ServiceCategoryId;
  city: string;
  budgetMin?: number;
  budgetMax?: number;
  createdAt: string;
  status: RequestStatus;
  aiSummary: string;
  aiTags: string[];
}

export interface AiSuggestionInput {
  description: string;
  categoryId?: ServiceCategoryId;
  city?: string;
}

export interface AiSuggestionResult {
  summary: string;
  tags: string[];
  questions: string[];
  estimatedComplexity: "düşük" | "orta" | "yüksek";
}

