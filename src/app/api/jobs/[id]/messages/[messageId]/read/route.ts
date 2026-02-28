import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return NextResponse.json({ error: "Yetkilendirme hatası" }, { status: 401 });
  }

  let payload: { sub: string; role: string };
  try {
    payload = verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
  }

  const { id: jobId, messageId } = await context.params;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      jobId: true,
      receiverId: true,
      readAt: true,
    },
  });

  if (!message || message.jobId !== jobId) {
    return NextResponse.json({ error: "Mesaj bulunamadı" }, { status: 404 });
  }

  if (message.receiverId !== payload.sub) {
    return NextResponse.json(
      { error: "Bu mesaj için okundu bilgisini güncelleme yetkiniz yok" },
      { status: 403 },
    );
  }

  if (message.readAt) {
    return NextResponse.json({ success: true });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: {
      readAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
