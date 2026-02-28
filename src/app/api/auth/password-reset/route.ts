import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const [authLib, emailServiceLib, authRateLimitLib] = await Promise.all([
    import("@/lib/auth"),
    import("@/lib/email-service"),
    import("@/lib/auth-rate-limit"),
  ]);
  const { findUserByEmail } = authLib;
  const { queuePasswordResetEmail } = emailServiceLib;
  const { enforceAuthRateLimit } = authRateLimitLib;

  const rateLimitResponse = await enforceAuthRateLimit(req, "password-reset");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const schema = z.object({
    email: z
      .string()
      .email({ message: "Geçerli bir e-posta adresi girin" }),
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

  const { email } = parsed.data;

  const user = await findUserByEmail(email);

  if (user) {
    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    queuePasswordResetEmail(
      {
        userId: user.id,
        email: user.email,
      },
      appBaseUrl,
    );
  }

  return NextResponse.json(
    {
      success: true,
    },
    { status: 200 },
  );
}

