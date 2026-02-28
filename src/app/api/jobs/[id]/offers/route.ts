import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const [{ prisma }, authLib] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/auth"),
  ]);
  const { verifyAccessToken } = authLib;

  const token = getTokenFromRequest(_req);

  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme hatası" }, { status: 401 });
  }

  let payload: { sub: string; role: string };
  try {
    payload = verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
  }

  const { id: jobId } = await context.params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      buyer: { select: { userId: true } },
      provider: { select: { userId: true } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "İş bulunamadı" }, { status: 404 });
  }

  if (payload.sub !== job.buyer.userId && payload.sub !== job.provider?.userId) {
    return NextResponse.json({ error: "Bu işe ait teklifleri görme yetkiniz yok" }, { status: 403 });
  }

  const offers = await prisma.offer.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    include: {
      provider: {
        select: {
          displayName: true,
          city: true,
          averageRating: true,
          completedJobs: true,
        },
      },
    },
  });

  return NextResponse.json({ data: offers });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const [{ prisma }, authLib, rateLimitLib, emailServiceLib, loggerLib] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/auth"),
    import("@/lib/rate-limit"),
    import("@/lib/email-service"),
    import("@/lib/logger"),
  ]);
  const { verifyAccessToken } = authLib;
  const { rateLimit } = rateLimitLib;
  const { queueNewOfferEmail } = emailServiceLib;
  const { getRequestContext, logWarn } = loggerLib;

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

  if (payload.role !== "provider") {
    return NextResponse.json(
      { error: "Yalnızca hizmet verenler teklif oluşturabilir" },
      { status: 403 },
    );
  }

  const rate = await rateLimit(`api:offers:${payload.sub}`, 100, 3600);

  if (!rate.allowed) {
    const retryAfter =
      rate.resetAt !== null
        ? Math.max(0, Math.ceil((rate.resetAt - Date.now()) / 1000))
        : null;
    const res = NextResponse.json(
      {
        error:
          "Teklif oluşturma sınırına ulaşıldı, lütfen daha sonra tekrar deneyin",
      },
      { status: 429 },
    );
    res.headers.set("X-RateLimit-Limit", "100");
    res.headers.set("X-RateLimit-Remaining", "0");
    if (retryAfter !== null) {
      res.headers.set("Retry-After", retryAfter.toString());
    }
    logWarn("offers.create.rate_limited", {
      ...requestContext,
      userId: payload.sub,
      limit: 100,
    });
    return res;
  }

  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const { price, note } = body as {
    price?: number;
    note?: string;
  };

  if (!price || price <= 0) {
    return NextResponse.json(
      { error: "Geçerli bir fiyat değeri gereklidir" },
      { status: 400 },
    );
  }

  const { id: jobId } = await context.params;

  const providerProfile = await prisma.providerProfile.findUnique({
    where: { userId: payload.sub },
    select: { id: true },
  });

  if (!providerProfile) {
    return NextResponse.json(
      { error: "Hizmet veren profili bulunamadı" },
      { status: 400 },
    );
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      title: true,
      buyer: {
        select: {
          fullName: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!job || job.status !== "open") {
    return NextResponse.json(
      { error: "Teklif verilebilecek uygun bir iş bulunamadı" },
      { status: 400 },
    );
  }

  const offer = await prisma.offer.create({
    data: {
      jobId,
      providerId: providerProfile.id,
      price,
      note,
    },
  });

  const res = NextResponse.json({ data: offer }, { status: 201 });
  res.headers.set("X-RateLimit-Limit", "100");
  res.headers.set(
    "X-RateLimit-Remaining",
    Math.max(0, rate.remaining).toString(),
  );

  if (job.buyer.user) {
    try {
      queueNewOfferEmail({
        buyerUserId: job.buyer.user.id,
        buyerEmail: job.buyer.user.email,
        buyerName: job.buyer.fullName,
        jobTitle: job.title,
      });
    } catch (error) {
      logWarn("offers.email_queue_failed", {
        ...requestContext,
        jobId,
        buyerUserId: job.buyer.user.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return res;
}
