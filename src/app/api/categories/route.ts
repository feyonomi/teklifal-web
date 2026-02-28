import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { getCategories } = await import("@/lib/data");
  return NextResponse.json({
    data: getCategories(),
  });
}

