import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { getRequestContext, logError, logWarn } from "@/lib/logger";

type AuthRateLimitAction = "register" | "login" | "password-reset";

type AuthRateLimitPolicy = {
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
  blockedMessage: string;
};

const ALARM_COOLDOWN_MS = 5 * 60 * 1000;
const fallbackAlarmAt = new Map<AuthRateLimitAction, number>();

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function getPolicy(action: AuthRateLimitAction): AuthRateLimitPolicy {
  switch (action) {
    case "register":
      return {
        keyPrefix: "register",
        limit: parseEnvInt("AUTH_REGISTER_RATE_LIMIT", 5),
        windowSeconds: parseEnvInt("AUTH_REGISTER_RATE_WINDOW", 3600),
        blockedMessage: "Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.",
      };
    case "login":
      return {
        keyPrefix: "login",
        limit: parseEnvInt("AUTH_LOGIN_RATE_LIMIT", 5),
        windowSeconds: parseEnvInt("AUTH_LOGIN_RATE_WINDOW", 15 * 60),
        blockedMessage: "Çok fazla giriş denemesi, lütfen daha sonra tekrar deneyin",
      };
    case "password-reset":
      return {
        keyPrefix: "reset",
        limit: parseEnvInt("AUTH_PASSWORD_RESET_RATE_LIMIT", 3),
        windowSeconds: parseEnvInt("AUTH_PASSWORD_RESET_RATE_WINDOW", 3600),
        blockedMessage: "Çok fazla şifre sıfırlama isteği. Lütfen daha sonra tekrar deneyin.",
      };
  }
}

function shouldEmitFallbackAlarm(action: AuthRateLimitAction): boolean {
  const now = Date.now();
  const previous = fallbackAlarmAt.get(action) ?? 0;
  if (now - previous < ALARM_COOLDOWN_MS) {
    return false;
  }
  fallbackAlarmAt.set(action, now);
  return true;
}

export async function enforceAuthRateLimit(req: NextRequest, action: AuthRateLimitAction) {
  const policy = getPolicy(action);
  const ip = getClientIp(req);
  const requestContext = getRequestContext(req);
  const rate = await rateLimit(`${policy.keyPrefix}:${ip}`, policy.limit, policy.windowSeconds);

  const redisRequiredInProd =
    process.env.NODE_ENV === "production" && process.env.AUTH_RATE_LIMIT_REDIS_REQUIRED !== "false";

  if (redisRequiredInProd && rate.store !== "redis") {
    logError("auth.rate_limit.redis_required", new Error("Redis unavailable for auth rate limit"), {
      ...requestContext,
      action,
      ip,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      store: rate.store,
      degradedReason: rate.degradedReason ?? "unknown",
    });

    return NextResponse.json(
      { error: "Servis geçici olarak kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin." },
      {
        status: 503,
        headers: {
          "Retry-After": "60",
        },
      },
    );
  }

  if (rate.store !== "redis" && shouldEmitFallbackAlarm(action)) {
    logWarn("auth.rate_limit.memory_fallback", {
      ...requestContext,
      action,
      ip,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      degradedReason: rate.degradedReason ?? "unknown",
    });
  }

  if (!rate.success) {
    const retryAfter = Math.max(0, Math.ceil((rate.reset - Date.now()) / 1000));
    logWarn("auth.rate_limit.blocked", {
      ...requestContext,
      action,
      ip,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      retryAfter,
    });

    return NextResponse.json(
      { error: policy.blockedMessage },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": policy.limit.toString(),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  return null;
}
