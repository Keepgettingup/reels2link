import { execFile } from "child_process";
import { promisify } from "util";
import { createWriteStream, statSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { uploadToStorage, saveLink } from "./storage.js";
import { enqueueJob } from "./queue.js";

const exec = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

// Check if video is already in optimal format (MP4 with H.264/AAC)
async function isOptimalFormat(filePath) {
  try {
    const { stdout } = await exec(FFMPEG, [
      "-i", filePath,
      "-f", "null",
      "-"
    ], { stdio: ["ignore", "pipe", "pipe"] });
    
    // Parse output for codec info
    const stderr = stdout;
    const hasH264 = stderr.includes("Video: h264") || stderr.includes("Video: H.264");
    const hasAAC = stderr.includes("Audio: aac") || stderr.includes("Audio: AAC");
    const isMP4 = stderr.includes("mp4");
    
    return hasH264 && hasAAC && isMP4;
  } catch {
    return false;
  }
}

export async function convertReel(instagramUrl, ttl = "30d") {
  // Enqueue conversion job for parallel management
  return enqueueJob(() => doConvertReel(instagramUrl, ttl));
}

async function doConvertReel(instagramUrl, ttl = "30d") {
  const tmpPath = path.join(tmpdir(), `spool_${randomUUID()}.mp4`);
  try {
    await downloadWithYtDlp(instagramUrl, tmpPath);
    
    // Check if video is already in optimal format
    const isOptimal = await isOptimalFormat(tmpPath);
    let finalPath = tmpPath;
    
    if (!isOptimal) {
      console.log("[Converter] Video not in optimal format, re-encoding...");
      const outPath = path.join(tmpdir(), `spool_out_${randomUUID()}.mp4`);
      await reEncodeWithFfmpeg(tmpPath, outPath);
      safeUnlink(tmpPath);
      finalPath = outPath;
    } else {
      console.log("[Converter] Video already in optimal format, skipping re-encoding");
    }
    
    const { size } = statSync(finalPath);
    const sizeMb = parseFloat((size / 1024 / 1024).toFixed(2));
    const id = randomUUID().slice(0, 8);
    const key = `reels/${id}.mp4`;
    await uploadToStorage(finalPath, key);
    const ttlMs = parseTtl(ttl);
    const expires = new Date(Date.now() + ttlMs).toISOString();
    await saveLink(id, { key, expires, sizeMb });
    
    safeUnlink(finalPath);
    return {
      link: `${process.env.BASE_URL}/v/${id}`,
      expires,
      size_mb: sizeMb,
    };
  } catch (err) {
    safeUnlink(tmpPath);
    throw err;
  }
}

async function downloadWithYtDlp(url, outputPath) {
  try {
    const { stdout, stderr } = await exec(YTDLP, [
      "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "--output", outputPath,
      "--no-playlist",
      url,
    ]);
    if (stderr) console.error("yt-dlp stderr:", stderr);
  } catch (err) {
    console.error("yt-dlp failed:", err.message);
    throw new Error(`Failed to download video: ${err.message}`);
  }
}

async function reEncodeWithFfmpeg(inputPath, outputPath) {
  await exec(FFMPEG, [
    "-i", inputPath,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  ]);
}

function parseTtl(ttl) {
  const match = ttl.match(/^(\d+)(mo|y|d|h|m)$/);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}. Use e.g. 30d, 24h, 1mo, 1y`);
  const [, n, unit] = match;
  const ms = { mo: 30 * 86400000, y: 365 * 86400000, d: 86400000, h: 3600000, m: 60000 };
  return parseInt(n) * ms[unit];
}

function safeUnlink(p) {
  try { unlinkSync(p); } catch {}
}
