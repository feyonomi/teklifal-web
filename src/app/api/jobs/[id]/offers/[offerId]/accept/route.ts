import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { getRequestContext, logWarn } from "@/lib/logger";

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; offerId: string }> },
) {
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
      { error: "Yalnızca alıcılar teklif kabul edebilir" },
      { status: 403 },
    );
  }

  const { id: jobId, offerId } = await context.params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      buyer: { select: { userId: true } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "İş bulunamadı" }, { status: 404 });
  }

  if (job.buyer.userId !== payload.sub) {
    return NextResponse.json(
      { error: "Bu işe ait teklifleri kabul etme yetkiniz yok" },
      { status: 403 },
    );
  }

  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      jobId,
    },
    select: {
      id: true,
      providerId: true,
      status: true,
      price: true,
    },
  });

  if (!offer) {
    return NextResponse.json({ error: "Teklif bulunamadı" }, { status: 404 });
  }

  if (job.providerId && job.providerId !== offer.providerId) {
    return NextResponse.json(
      { error: "Bu iş için daha önce farklı bir teklif kabul edilmiş" },
      { status: 409 },
    );
  }

  if (offer.status === "accepted" && job.providerId === offer.providerId) {
    return NextResponse.json(
      {
        data: {
          jobId,
          offerId: offer.id,
          providerId: offer.providerId,
          status: "matched",
          alreadyAccepted: true,
        },
      },
      { status: 200 },
    );
  }

  if (job.status !== "open") {
    return NextResponse.json(
      { error: "Bu iş artık teklif kabul etmiyor" },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offer.id },
      data: { status: "accepted" },
    });

    await tx.offer.updateMany({
      where: {
        jobId,
        id: { not: offer.id },
        status: "pending",
      },
      data: { status: "rejected" },
    });

    await tx.job.update({
      where: { id: jobId },
      data: {
        providerId: offer.providerId,
        status: "matched",
      },
    });
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.sub,
        action: "offer_accepted",
        metadata: JSON.stringify({
          jobId,
          offerId: offer.id,
          providerId: offer.providerId,
          price: offer.price,
        }),
      },
    });
  } catch (error) {
    logWarn("audit.offer_accepted.write_failed", {
      ...requestContext,
      userId: payload.sub,
      jobId,
      offerId: offer.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json(
    {
      data: {
        jobId,
        offerId: offer.id,
        providerId: offer.providerId,
        status: "matched",
      },
    },
    { status: 200 },
  );
}
