import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { cache } from "@/lib/cache";

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme hatası" }, { status: 401 });
  }

  try {
    const payload = verifyAccessToken(token);

    const cacheKey = `user:${payload.sub}`;

    const cached = await cache.get<{
      id: string;
      email: string;
      role: string;
      buyerProfile: unknown;
      providerProfile: unknown;
      createdAt: string;
    }>(cacheKey);

    const user =
      cached ||
      (await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          buyerProfile: true,
          providerProfile: true,
          createdAt: true,
        },
      }));

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    if (!cached) {
      await cache.set(cacheKey, user);
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Geçersiz veya süresi dolmuş token" }, { status: 401 });
  }
}
