import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ServiceCategoryId } from "@/domain/models";

export const dynamic = "force-dynamic";

const SERVICE_CATEGORY_IDS: ServiceCategoryId[] = [
  "ev-aletleri",
  "endustriyel",
  "hukuk",
  "cekici",
  "ev-temizlik",
  "hali-yikama",
  "elektrikci",
  "tesisatci",
];

export async function POST(req: NextRequest) {
  const { getAiSuggestion } = await import("@/lib/data");

  const suggestSchema = z.object({
    description: z
      .string()
      .min(1, { message: "description alanı zorunludur" }),
    categoryId: z
      .string()
      .refine((value) => SERVICE_CATEGORY_IDS.includes(value as ServiceCategoryId), {
        message: "Geçersiz kategori",
      })
      .optional(),
    city: z.string().optional(),
  });

  const body = await req.json().catch(() => null);

  const parsed = suggestSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "Geçersiz istek gövdesi" },
      { status: 400 },
    );
  }

  const result = getAiSuggestion({
    description: parsed.data.description,
    categoryId: parsed.data.categoryId as ServiceCategoryId | undefined,
    city: parsed.data.city,
  });

  return NextResponse.json({
    data: result,
  });
}
