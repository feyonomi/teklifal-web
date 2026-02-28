import { getEmailProvider } from "./email-provider";
import {
  buildEmailVerificationEmail,
  buildNewMessageEmail,
  buildNewOfferEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail,
} from "./email-templates";
import { prisma } from "./prisma";
import { rateLimit } from "./rate-limit";
import jwt from "jsonwebtoken";
import crypto from "crypto";

type Locale = "tr";

const EMAIL_LOCALE: Locale = "tr";

type WelcomeParams = {
  userId: string;
  email: string;
};

type NewOfferParams = {
  buyerUserId: string;
  buyerEmail: string;
  buyerName: string | null;
  jobTitle: string;
};

type NewMessageParams = {
  receiverUserId: string;
  receiverEmail: string;
  senderName: string | null;
  jobTitle: string;
};

type PasswordResetParams = {
  userId: string;
  email: string;
};

type EmailVerificationParams = {
  userId: string;
  email: string;
};

async function sendWithAudit(
  key: string,
  userId: string,
  type: string,
  to: string,
  build: () => { subject: string; text: string; html: string },
) {
  const rate = await rateLimit(key, 10, 3600);

  if (!rate.allowed) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "email_rate_limited",
          metadata: JSON.stringify({
            type,
            to,
            key,
          }),
        },
      });
    } catch {
    }
    return;
  }

  const provider = getEmailProvider();

  if (!provider) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "email_failed",
          metadata: JSON.stringify({
            type,
            to,
            reason: "provider_not_configured",
          }),
        },
      });
    } catch {
    }
    return;
  }

  const payload = build();

  try {
    await provider.sendEmail({
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  } catch (error) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "email_failed",
          metadata: JSON.stringify({
            type,
            to,
            error:
              error instanceof Error
                ? error.message
                : "unknown_error",
          }),
        },
      });
    } catch {
    }
  }
}

export function queueWelcomeEmail(params: WelcomeParams) {
  void sendWithAudit(
    `email:welcome:${params.userId}`,
    params.userId,
    "welcome",
    params.email,
    () => buildWelcomeEmail({ email: params.email }, EMAIL_LOCALE),
  );
}

export function queueNewOfferEmail(params: NewOfferParams) {
  void sendWithAudit(
    `email:offer:${params.buyerUserId}`,
    params.buyerUserId,
    "new_offer",
    params.buyerEmail,
    () =>
      buildNewOfferEmail(
        {
          jobTitle: params.jobTitle,
          buyerName: params.buyerName,
        },
        EMAIL_LOCALE,
      ),
  );
}

export function queueNewMessageEmail(params: NewMessageParams) {
  void sendWithAudit(
    `email:message:${params.receiverUserId}`,
    params.receiverUserId,
    "new_message",
    params.receiverEmail,
    () =>
      buildNewMessageEmail(
        {
          jobTitle: params.jobTitle,
          senderName: params.senderName,
        },
        EMAIL_LOCALE,
      ),
  );
}

export function queuePasswordResetEmail(
  params: PasswordResetParams,
  appBaseUrl: string,
) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    void prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: "email_failed",
        metadata: JSON.stringify({
          type: "password_reset",
          to: params.email,
          reason: "jwt_secret_not_configured",
        }),
      },
    }).catch(() => {});
    return;
  }

  const token = jwt.sign(
    {
      sub: params.userId,
      email: params.email,
      type: "password_reset",
    },
    jwtSecret,
    {
      expiresIn: "30m",
    },
  );

  const resetUrl = `${appBaseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  void sendWithAudit(
    `email:reset:${params.userId}`,
    params.userId,
    "password_reset",
    params.email,
    () =>
      buildPasswordResetEmail(
        {
          email: params.email,
          resetUrl,
        },
        EMAIL_LOCALE,
      ),
  );
}

export async function queueEmailVerificationEmail(
  params: EmailVerificationParams,
  appBaseUrl: string,
) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const verifyUrl = `${appBaseUrl.replace(/\/$/, "")}/api/auth/verify-email?email=${encodeURIComponent(params.email)}&token=${encodeURIComponent(token)}`;

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationSentAt: new Date(),
    },
  });

  void sendWithAudit(
    `email:verify:${params.userId}`,
    params.userId,
    "email_verification",
    params.email,
    () =>
      buildEmailVerificationEmail(
        {
          email: params.email,
          verifyUrl,
        },
        EMAIL_LOCALE,
      ),
  );

  return verifyUrl;
}
