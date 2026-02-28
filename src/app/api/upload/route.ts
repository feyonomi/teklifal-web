import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { uploadFile } from "@/lib/storage";
import { getRequestContext, logError, logWarn } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const uploadSchema = z.object({
  size: z
    .number()
    .max(MAX_UPLOAD_SIZE, { message: "Dosya boyutu 5MB sınırını aşıyor" }),
  type: z.enum(ALLOWED_MIME_TYPES as [string, ...string[]], {
    message: "Bu dosya türüne izin verilmiyor",
  }),
});

function getTokenFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function POST(req: NextRequest) {
  const requestContext = getRequestContext(req);
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return NextResponse.json(
        { error: "Yetkilendirme hatası" },
        { status: 401 },
      );
    }

    let payload: { sub: string; role: string };
    try {
      payload = verifyAccessToken(token);
    } catch {
      return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
    }

    const uploadLimit = 10;
    const windowSeconds = 3600;
    const rate = await rateLimit(`upload:${payload.sub}`, uploadLimit, windowSeconds);
    if (!rate.allowed) {
      const retryAfter =
        rate.resetAt !== null
          ? Math.max(0, Math.ceil((rate.resetAt - Date.now()) / 1000))
          : null;
      const res = NextResponse.json(
        { error: "Yükleme sınırına ulaşıldı, lütfen daha sonra tekrar deneyin" },
        { status: 429 },
      );
      res.headers.set("X-RateLimit-Limit", uploadLimit.toString());
      res.headers.set("X-RateLimit-Remaining", "0");
      if (retryAfter !== null) {
        res.headers.set("Retry-After", retryAfter.toString());
      }
      logWarn("upload.rate_limited", {
        ...requestContext,
        userId: payload.sub,
        limit: uploadLimit,
      });
      return res;
    }

    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "İstek multipart/form-data olmalıdır" },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "file alanında bir dosya bekleniyor" },
        { status: 400 },
      );
    }

    const fileType = file.type;
    const fileSize = (file as File).size;

    const parsed = uploadSchema.safeParse({
      size: fileSize,
      type: fileType,
    });

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ||
        "Yüklenen dosya doğrulanamadı";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const rawName = file.name || "upload";
    const safeName = rawName.replace(/[^a-zA-Z0-9.\-_]/g, "_");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extFromName = safeName.includes(".")
      ? `.${safeName.split(".").pop()}`
      : "";
    const fallbackExt =
      !extFromName && fileType ? `.${fileType.split("/")[1]}` : "";

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}${extFromName || fallbackExt || ""}`;

    const origin = req.nextUrl.origin;
    const uploaded = await uploadFile(
      {
        buffer,
        contentType: fileType,
        fileName,
      },
      origin,
    );

    try {
      await prisma.auditLog.create({
        data: {
          userId: payload.sub,
          action: "file_uploaded",
          metadata: JSON.stringify({
            type: fileType,
            size: buffer.length,
            storage: uploaded.storage,
            key: uploaded.key,
          }),
        },
      });
    } catch (error) {
      logWarn("audit.file_uploaded.write_failed", {
        ...requestContext,
        userId: payload.sub,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    const res = NextResponse.json(
      {
        url: uploaded.url,
        name: safeName,
        type: fileType,
        size: buffer.length,
        storage: uploaded.storage,
      },
      { status: 201 },
    );
    res.headers.set("X-RateLimit-Limit", uploadLimit.toString());
    res.headers.set(
      "X-RateLimit-Remaining",
      Math.max(0, rate.remaining).toString(),
    );
    return res;
  } catch (error) {
    logError("upload.unhandled_error", error, requestContext);
    return NextResponse.json(
      { error: "Dosya yüklenirken bir hata oluştu" },
      { status: 500 },
    );
  }
}
