import Redis from "ioredis";
import { logWarn } from "@/lib/logger";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }
  if (redis) {
    return redis;
  }
  redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });

  redis.on("error", (error) => {
    logWarn("redis.error", {
      errorMessage: error.message,
    });
  });

  return redis;
}

