import Redis from "ioredis";
import { logWarn } from "@/lib/logger";

type MessagePayload = {
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

export function getRedisPubSubClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });

  client.on("error", (error) => {
    logWarn("redis.pubsub.error", {
      errorMessage: error.message,
    });
  });

  return client;
}

export function buildJobChannel(jobId: string) {
  return `job:${jobId}:messages`;
}

export async function publishJobMessage(
  jobId: string,
  message: MessagePayload,
) {
  const url = process.env.REDIS_URL;
  if (!url) {
    return;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });

  client.on("error", (error) => {
    logWarn("redis.pubsub.publish_error", {
      errorMessage: error.message,
    });
  });

  try {
    const channel = buildJobChannel(jobId);
    await client.publish(channel, JSON.stringify(message));
  } catch (error) {
    logWarn("realtime_publish_failed", {
      jobId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  } finally {
    client.disconnect(false);
  }
}

