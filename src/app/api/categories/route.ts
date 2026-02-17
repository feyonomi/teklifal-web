import { NextResponse } from "next/server";
import { getCategories } from "@/lib/data";

export function GET() {
  return NextResponse.json({
    data: getCategories(),
  });
}

