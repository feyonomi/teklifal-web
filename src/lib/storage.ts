import fs from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type UploadInput = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

type UploadResult = {
  url: string;
  key: string;
  storage: "s3" | "local";
};

let s3Client: S3Client | null = null;

function getS3Config() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_S3_ENDPOINT;

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint,
  };
}

function getS3Client() {
  const config = getS3Config();
  if (!config) {
    return null;
  }

  if (s3Client) {
    return { client: s3Client, bucket: config.bucket, region: config.region };
  }

  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
  });

  return { client: s3Client, bucket: config.bucket, region: config.region };
}

function buildS3PublicUrl(bucket: string, region: string, key: string) {
  const publicBase = process.env.AWS_S3_PUBLIC_URL;
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function createObjectKey(fileName: string) {
  const month = new Date().toISOString().slice(0, 7);
  const random = Math.random().toString(36).slice(2, 10);
  return `uploads/${month}/${Date.now()}-${random}-${fileName}`;
}

async function uploadToLocal(input: UploadInput, origin: string): Promise<UploadResult> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const filePath = path.join(uploadsDir, input.fileName);
  await fs.writeFile(filePath, input.buffer);

  return {
    storage: "local",
    key: `uploads/${input.fileName}`,
    url: `${origin}/uploads/${input.fileName}`,
  };
}

async function uploadToS3(input: UploadInput): Promise<UploadResult> {
  const s3 = getS3Client();
  if (!s3) {
    throw new Error("S3 yapılandırması eksik");
  }

  const key = createObjectKey(input.fileName);

  await s3.client.send(
    new PutObjectCommand({
      Bucket: s3.bucket,
      Key: key,
      Body: input.buffer,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    storage: "s3",
    key,
    url: buildS3PublicUrl(s3.bucket, s3.region, key),
  };
}

export async function uploadFile(input: UploadInput, origin: string): Promise<UploadResult> {
  if (getS3Config()) {
    return uploadToS3(input);
  }

  return uploadToLocal(input, origin);
}
