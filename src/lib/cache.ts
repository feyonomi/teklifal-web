import { getRedis } from "./redis";

const DEFAULT_TTL_SECONDS = 3600;

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) {
      return null;
    }
    try {
      const value = await redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const redis = getRedis();
    if (!redis) {
      return;
    }
    try {
      const payload = JSON.stringify(value);
      await redis.set(key, payload, "EX", ttlSeconds);
    } catch {
      return;
    }
  },

  async invalidate(key: string) {
    const redis = getRedis();
    if (!redis) {
      return;
    }
    try {
      await redis.del(key);
    } catch {
      return;
    }
  },
};

