import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

const JWT_SECRET = (() => {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET environment variable must be set");
  }
  return value;
})();

const JWT_ISSUER = process.env.JWT_ISSUER || "teklifal";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "teklifal-web";
const ACCESS_TOKEN_TTL =
  (process.env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]) || "12h";

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
  const token = jwt.sign(
    {
      sub: params.userId,
      role: params.role,
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: "HS256",
    },
  );
  return token;
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
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
