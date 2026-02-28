import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo-buyer@example.com";
const DEMO_PASSWORD = "demo-password";

export async function GET() {
  const demoModeEnabled = process.env.DEMO_MODE === "true";
  if (!demoModeEnabled) {
    return NextResponse.json(
      { error: "Demo endpoint is disabled in production" },
      { status: 403 },
    );
  }

  const [{ prisma }, authLib] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/auth"),
  ]);

  const { createAccessToken, hashPassword, findUserByEmail } = authLib;

  let user = await findUserByEmail(DEMO_EMAIL);

  if (!user) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash,
        role: "buyer",
      },
    });

    await prisma.buyerProfile.create({
      data: {
        userId: user.id,
        fullName: "Demo Alıcı",
        city: "İstanbul",
      },
    });
  }

  const token = createAccessToken({ userId: user.id, role: user.role });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
}

