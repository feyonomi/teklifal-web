import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

function getJwtConfig() {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET environment variable must be set");
  }
  return {
    secret: value,
    issuer: process.env.JWT_ISSUER || "teklifal",
    audience: process.env.JWT_AUDIENCE || "teklifal-web",
    expiresIn:
      (process.env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]) || "12h",
  };
}

export async function hashPassword(password: string) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}

export async function verifyPassword(password: string, hash: string) {
  const match = await bcrypt.compare(password, hash);
  return match;
}

export function createAccessToken(params: { userId: string; role: string }) {
  const config = getJwtConfig();
  const token = jwt.sign(
    {
      sub: params.userId,
      role: params.role,
    },
    config.secret,
    {
      expiresIn: config.expiresIn,
      issuer: config.issuer,
      audience: config.audience,
      algorithm: "HS256",
    },
  );
  return token;
}

export function verifyAccessToken(token: string) {
  const config = getJwtConfig();
  const payload = jwt.verify(token, config.secret, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["HS256"],
  }) as {
    sub: string;
    role: string;
  };
  return payload;
}

export async function findUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  return user;
}
