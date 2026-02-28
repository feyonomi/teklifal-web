import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://teklifal.com";

  return [
    { url: `${baseUrl}/`, lastModified: new Date() },
    { url: `${baseUrl}/privacy`, lastModified: new Date() },
    { url: `${baseUrl}/terms`, lastModified: new Date() },
    { url: `${baseUrl}/kvkk`, lastModified: new Date() },
    { url: `${baseUrl}/cookies`, lastModified: new Date() },
  ];
}
