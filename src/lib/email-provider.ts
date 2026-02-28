import { Resend } from "resend";
import sendgrid from "@sendgrid/mail";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailProvider {
  sendEmail(payload: EmailPayload): Promise<void>;
}

function createResendProvider(apiKey: string, fromEmail: string): EmailProvider {
  const resend = new Resend(apiKey);

  return {
    async sendEmail(payload: EmailPayload) {
      await resend.emails.send({
        from: fromEmail,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
    },
  };
}

function createSendgridProvider(apiKey: string, fromEmail: string): EmailProvider {
  sendgrid.setApiKey(apiKey);

  return {
    async sendEmail(payload: EmailPayload) {
      await sendgrid.send({
        from: fromEmail,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
    },
  };
}

let cachedProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider | null {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerName = process.env.EMAIL_PROVIDER;

  if (!providerName) {
    return null;
  }

  if (providerName === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return null;
    }
    cachedProvider = createResendProvider(apiKey, from);
    return cachedProvider;
  }

  if (providerName === "sendgrid") {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.SENDGRID_FROM_EMAIL;
    if (!apiKey || !from) {
      return null;
    }
    cachedProvider = createSendgridProvider(apiKey, from);
    return cachedProvider;
  }

  return null;
}

