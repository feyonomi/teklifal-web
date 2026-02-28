import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail } from "@/lib/auth";
import { queuePasswordResetEmail } from "@/lib/email-service";
import { enforceAuthRateLimit } from "@/lib/auth-rate-limit";

export async function POST(req: NextRequest) {
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

