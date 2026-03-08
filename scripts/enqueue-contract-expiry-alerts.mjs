import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const lookAheadDays = Number(process.env.CONTRACT_EXPIRY_LOOKAHEAD_DAYS || "30");

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

function toDateOnlyISO(date) {
  return date.toISOString().split("T")[0];
}

async function main() {
  const today = new Date();
  const end = new Date(today.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
  const fromDate = toDateOnlyISO(today);
  const toDate = toDateOnlyISO(end);

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("id,name,tenant_id,end_date,status")
    .not("end_date", "is", null)
    .gte("end_date", fromDate)
    .lte("end_date", toDate)
    .neq("status", "expired")
    .neq("status", "cancelled");

  if (error) {
    console.error("Failed to query expiring contracts:", error.message);
    process.exit(1);
  }

  const rows = contracts ?? [];
  if (!rows.length) {
    console.log(`No contracts expiring in next ${lookAheadDays} days.`);
    return;
  }

  let enqueuedCount = 0;

  for (const contract of rows) {
    const { data: existing } = await supabase
      .from("background_jobs")
      .select("id")
      .eq("tenant_id", contract.tenant_id)
      .eq("job_type", "contract.expiry_alert")
      .in("status", ["queued", "processing"])
      .contains("payload", { contract_id: contract.id })
      .limit(1);

    if (existing && existing.length > 0) {
      continue;
    }

    const expiryDate = new Date(contract.end_date);
    const daysUntilExpiry = Math.max(
      0,
      Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
    );

    const { error: enqueueError } = await supabase.from("background_jobs").insert({
      tenant_id: contract.tenant_id,
      job_type: "contract.expiry_alert",
      payload: {
        contract_id: contract.id,
        contract_name: contract.name,
        contract_end_date: contract.end_date,
        days_until_expiry: daysUntilExpiry,
      },
      status: "queued",
      priority: 80,
      available_at: new Date().toISOString(),
      max_attempts: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (!enqueueError) {
      enqueuedCount += 1;
    }
  }

  console.log(`Contracts scanned: ${rows.length}, alerts queued: ${enqueuedCount}`);
}

main().catch((error) => {
  console.error("Failed to enqueue contract expiry alerts:", error);
  process.exit(1);
});
