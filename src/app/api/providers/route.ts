import { NextResponse } from "next/server";
import { getProviders } from "@/lib/data";

export function GET() {
  return NextResponse.json({
    data: getProviders(),
  });
}

