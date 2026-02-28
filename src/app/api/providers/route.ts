import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { getProviders } = await import("@/lib/data");
  return NextResponse.json({
    data: getProviders(),
  });
}

