import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, findUserByEmail } from "@/lib/auth";
import { queueEmailVerificationEmail } from "@/lib/email-service";
import { enforceAuthRateLimit } from "@/lib/auth-rate-limit";

export async function POST(req: NextRequest) {
  const rateLimitResponse = await enforceAuthRateLimit(req, "register");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const registerSchema = z.object({
    email: z
      .string()
      .email({ message: "Geçerli bir e-posta adresi girin" }),
    password: z
      .string()
      .min(6, { message: "Şifre en az 6 karakter olmalıdır" }),
    role: z.enum(["buyer", "provider"], {
      message: "role alanı buyer veya provider olmalıdır",
    }),
    fullName: z.string().optional(),
    displayName: z.string().optional(),
    city: z.string().optional(),
  });

  const body = await req.json().catch(() => null);

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "Geçersiz istek gövdesi" },
      { status: 400 },
    );
  }

  const { email, password, role, fullName, displayName, city } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "Bu e-posta ile zaten kayıtlı bir kullanıcı var" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      role,
    },
  });

  if (role === "buyer") {
    await prisma.buyerProfile.create({
      data: {
        userId: user.id,
        fullName: fullName || email.split("@")[0],
        city,
      },
    });
  }

  if (role === "provider") {
    await prisma.providerProfile.create({
      data: {
        userId: user.id,
        displayName: displayName || email.split("@")[0],
        city,
      },
    });
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "user_registered",
        metadata: JSON.stringify({
          role: user.role,
          city,
        }),
      },
    });
  } catch {
  }

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  const verifyUrl = await queueEmailVerificationEmail({
    userId: user.id,
    email: user.email,
  }, appBaseUrl);

  const includeVerificationUrl = process.env.NODE_ENV !== "production";

  return NextResponse.json(
    {
      success: true,
      message: "Hesabın oluşturuldu. Lütfen e-posta adresini doğrula.",
      ...(includeVerificationUrl ? { verificationUrl: verifyUrl } : {}),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    },
    { status: 201 },
  );
}
