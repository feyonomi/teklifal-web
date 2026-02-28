import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 });

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}
