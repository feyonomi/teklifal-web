import { EventEmitter } from "events";

export type NewMessageEvent = {
  id: string;
  jobId: string;
  senderId: string;
  receiverId: string;
  text: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const globalForMessageEvents = globalThis as unknown as {
  messageEvents?: EventEmitter;
};

export const messageEvents =
  globalForMessageEvents.messageEvents ??
  new EventEmitter();

if (!globalForMessageEvents.messageEvents) {
  globalForMessageEvents.messageEvents = messageEvents;
}

