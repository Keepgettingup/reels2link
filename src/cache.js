// URL-based caching for Instagram Reels
// Avoids re-converting the same Instagram URL multiple times

const urlCache = new Map(); // url -> { id, key, expires, sizeMb, cachedAt }

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours default cache TTL

export function getFromCache(url) {
  const cached = urlCache.get(url);
  if (!cached) return null;
  
  // Check if cache entry is expired
  const age = Date.now() - cached.cachedAt;
  if (age > CACHE_TTL_MS) {
    urlCache.delete(url);
    return null;
  }
  
  // Check if the link itself is expired
  if (new Date(cached.expires) < new Date()) {
    urlCache.delete(url);
    return null;
  }
  
  console.log(`[Cache] HIT for ${url}`);
  return cached;
}

export function setInCache(url, { id, key, expires, sizeMb }) {
  urlCache.set(url, {
    id,
    key,
    expires,
    sizeMb,
    cachedAt: Date.now(),
  });
  console.log(`[Cache] SET for ${url}`);
}

export function clearCache() {
  urlCache.clear();
  console.log("[Cache] CLEARED");
}

export function getCacheStats() {
  return {
    size: urlCache.size,
    entries: Array.from(urlCache.entries()).map(([url, data]) => ({
      url,
      id: data.id,
      cachedAt: new Date(data.cachedAt).toISOString(),
      expires: data.expires,
    })),
  };
}

// Periodic cleanup of expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [url, cached] of urlCache.entries()) {
    const age = now - cached.cachedAt;
    if (age > CACHE_TTL_MS || new Date(cached.expires) < new Date()) {
      urlCache.delete(url);
      console.log(`[Cache] EXPIRED ${url}`);
    }
  }
}, 60 * 60 * 1000); // Cleanup every hour
