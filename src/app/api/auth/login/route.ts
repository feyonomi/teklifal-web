import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createAccessToken,
  findUserByEmail,
  verifyPassword,
} from "@/lib/auth";
import { cache } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { getRequestContext, logWarn } from "@/lib/logger";
import { queueEmailVerificationEmail } from "@/lib/email-service";
import { enforceAuthRateLimit } from "@/lib/auth-rate-limit";

const AUTH_COOKIE_NAME = "auth_token";

export async function POST(req: NextRequest) {
  const requestContext = getRequestContext(req);
  const loginSchema = z.object({
    email: z
      .string()
      .email({ message: "Geçerli bir e-posta adresi girin" }),
    password: z
      .string()
      .min(1, { message: "password alanı zorunludur" }),
  });

  const rateLimitResponse = await enforceAuthRateLimit(req, "login");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = await req.json().catch(() => null);

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "Geçersiz istek gövdesi" },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  const cachedUser = await cache.get<{
    id: string;
    email: string;
    role: string;
  }>(`user:${email.toLowerCase()}`);

  let user: {
    id: string;
    email: string;
    passwordHash: string;
    role: string;
    emailVerifiedAt: Date | null;
  } | null = null;

  if (cachedUser) {
    const passwordRow = await prisma.user.findUnique({
      where: { id: cachedUser.id },
      select: { passwordHash: true, emailVerifiedAt: true },
    });

    if (passwordRow) {
      user = {
        ...cachedUser,
        passwordHash: passwordRow.passwordHash,
        emailVerifiedAt: passwordRow.emailVerifiedAt,
      };
    }
  } else {
    user = await findUserByEmail(email);
  }

  if (!user) {
    return NextResponse.json(
      { error: "E-posta veya şifre hatalı" },
      { status: 401 },
    );
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json(
      { error: "E-posta veya şifre hatalı" },
      { status: 401 },
    );
  }

  if (!user.emailVerifiedAt) {
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const verifyUrl = await queueEmailVerificationEmail(
      {
        userId: user.id,
        email: user.email,
      },
      appBaseUrl,
    );
    const includeVerificationUrl = process.env.NODE_ENV !== "production";

    return NextResponse.json(
      {
        error: "Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.",
        verificationRequired: true,
        ...(includeVerificationUrl ? { verificationUrl: verifyUrl } : {}),
      },
      { status: 403 },
    );
  }

  const token = createAccessToken({ userId: user.id, role: user.role });

  if (!cachedUser) {
    await cache.set(`user:${email.toLowerCase()}`, {
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  let profile: unknown = null;

  if (user.role === "buyer") {
    profile = await prisma.buyerProfile.findUnique({
      where: { userId: user.id },
    });
  } else if (user.role === "provider") {
    profile = await prisma.providerProfile.findUnique({
      where: { userId: user.id },
    });
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "user_login",
        metadata: JSON.stringify({
          role: user.role,
        }),
      },
    });
  } catch (error) {
    logWarn("audit.login.write_failed", {
      ...requestContext,
      userId: user.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  const response = NextResponse.json(
    {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    },
    { status: 200 },
  );

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
