import { createReadStream } from "fs";

const BUCKET = process.env.BUNNY_STORAGE_BUCKET || "spool-reels";
const BUNNY_PASSWORD = process.env.BUNNY_STORAGE_SECRET_KEY;
const BUNNY_ENDPOINT = process.env.BUNNY_STORAGE_ENDPOINT || "https://storage.bunnycdn.com";

// Debug logging
console.log("[Storage] BUCKET:", BUCKET);
console.log("[Storage] ENDPOINT:", BUNNY_ENDPOINT);
console.log("[Storage] PASSWORD length:", BUNNY_PASSWORD?.length || 0);
console.log("[Storage] PASSWORD first 10 chars:", BUNNY_PASSWORD?.substring(0, 10) || "undefined");

// Check if endpoint already includes bucket name
const ENDPOINT_HAS_BUCKET = BUNNY_ENDPOINT.endsWith(`/${BUCKET}`) || BUNNY_ENDPOINT.endsWith(`/${BUCKET}/`);
const BASE_URL = ENDPOINT_HAS_BUCKET ? BUNNY_ENDPOINT.replace(/\/$/, '') : `${BUNNY_ENDPOINT}/${BUCKET}`;

console.log("[Storage] BASE_URL:", BASE_URL);

const linkRegistry = new Map();

export async function uploadToStorage(filePath, key) {
  const url = `${BASE_URL}/${key}`;
  
  console.log(`Uploading to: ${url}`);
  console.log(`AccessKey header length: ${BUNNY_PASSWORD?.length || 0}`);
  
  // Stream file instead of buffering entire file in memory
  const fileStream = createReadStream(filePath);
  
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "AccessKey": BUNNY_PASSWORD,
      "Content-Type": "application/octet-stream",
    },
    body: fileStream,
    duplex: "half",
  });
  
  if (!response.ok) {
    const text = await response.text().catch(() => "No body");
    console.error(`Bunny upload failed: ${response.status} ${response.statusText}`);
    console.error(`Response body: ${text}`);
    throw new Error(`Bunny upload failed: ${response.status} ${response.statusText}`);
  }
}

export async function getLink(id) {
  const meta = linkRegistry.get(id);
  if (!meta) return null;
  if (new Date(meta.expires) < new Date()) {
    await deleteFromStorage(meta.key);
    linkRegistry.delete(id);
    return null;
  }
  // Bunny doesn't need signed URLs - files are public by default
  const publicUrl = `${BASE_URL}/${meta.key}`;
  return { ...meta, signedUrl: publicUrl };
}

export async function saveLink(id, meta) {
  linkRegistry.set(id, meta);
}

export async function deleteFromStorage(key) {
  const url = `${BASE_URL}/${key}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      "AccessKey": BUNNY_PASSWORD,
    },
  });
}

export async function purgeExpiredLinks() {
  const now = new Date();
  for (const [id, meta] of linkRegistry.entries()) {
    if (new Date(meta.expires) < now) {
      await deleteFromStorage(meta.key).catch(console.error);
      linkRegistry.delete(id);
      console.log(`Purged expired link: ${id}`);
    }
  }
}

setInterval(purgeExpiredLinks, 60 * 60 * 1000);
