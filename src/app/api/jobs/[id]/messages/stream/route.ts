import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (header) {
    const [type, token] = header.split(" ");
    if (type === "Bearer" && token) {
      return token;
    }
  }
  return null;
}

async function getJobParticipants(
  jobId: string,
  prisma: (typeof import("@/lib/prisma"))["prisma"],
) {
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

  return {
    buyerUserId,
    providerUserId,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const [prismaLib, authLib, loggerLib, redisPubSubLib] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/auth"),
    import("@/lib/logger"),
    import("@/lib/redis-pubsub"),
  ]);
  const { prisma } = prismaLib;
  const { verifyAccessToken } = authLib;
  const { logWarn } = loggerLib;
  const { getRedisPubSubClient, buildJobChannel } = redisPubSubLib;

  const { id: jobId } = await context.params;
  const token = getTokenFromRequest(req);

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { sub: string; role: string };
  try {
    payload = verifyAccessToken(token);
  } catch {
    return new Response("Invalid token", { status: 401 });
  }

  const participants = await getJobParticipants(jobId, prisma);

  if (!participants) {
    return new Response("Job not found", { status: 404 });
  }

  if (
    payload.sub !== participants.buyerUserId &&
    payload.sub !== participants.providerUserId
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const redis = getRedisPubSubClient();

  if (!redis) {
    logWarn("realtime_stream_error", {
      userId: payload.sub,
      jobId,
      reason: "redis_not_configured",
    });
    return new Response("Real-time messaging is temporarily unavailable", {
      status: 503,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let isClosed = false;
      let pendingMessages = 0;
      const maxPendingMessages = 100;

      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        const payloadString = `event: ${event}\ndata: ${JSON.stringify(
          data,
        )}\n\n`;
        controller.enqueue(encoder.encode(payloadString));
      };

      sendEvent("hello", { ok: true });

      heartbeatInterval = setInterval(() => {
        if (isClosed) return;
        controller.enqueue(encoder.encode("event: heartbeat\ndata: {}\n\n"));
      }, 25000);

      const channel = buildJobChannel(jobId);

      try {
        await prisma.auditLog.create({
          data: {
            userId: payload.sub,
            action: "realtime_subscribed",
            metadata: JSON.stringify({
              jobId,
              channel,
            }),
          },
        });
      } catch (error) {
        logWarn("realtime_subscribed.audit_failed", {
          userId: payload.sub,
          jobId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        await redis.subscribe(channel);
      } catch (error) {
        logWarn("realtime_stream_error", {
          userId: payload.sub,
          jobId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        isClosed = true;
        controller.close();
        redis.disconnect(false);
        return;
      }

      redis.on("message", (_channel, rawMessage) => {
        if (isClosed || _channel !== channel) {
          return;
        }

        if (pendingMessages >= maxPendingMessages) {
          logWarn("realtime_stream_error", {
            userId: payload.sub,
            jobId,
            reason: "backpressure_limit_reached",
          });
          isClosed = true;
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }
          controller.close();
          redis.unsubscribe(channel).finally(() => {
            redis.disconnect(false);
          });
          return;
        }

        pendingMessages += 1;

        try {
          const parsed = JSON.parse(rawMessage) as {
            id: string;
            jobId: string;
            senderId: string;
            receiverId: string;
            text: string;
            attachmentUrl: string | null;
            attachmentType: string | null;
            readAt: string | null;
            createdAt: string;
          };

          const enriched = {
            ...parsed,
            isMine: parsed.senderId === payload.sub,
          };

          sendEvent("message", enriched);
        } catch (error) {
          logWarn("realtime_stream_error", {
            userId: payload.sub,
            jobId,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        } finally {
          pendingMessages -= 1;
        }
      });

      const abortHandler = () => {
        if (isClosed) return;
        isClosed = true;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        redis.unsubscribe(channel).finally(() => {
          redis.disconnect(false);
        });
        controller.close();
      };

      req.signal.addEventListener("abort", abortHandler);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
