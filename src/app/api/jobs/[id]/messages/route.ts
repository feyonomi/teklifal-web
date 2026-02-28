import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { messageEvents } from "@/lib/message-events";
import { cache } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";
import { getRedis } from "@/lib/redis";
import { queueNewMessageEmail } from "@/lib/email-service";
import { publishJobMessage } from "@/lib/redis-pubsub";
import { getRequestContext, logWarn } from "@/lib/logger";

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

async function getJobParticipants(jobId: string) {
  const cached = await cache.get<{
    job: {
      id: string;
      buyer: { userId: string };
      provider: { userId: string | null } | null;
    };
    buyerUserId: string;
    providerUserId: string | null;
  }>(`job:${jobId}`);

  if (cached) {
    return cached;
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      buyer: {
        select: { userId: true },
      },
      provider: {
        select: { userId: true },
      },
    },
  });

  if (!job) {
    return null;
  }

  const buyerUserId = job.buyer.userId;
  const providerUserId = job.provider?.userId ?? null;

  const value = {
    job,
    buyerUserId,
    providerUserId,
  };

  await cache.set(`job:${jobId}`, value);

  return value;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestContext = getRequestContext(req);
  const { id: jobId } = await context.params;
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

  const participants = await getJobParticipants(jobId);

  if (!participants) {
    return NextResponse.json({ error: "İş bulunamadı" }, { status: 404 });
  }

  if (
    payload.sub !== participants.buyerUserId &&
    payload.sub !== participants.providerUserId
  ) {
    return NextResponse.json(
      { error: "Bu işe ait mesajları görüntüleme yetkiniz yok" },
      { status: 403 },
    );
  }

  const messages = await prisma.message.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
  });

  const userIds = Array.from(
    new Set(messages.flatMap((m) => [m.senderId, m.receiverId])),
  );

  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            email: true,
            role: true,
          },
        });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const enrichedMessages = messages.map((m) => ({
    id: m.id,
    jobId: m.jobId,
    senderId: m.senderId,
    receiverId: m.receiverId,
    text: m.text,
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    readAt: m.readAt,
    createdAt: m.createdAt,
    sender: userMap.get(m.senderId) ?? null,
    receiver: userMap.get(m.receiverId) ?? null,
    isMine: m.senderId === payload.sub,
  }));

  const redis = getRedis();
  if (redis) {
    try {
      await redis.incr(`job:${jobId}:views`);
    } catch (error) {
      logWarn("messages.views_counter_failed", {
        ...requestContext,
        jobId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ data: enrichedMessages });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestContext = getRequestContext(req);
  const { id: jobId } = await context.params;
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

  const participants = await getJobParticipants(jobId);

  if (!participants) {
    return NextResponse.json({ error: "İş bulunamadı" }, { status: 404 });
  }

  const { buyerUserId, providerUserId } = participants;

  if (payload.sub !== buyerUserId && payload.sub !== providerUserId) {
    return NextResponse.json(
      { error: "Bu işe mesaj gönderme yetkiniz yok" },
      { status: 403 },
    );
  }

  const createMessageSchema = z
    .object({
      text: z
        .string()
        .trim()
        .max(4000, { message: "Mesaj en fazla 4000 karakter olabilir" })
        .optional(),
      attachmentUrl: z.string().url().max(2048).optional(),
      attachmentType: z.string().max(255).optional(),
    })
    .refine(
      (data) =>
        (data.text && data.text.length > 0) || !!data.attachmentUrl,
      {
        message:
          "En azından text veya attachmentUrl alanlarından biri zorunludur",
        path: ["text"],
      },
    );

  const body = await req.json().catch(() => null);

  const parsed = createMessageSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "Geçersiz istek gövdesi" },
      { status: 400 },
    );
  }

  const { text, attachmentUrl, attachmentType } = parsed.data;

  let receiverId = buyerUserId;

  if (payload.sub === buyerUserId && providerUserId) {
    receiverId = providerUserId;
  } else if (payload.sub === providerUserId) {
    receiverId = buyerUserId;
  }

  const rate = await rateLimit(`api:messages:${payload.sub}`, 100, 3600);

  if (!rate.allowed) {
    const retryAfter =
      rate.resetAt !== null
        ? Math.max(0, Math.ceil((rate.resetAt - Date.now()) / 1000))
        : null;
    const res = NextResponse.json(
      {
        error:
          "Mesaj gönderme sınırına ulaşıldı, lütfen daha sonra tekrar deneyin",
      },
      { status: 429 },
    );
    res.headers.set("X-RateLimit-Limit", "100");
    res.headers.set("X-RateLimit-Remaining", "0");
    if (retryAfter !== null) {
      res.headers.set("Retry-After", retryAfter.toString());
    }
    logWarn("messages.create.rate_limited", {
      ...requestContext,
      userId: payload.sub,
      jobId,
      limit: 100,
    });
    return res;
  }

  const message = await prisma.message.create({
    data: {
      jobId,
      senderId: payload.sub,
      receiverId,
      text: text ?? "",
      attachmentUrl: attachmentUrl ?? null,
      attachmentType: attachmentType ?? null,
    },
  });

  messageEvents.emit("message", message);

  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.sub,
        action: "message_created",
        metadata: JSON.stringify({
          jobId,
          messageId: message.id,
          hasAttachment: !!message.attachmentUrl,
        }),
      },
    });
  } catch (error) {
    logWarn("audit.message_created.write_failed", {
      ...requestContext,
      userId: payload.sub,
      jobId,
      messageId: message.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.incr(`job:${jobId}:messages`);
    } catch (error) {
      logWarn("messages.counter_failed", {
        ...requestContext,
        jobId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await publishJobMessage(jobId, {
      id: message.id,
      jobId: message.jobId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      text: message.text,
      attachmentUrl: message.attachmentUrl,
      attachmentType: message.attachmentType,
      readAt: message.readAt ? message.readAt.toISOString() : null,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    logWarn("realtime_publish_failed", {
      ...requestContext,
      jobId,
      messageId: message.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
  await cache.invalidate(`job:${jobId}`);

  const res = NextResponse.json({ data: message }, { status: 201 });
  res.headers.set("X-RateLimit-Limit", "100");
  res.headers.set(
    "X-RateLimit-Remaining",
    Math.max(0, rate.remaining).toString(),
  );

  const receiverUser = await prisma.user.findUnique({
    where: { id: receiverId },
    select: {
      id: true,
      email: true,
    },
  });

  if (receiverUser) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        title: true,
      },
    });

    try {
      queueNewMessageEmail({
        receiverUserId: receiverUser.id,
        receiverEmail: receiverUser.email,
        senderName: null,
        jobTitle: job?.title ?? "",
      });
    } catch (error) {
      logWarn("messages.email_queue_failed", {
        ...requestContext,
        jobId,
        receiverUserId: receiverUser.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return res;
}
