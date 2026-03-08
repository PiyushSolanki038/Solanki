import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const HANDLERS = {
  "document.generate": async (job) => {
    console.log(`[job:${job.id}] document.generate`, job.payload);
  },
  "document.generate_pdf": async (job) => {
    console.log(`[job:${job.id}] document.generate_pdf`, job.payload);
  },
  "email.send": async (job) => {
    console.log(`[job:${job.id}] email.send`, job.payload);
  },
  "email.reminder": async (job) => {
    console.log(`[job:${job.id}] email.reminder`, job.payload);
  },
  "contract.expiry_alert": async (job) => {
    console.log(`[job:${job.id}] contract.expiry_alert`, job.payload);
  },
};

async function claimJobs(limit = 10) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("status", "queued")
    .lte("available_at", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function markProcessing(jobId) {
  await supabase
    .from("background_jobs")
    .update({
      status: "processing",
      locked_at: new Date().toISOString(),
      locked_by: "node-worker",
    })
    .eq("id", jobId);
}

async function markDone(jobId) {
  await supabase
    .from("background_jobs")
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId);
}

async function markFailed(job, errorMessage) {
  const nextAttempts = (job.attempts ?? 0) + 1;
  const exhausted = nextAttempts >= (job.max_attempts ?? 5);
  await supabase
    .from("background_jobs")
    .update({
      status: exhausted ? "failed" : "queued",
      attempts: nextAttempts,
      last_error: errorMessage,
      locked_at: null,
      locked_by: null,
      available_at: exhausted ? job.available_at : new Date(Date.now() + 60_000).toISOString(),
      finished_at: exhausted ? new Date().toISOString() : null,
    })
    .eq("id", job.id);
}

async function processJob(job) {
  const handler = HANDLERS[job.job_type];
  if (!handler) {
    await markFailed(job, `No handler registered for job type: ${job.job_type}`);
    return;
  }

  try {
    await markProcessing(job.id);
    await handler(job);
    await markDone(job.id);
  } catch (error) {
    await markFailed(job, error instanceof Error ? error.message : String(error));
  }
}

async function run() {
  const jobs = await claimJobs();
  if (!jobs.length) {
    console.log("No queued jobs.");
    return;
  }

  for (const job of jobs) {
    await processJob(job);
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Worker failed:", error);
    process.exit(1);
  });

