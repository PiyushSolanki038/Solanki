import { supabase } from "@/core/api/client";

export type BackgroundJobType =
  | "document.generate"
  | "document.generate_pdf"
  | "email.send"
  | "email.reminder"
  | "contract.expiry_alert";

export interface EnqueueJobInput {
  organizationId?: string;
  // Compatibility alias while callers migrate.
  tenantId?: string;
  jobType: BackgroundJobType;
  payload: Record<string, unknown>;
  priority?: number;
  availableAt?: string;
  maxAttempts?: number;
  createdBy?: string | null;
}

function resolveOrganizationId(input: { organizationId?: string; tenantId?: string }): string {
  const value = input.organizationId ?? input.tenantId;
  if (!value) {
    throw new Error("organizationId is required to enqueue a background job");
  }
  return value;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<string | null> {
  const unsafeSupabase = supabase as unknown as {
    from: (table: string) => {
      insert: (payload: unknown) => {
        select: (columns: string) => {
          single: () => Promise<{ data: { id?: string } | null; error: { message?: string } | null }>;
        };
      };
    };
  };
  const organizationId = resolveOrganizationId(input);

  const { data, error } = await unsafeSupabase
    .from("background_jobs")
    .insert({
      organization_id: organizationId,
      job_type: input.jobType,
      payload: input.payload,
      status: "queued",
      priority: input.priority ?? 100,
      available_at: input.availableAt ?? new Date().toISOString(),
      max_attempts: input.maxAttempts ?? 5,
      created_by: input.createdBy ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return null;
  return data?.id ?? null;
}

export async function enqueueDocumentPdfJob(input: {
  organizationId?: string;
  tenantId?: string;
  documentId: string;
  documentName: string;
  format?: string;
  createdBy?: string | null;
}) {
  return enqueueJob({
    organizationId: input.organizationId ?? input.tenantId,
    jobType: "document.generate_pdf",
    payload: {
      document_id: input.documentId,
      document_name: input.documentName,
      format: input.format ?? "pdf",
    },
    createdBy: input.createdBy ?? null,
  });
}

export async function enqueueEmailSendJob(input: {
  organizationId?: string;
  tenantId?: string;
  to: string;
  template: string;
  payload?: Record<string, unknown>;
  createdBy?: string | null;
}) {
  return enqueueJob({
    organizationId: input.organizationId ?? input.tenantId,
    jobType: "email.send",
    payload: {
      to: input.to,
      template: input.template,
      ...(input.payload ?? {}),
    },
    createdBy: input.createdBy ?? null,
  });
}

export async function enqueueReminderJob(input: {
  organizationId?: string;
  tenantId?: string;
  recipientEmail: string;
  entityType: "document_signature" | "contract_signature";
  entityId: string;
  createdBy?: string | null;
}) {
  return enqueueJob({
    organizationId: input.organizationId ?? input.tenantId,
    jobType: "email.reminder",
    payload: {
      recipient_email: input.recipientEmail,
      entity_type: input.entityType,
      entity_id: input.entityId,
    },
    createdBy: input.createdBy ?? null,
  });
}

export async function enqueueContractExpiryAlert(input: {
  organizationId?: string;
  tenantId?: string;
  contractId: string;
  contractName?: string;
  daysUntilExpiry?: number;
  createdBy?: string | null;
}) {
  return enqueueJob({
    organizationId: input.organizationId ?? input.tenantId,
    jobType: "contract.expiry_alert",
    payload: {
      contract_id: input.contractId,
      contract_name: input.contractName ?? null,
      days_until_expiry: input.daysUntilExpiry ?? null,
    },
    createdBy: input.createdBy ?? null,
  });
}
