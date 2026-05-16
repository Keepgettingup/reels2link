// In-memory job queue for parallel conversion management
// Prevents overwhelming ffmpeg/yt-dlp with too many concurrent jobs

const MAX_CONCURRENT_JOBS = 2; // Max parallel conversions
const queue = [];
const activeJobs = new Set();

export async function enqueueJob(jobFn) {
  return new Promise((resolve, reject) => {
    const job = {
      fn: jobFn,
      resolve,
      reject,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      queuedAt: Date.now(),
    };
    
    queue.push(job);
    console.log(`[Queue] ENQUEUED job ${job.id} (queue size: ${queue.length})`);
    
    processQueue();
  });
}

async function processQueue() {
  // If we're at max capacity, don't start more jobs
  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    console.log(`[Queue] At capacity (${activeJobs.size}/${MAX_CONCURRENT_JOBS}), waiting...`);
    return;
  }
  
  // If queue is empty, nothing to do
  if (queue.length === 0) {
    console.log(`[Queue] Empty, ${activeJobs.size} active jobs`);
    return;
  }
  
  // Take next job from queue
  const job = queue.shift();
  activeJobs.add(job.id);
  const waitTime = Date.now() - job.queuedAt;
  console.log(`[Queue] STARTING job ${job.id} (waited ${waitTime}ms, active: ${activeJobs.size}/${MAX_CONCURRENT_JOBS})`);
  
  try {
    const result = await job.fn();
    job.resolve(result);
    console.log(`[Queue] COMPLETED job ${job.id}`);
  } catch (err) {
    job.reject(err);
    console.error(`[Queue] FAILED job ${job.id}:`, err.message);
  } finally {
    activeJobs.delete(job.id);
    // Process next job
    processQueue();
  }
}

export function getQueueStats() {
  return {
    queueLength: queue.length,
    activeJobs: activeJobs.size,
    maxConcurrent: MAX_CONCURRENT_JOBS,
    queue: queue.map(job => ({
      id: job.id,
      queuedAt: new Date(job.queuedAt).toISOString(),
      waitTime: Date.now() - job.queuedAt,
    })),
  };
}

export function clearQueue() {
  // Reject all queued jobs
  for (const job of queue) {
    job.reject(new Error("Queue cleared"));
  }
  queue.length = 0;
  console.log("[Queue] CLEARED");
}
