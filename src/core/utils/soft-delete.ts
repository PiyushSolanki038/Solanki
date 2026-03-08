import { supabase } from "@/core/api/client";

interface SoftDeleteInput {
  table: string;
  id: string;
  userId?: string | null;
  /** Required for tenant isolation — scopes the delete to the given organization. */
  organizationId?: string | null;
}

interface RestoreInput {
  table: string;
  id: string;
  /** Required for tenant isolation — scopes the restore to the given organization. */
  organizationId?: string | null;
}

/**
 * Soft delete convention:
 * - set `deleted_at`
 * - set `deleted_by`
 * - keep record for audit and recovery
 *
 * When `organizationId` is provided the query is scoped to that
 * organization, preventing cross-tenant deletions (defense-in-depth
 * on top of RLS).
 */
export async function softDeleteRecord(input: SoftDeleteInput): Promise<boolean> {
  if (!input.organizationId) {
    console.warn(
      `[softDeleteRecord] Missing organizationId for table "${input.table}" (ID: ${input.id}). ` +
        "Falling back to id-only delete — ensure RLS covers this.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase.from(input.table as any).update({
    deleted_at: new Date().toISOString(),
    deleted_by: input.userId ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", input.id);

  if (input.organizationId) {
    query = query.eq("organization_id", input.organizationId);
  }

  const { error } = await query;

  if (error) {
    console.error(`Soft delete error on table ${input.table} (ID: ${input.id}):`, error);
    throw new Error(error.message || `Failed to soft delete record in ${input.table}`);
  }

  return true;
}

export async function restoreSoftDeletedRecord(input: RestoreInput): Promise<boolean> {
  if (!input.organizationId) {
    console.warn(
      `[restoreSoftDeletedRecord] Missing organizationId for table "${input.table}" (ID: ${input.id}). ` +
        "Falling back to id-only restore — ensure RLS covers this.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase.from(input.table as any).update({
    deleted_at: null,
    deleted_by: null,
    updated_at: new Date().toISOString(),
  }).eq("id", input.id);

  if (input.organizationId) {
    query = query.eq("organization_id", input.organizationId);
  }

  const { error } = await query;

  if (error) {
    console.error(`Restore soft delete error on table ${input.table} (ID: ${input.id}):`, error);
    throw new Error(error.message || `Failed to restore record in ${input.table}`);
  }

  return true;
}
