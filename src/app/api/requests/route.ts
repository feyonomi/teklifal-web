import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ServiceCategoryId } from "@/domain/models";

export const dynamic = "force-dynamic";

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function GET(req: NextRequest) {
  const { getRequests } = await import("@/lib/data");

  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme hatası" }, { status: 401 });
  }

  try {
    const { verifyAccessToken } = await import("@/lib/auth");
    verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
  }

  return NextResponse.json({
    data: getRequests(),
  });
}

export async function POST(req: NextRequest) {
  const { addRequest, generateRequestFromInput } = await import("@/lib/data");

  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme hatası" }, { status: 401 });
  }

  let payload: { sub: string; role: string };
  try {
    const { verifyAccessToken } = await import("@/lib/auth");
    payload = verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
  }

  if (payload.role !== "buyer") {
    return NextResponse.json(
      { error: "Yalnızca alıcılar talep oluşturabilir" },
      { status: 403 },
    );
  }

  const requestSchema = z.object({
    buyerId: z.string(),
    title: z
      .string()
      .min(3, { message: "title en az 3 karakter olmalıdır" }),
    description: z
      .string()
      .min(10, { message: "description en az 10 karakter olmalıdır" }),
    categoryId: z.string(),
    city: z.string(),
    budgetMin: z.number().int().nonnegative().optional(),
    budgetMax: z.number().int().nonnegative().optional(),
  });

  const body = await req.json().catch(() => null);

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error:
          issue?.message ||
          "buyerId, title, description, categoryId ve city alanları zorunludur",
      },
      { status: 400 },
    );
  }

  const { buyerId, title, description, categoryId, city, budgetMin, budgetMax } =
    parsed.data;

  if (buyerId !== payload.sub) {
    return NextResponse.json(
      { error: "Talep yalnızca kendi kullanıcı kimliğinizle oluşturulabilir" },
      { status: 403 },
    );
  }

  const request = generateRequestFromInput({
    buyerId,
    title,
    description,
    categoryId: categoryId as ServiceCategoryId,
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
