import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!token || !email) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", req.url));
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      emailVerifiedAt: true,
      emailVerificationTokenHash: true,
      emailVerificationSentAt: true,
    },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", req.url));
  }

  if (user.emailVerifiedAt) {
    return NextResponse.redirect(new URL("/verify-email?status=already", req.url));
  }

  if (!user.emailVerificationTokenHash || !user.emailVerificationSentAt) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", req.url));
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const tokenExpired = Date.now() - new Date(user.emailVerificationSentAt).getTime() > 24 * 60 * 60 * 1000;

  if (tokenExpired || tokenHash !== user.emailVerificationTokenHash) {
    return NextResponse.redirect(new URL("/verify-email?status=expired", req.url));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationSentAt: null,
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "email_verified",
      },
    });
  } catch {
  }

  return NextResponse.redirect(new URL("/verify-email?status=success", req.url));
}
