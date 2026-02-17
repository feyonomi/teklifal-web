import { NextRequest, NextResponse } from "next/server";
import { addRequest, generateRequestFromInput, getRequests } from "@/lib/data";
import { ServiceCategoryId } from "@/domain/models";

export function GET() {
  return NextResponse.json({
    data: getRequests(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: "Geçersiz istek gövdesi" },
      { status: 400 },
    );
  }

  const { buyerId, title, description, categoryId, city, budgetMin, budgetMax } =
    body as {
      buyerId?: string;
      title?: string;
      description?: string;
      categoryId?: ServiceCategoryId;
      city?: string;
      budgetMin?: number;
      budgetMax?: number;
    };

  if (!buyerId || !title || !description || !categoryId || !city) {
    return NextResponse.json(
      {
        error:
          "buyerId, title, description, categoryId ve city alanları zorunludur",
      },
      { status: 400 },
    );
  }

  const request = generateRequestFromInput({
    buyerId,
    title,
    description,
    categoryId,
    city,
    budgetMin,
    budgetMax,
  });

  addRequest(request);

  return NextResponse.json(
    {
      data: request,
    },
    { status: 201 },
  );
}

