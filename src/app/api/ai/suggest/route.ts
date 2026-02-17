import { NextRequest, NextResponse } from "next/server";
import { getAiSuggestion } from "@/lib/data";
import { AiSuggestionInput } from "@/domain/models";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as AiSuggestionInput | null;

  if (!body || !body.description?.trim()) {
    return NextResponse.json(
      { error: "description alanı zorunludur" },
      { status: 400 },
    );
  }

  const result = getAiSuggestion({
    description: body.description,
    categoryId: body.categoryId,
    city: body.city,
  });

  return NextResponse.json({
    data: result,
  });
}

