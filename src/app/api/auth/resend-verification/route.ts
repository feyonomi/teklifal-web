import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const [prismaLib, emailServiceLib, rateLimitLib] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/email-service"),
    import("@/lib/rate-limit"),
  ]);
  const { prisma } = prismaLib;
  const { queueEmailVerificationEmail } = emailServiceLib;
  const { rateLimit, getClientIp } = rateLimitLib;

  const schema = z.object({
    email: z.string().email({ message: "Geçerli bir e-posta adresi girin" }),
  });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "Geçersiz istek gövdesi" },
      { status: 400 },
    );
  }

  const ip = getClientIp(req);
  const rate = await rateLimit(`resend-verification:${ip}`, 5, 15 * 60);

  if (!rate.success) {
    const retryAfter = Math.max(0, Math.ceil((rate.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Çok fazla deneme, lütfen daha sonra tekrar deneyin." },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  if (user.emailVerifiedAt) {
    return NextResponse.json(
      { success: true, alreadyVerified: true },
      { status: 200 },
    );
  }

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
      success: true,
      message: "Doğrulama e-postası tekrar gönderildi.",
      ...(includeVerificationUrl ? { verificationUrl: verifyUrl } : {}),
    },
    { status: 200 },
  );
}
