import Redis from "ioredis";
import { NextRequest } from "next/server";

// In-memory fallback store
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

// Clean up memory store every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (value.expiresAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 60000).unref(); // unref to not block process exit
}

let redisClient: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000, // 2s timeout
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 50, 2000);
      },
    });

    redisClient.on("error", (err) => {
      console.warn("Redis connection error, falling back to memory:", err.message);
      // We don't nullify client here immediately to allow reconnection, 
      // but individual commands will fail and trigger fallback logic.
    });
  } catch (error) {
    console.warn("Failed to initialize Redis client:", error);
  }
}

export type RateLimitResult = {
  success: boolean;
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  resetAt: number;
  store: "redis" | "memory";
  degradedReason?: "redis_unavailable" | "redis_not_configured";
};

/**
 * Rate limit checker with Redis + Memory Fallback
 * @param identifier Unique key (e.g. IP address or User ID)
 * @param limit Max requests allowed
 * @param windowSeconds Time window in seconds
 */
export async function rateLimit(
  identifier: string,
  limit: number = 10,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const redisConfigured = Boolean(process.env.REDIS_URL);

  // Try Redis first if available
  if (redisClient && redisClient.status === "ready") {
    try {
      const multi = redisClient.multi();
      multi.incr(key);
      multi.pttl(key);
      const results = await multi.exec();

      if (results) {
        const [incrErr, incrRes] = results[0];
        const [ttlErr, ttlRes] = results[1];

        if (!incrErr && typeof incrRes === "number") {
          const count = incrRes;
          let ttl = typeof ttlRes === "number" ? ttlRes : -1;

          // If key is new (ttl is -1 or very small), set expiration
          if (count === 1 || ttl < 0) {
            await redisClient.expire(key, windowSeconds);
            ttl = windowMs;
          }

          return {
            success: count <= limit,
            allowed: count <= limit,
            limit,
            remaining: Math.max(0, limit - count),
            reset: now + (ttl > 0 ? ttl : windowMs),
            resetAt: now + (ttl > 0 ? ttl : windowMs),
            store: "redis",
          };
        }
      }
    } catch (err) {
      console.warn("Redis rate limit check failed, using memory fallback:", err);
      // Fall through to memory store
    }
  }

  // Memory Fallback
  const record = memoryStore.get(key);
  
  if (record && record.expiresAt > now) {
    record.count++;
    return {
      success: record.count <= limit,
      allowed: record.count <= limit,
      limit,
      remaining: Math.max(0, limit - record.count),
      reset: record.expiresAt,
      resetAt: record.expiresAt,
      store: "memory",
      degradedReason: redisConfigured ? "redis_unavailable" : "redis_not_configured",
    };
  }

  // New record or expired
  const newRecord = {
    count: 1,
    expiresAt: now + windowMs,
  };
  memoryStore.set(key, newRecord);

  return {
    success: true,
    allowed: true,
    limit,
    remaining: limit - 1,
    reset: newRecord.expiresAt,
    resetAt: newRecord.expiresAt,
    store: "memory",
    degradedReason: redisConfigured ? "redis_unavailable" : "redis_not_configured",
  };
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",").map((v) => v.trim());
    if (first) return first;
  }
  
  // Fallback for local dev or when no proxy
  // Note: NextRequest doesn't expose socket directly in edge/serverless cleanly, 
  // but in Node runtime we might inspect headers mostly.
  return "127.0.0.1";
}
