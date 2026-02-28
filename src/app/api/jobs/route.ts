import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { cache } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestContext, logWarn } from "@/lib/logger";

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status") ?? "open";
  const city = searchParams.get("city") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const mine = searchParams.get("mine") === "true";

  let userPayload: { sub: string; role: string } | null = null;
  const token = getTokenFromRequest(req);

  if (token) {
    try {
      userPayload = verifyAccessToken(token);
    } catch {
      userPayload = null;
    }
  }

  if (mine && !userPayload) {
    return NextResponse.json(
      { error: "mine=true için geçerli token zorunludur" },
      { status: 401 },
    );
  }

  let buyerFilter:
    | {
        buyer?: {
          userId: string;
        };
      }
    | undefined;

  let providerFilter:
    | {
        provider?: {
          userId: string;
        };
      }
    | undefined;

  if (mine && userPayload) {
    if (userPayload.role === "buyer") {
      const buyerProfile = await prisma.buyerProfile.findUnique({
        where: { userId: userPayload.sub },
        select: { id: true },
      });

      if (buyerProfile) {
        buyerFilter = {
          buyer: {
            userId: userPayload.sub,
          },
        };
      }
    } else if (userPayload.role === "provider") {
      const providerProfile = await prisma.providerProfile.findUnique({
        where: { userId: userPayload.sub },
        select: { id: true },
      });

      if (providerProfile) {
        providerFilter = {
          provider: {
            userId: userPayload.sub,
          },
        };
      }
    }
  }

  const cacheKey = `jobs:list:${status}:${city ?? "any"}:${category ?? "any"}:${
    mine && userPayload ? userPayload.sub : "public"
  }`;

  const cached = await cache.get<unknown[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached });
  }

  const jobs = await prisma.job.findMany({
    where: {
      status,
      city: city || undefined,
      category: category || undefined,
      ...buyerFilter,
      ...providerFilter,
    },
    orderBy: { createdAt: "desc" },
    include: {
      buyer: {
        select: {
          fullName: true,
          city: true,
          userId: true,
        },
      },
      provider: {
        select: {
          displayName: true,
          city: true,
          userId: true,
        },
      },
      _count: {
        select: { offers: true },
      },
    },
    take: 50,
  });

  await cache.set(cacheKey, jobs, 60);

  return NextResponse.json({ data: jobs });
}

export async function POST(req: NextRequest) {
  const requestContext = getRequestContext(req);
  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme hatası" }, { status: 401 });
  }

  let payload: { sub: string; role: string };
  try {
    payload = verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
  }

  if (payload.role !== "buyer") {
    return NextResponse.json(
      { error: "Yalnızca alıcılar yeni iş oluşturabilir" },
      { status: 403 },
    );
  }

  const rate = await rateLimit(`api:jobs:${payload.sub}`, 100, 3600);

  if (!rate.allowed) {
    const retryAfter =
      rate.resetAt !== null
        ? Math.max(0, Math.ceil((rate.resetAt - Date.now()) / 1000))
        : null;
    const res = NextResponse.json(
      {
        error:
          "İş oluşturma sınırına ulaşıldı, lütfen daha sonra tekrar deneyin",
      },
      { status: 429 },
    );
    res.headers.set("X-RateLimit-Limit", "100");
    res.headers.set("X-RateLimit-Remaining", "0");
    if (retryAfter !== null) {
      res.headers.set("Retry-After", retryAfter.toString());
    }
    logWarn("jobs.create.rate_limited", {
      ...requestContext,
      userId: payload.sub,
      limit: 100,
    });
    return res;
  }

  const createJobSchema = z
    .object({
      title: z
        .string()
        .min(3, { message: "title en az 3 karakter olmalıdır" }),
      description: z
        .string()
        .min(10, { message: "description en az 10 karakter olmalıdır" }),
      category: z
        .string()
        .min(1, { message: "category alanı zorunludur" }),
      city: z.string().min(2, { message: "city alanı zorunludur" }),
      budgetMin: z.number().int().nonnegative().optional(),
      budgetMax: z.number().int().nonnegative().optional(),
    })
    .refine(
      (data) =>
        data.budgetMin === undefined ||
        data.budgetMax === undefined ||
        data.budgetMin <= data.budgetMax,
      {
        path: ["budgetMax"],
        message: "budgetMax, budgetMin değerinden küçük olamaz",
      },
    );

  const body = await req.json().catch(() => null);

  const parsed = createJobSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "Geçersiz istek gövdesi" },
      { status: 400 },
    );
  }

  const { title, description, category, city, budgetMin, budgetMax } =
    parsed.data;

  const buyerProfile = await prisma.buyerProfile.findUnique({
    where: { userId: payload.sub },
    select: { id: true },
  });

  if (!buyerProfile) {
    return NextResponse.json(
      { error: "Alıcı profili bulunamadı" },
      { status: 400 },
    );
  }

  const job = await prisma.job.create({
    data: {
      buyerId: buyerProfile.id,
      title,
      description,
      category,
      city,
      budgetMin,
      budgetMax,
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.sub,
        action: "job_created",
        metadata: JSON.stringify({
          jobId: job.id,
          city: job.city,
          category: job.category,
        }),
      },
    });
  } catch (error) {
    logWarn("audit.job_created.write_failed", {
      ...requestContext,
      userId: payload.sub,
      jobId: job.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  await Promise.all([
    cache.invalidate(`jobs:list:open:${city}:${category}:${payload.sub}`),
    cache.invalidate(`jobs:list:open:${city}:${category}:public`),
    cache.invalidate(`jobs:list:open:any:any:${payload.sub}`),
    cache.invalidate("jobs:list:open:any:any:public"),
  ]);

  const res = NextResponse.json({ data: job }, { status: 201 });
  res.headers.set("X-RateLimit-Limit", "100");
  res.headers.set(
    "X-RateLimit-Remaining",
    Math.max(0, rate.remaining).toString(),
  );
  return res;
}
