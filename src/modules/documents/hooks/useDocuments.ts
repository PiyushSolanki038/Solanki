import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import type {
  AutoDocument,
  DocumentESignature,
  DocumentPermission,
  DocumentTemplate,
  DocumentVersion,
} from "@/core/types/documents";
import { toast } from "sonner";
import { enqueueDocumentPdfJob, enqueueEmailSendJob, enqueueReminderJob } from "@/core/utils/jobs";
import { softDeleteRecord } from "@/core/utils/soft-delete";
import { writeAuditLog } from "@/core/utils/audit";
import { applyTenantOwnershipScope, withOwnershipCreate } from "@/core/utils/data-ownership";
import { isPlatformRole } from "@/core/types/roles";

type DocumentESignatureWithDocument = DocumentESignature & {
  document?: Pick<AutoDocument, "id" | "name" | "type" | "status" | "created_at" | "updated_at"> | null;
};

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { code?: string }).code === "42P01";
}

function useDocumentsRealtime(userId?: string, scope = "global", organizationId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      return;
    }

    const orgFilter = organizationId
      ? `organization_id=eq.${organizationId}`
      : undefined;

    const channel = supabase
      .channel(`documents-realtime-${userId}-${scope}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auto_documents", filter: orgFilter }, () => {
        queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
        queryClient.invalidateQueries({ queryKey: ["auto_document"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "document_templates", filter: orgFilter }, () => {
        queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "document_esignatures", filter: orgFilter }, () => {
        queryClient.invalidateQueries({ queryKey: ["document_esignatures"] });
        queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, scope, userId, organizationId]);
}

async function syncAutoDocumentStatusFromSignatures(documentId: string): Promise<void> {
  const { data, error } = await supabase
    .from("document_esignatures")
    .select("status")
    .eq("document_id", documentId);

  if (error || !data) {
    if (error && !isMissingTableError(error)) {
      throw error;
    }
    return;
  }

  const statuses = data.map((row) => row.status);
  if (statuses.length === 0) {
    return;
  }

  let nextStatus: AutoDocument["status"] = "sent";

  // determine the next document status by precedence:
  // rejected > expired > pending > signed (all)
  if (statuses.includes("rejected")) {
    nextStatus = "rejected";
  } else if (statuses.includes("expired")) {
    nextStatus = "expired";
  } else if (statuses.includes("pending")) {
    nextStatus = "sent";
  } else if (statuses.every((status) => status === "signed")) {
    nextStatus = "signed";
  }

  const { error: updateError } = await supabase
    .from("auto_documents")
    .update({ status: nextStatus })
    .eq("id", documentId);

  if (updateError && !isMissingTableError(updateError)) {
    throw updateError;
  }
}

// ===== DOCUMENT TEMPLATES =====
export function useDocumentTemplates() {
  const { user, role } = useAuth();
  const { organization } = useOrganization();
  useDocumentsRealtime(user?.id, "templates", organization?.id);

  return useQuery({
    queryKey: ["document_templates", user?.id, organization?.id],
    enabled: !!user,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      let query = supabase
        .from("document_templates")
        .select("*")
        .is("deleted_at", null)
        .or(`created_by.eq.${user.id},is_public.eq.true`)
        .order("updated_at", { ascending: false });

      query = applyTenantOwnershipScope(query, {
        organizationId: organization?.id,
        isPlatformAdmin: isPlatformRole(role),
      });

      const { data, error } = await query;

      if (error) {
        if (isMissingTableError(error)) {
          return [];
        }
        throw error;
      }

      return (data || []) as DocumentTemplate[];
    },
  });
}

export function useCreateDocumentTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (template: Omit<Partial<DocumentTemplate>, "id" | "created_at" | "updated_at">) => {
      const payload = withOwnershipCreate(
        {
          name: template.name || "",
          type: template.type || "other",
          description: template.description,
          content: template.content || "",
          variables: template.variables || {},
          is_active: template.is_active ?? true,
          is_public: template.is_public ?? false,
          created_by: user?.id,
        },
        {
          organizationId: organization?.id,
          userId: user?.id,
          isPlatformAdmin: false,
        },
      );

      const { data, error } = await supabase
        .from("document_templates")
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      void writeAuditLog({
        action: "document_template_created",
        entityType: "document_templates",
        entityId: data.id,
        organizationId: organization?.id ?? null,
        userId: user?.id ?? null,
        newValues: { name: data.name, type: data.type, is_public: data.is_public },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      toast.success("Document template created successfully");
    },
    onError: (error) => {
      toast.error("Error creating document template: " + error.message);
    },
  });
}

export function useUpdateDocumentTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DocumentTemplate> & { id: string }) => {
      if (!organization?.id) {
        throw new Error("Organization context is required");
      }

      const { data, error } = await supabase
        .from("document_templates")
        .update(updates)
        .eq("id", id)
        .eq("organization_id", organization.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      void writeAuditLog({
        action: "document_template_updated",
        entityType: "document_templates",
        entityId: id,
        organizationId: organization?.id ?? null,
        userId: user?.id ?? null,
        newValues: updates,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      toast.success("Document template updated successfully");
    },
    onError: (error) => {
      toast.error("Error updating document template: " + error.message);
    },
  });
}

export function useDeleteDocumentTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const ok = await softDeleteRecord({
        table: "document_templates",
        id,
        userId: user?.id ?? null,
        organizationId: organization?.id ?? null,
      });
      if (!ok) {
        throw new Error("Failed to soft-delete template");
      }

      void writeAuditLog({
        action: "document_template_soft_deleted",
        entityType: "document_templates",
        entityId: id,
        organizationId: organization?.id ?? null,
        userId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      toast.success("Document template moved to recycle bin");
    },
    onError: (error) => {
      toast.error("Error deleting document template: " + error.message);
    },
  });
}

// ===== AUTO DOCUMENTS =====
export function useAutoDocuments() {
  const { user, role } = useAuth();
  const { organization } = useOrganization();
  useDocumentsRealtime(user?.id, "documents", organization?.id);

  return useQuery({
    queryKey: ["auto_documents", user?.id, organization?.id],
    enabled: !!user,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      let query = supabase.from("auto_documents").select("*").is("deleted_at", null);
      query = applyTenantOwnershipScope(query, {
        organizationId: organization?.id,
        isPlatformAdmin: isPlatformRole(role),
      });

      if (!isPlatformRole(role)) {
        query = query.or(`owner_id.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []) as AutoDocument[];
    },
  });
}

export function useAutoDocument(id: string) {
  const { user, role } = useAuth();
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ["auto_document", id, user?.id, organization?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      let query = supabase
        .from("auto_documents")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null);

      query = applyTenantOwnershipScope(query, {
        organizationId: organization?.id,
        isPlatformAdmin: isPlatformRole(role),
      });

      if (!isPlatformRole(role)) {
        query = query.or(`owner_id.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query.single();

      if (error) {
        throw error;
      }

      return data as AutoDocument;
    },
  });
}

export function useCreateAutoDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (doc: Omit<Partial<AutoDocument>, "id" | "created_at" | "updated_at">) => {
      if (!organization?.id) {
        throw new Error("Organization context is required");
      }

      const payload = withOwnershipCreate(
        {
          name: doc.name || "",
          type: doc.type || "other",
          status: doc.status || "draft",
          content: doc.content,
          template_id: doc.template_id,
          related_entity_type: doc.related_entity_type,
          related_entity_id: doc.related_entity_id,
          file_path: doc.file_path,
          file_name: doc.file_name,
          format: doc.format,
          file_size: doc.file_size,
          generated_from: doc.generated_from || "template",
          owner_id: user?.id,
          created_by: user?.id,
        },
        {
          organizationId: organization.id,
          userId: user?.id,
          isPlatformAdmin: false,
        },
      );

      const { data, error } = await supabase
        .from("auto_documents")
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      void enqueueDocumentPdfJob({
        organizationId: organization.id,
        documentId: data.id,
        documentName: data.name,
        format: doc.format ?? "pdf",
        createdBy: user?.id,
      });

      void writeAuditLog({
        action: "document_created",
        entityType: "auto_documents",
        entityId: data.id,
        organizationId: organization.id,
        userId: user?.id ?? null,
        newValues: { name: data.name, status: data.status, type: data.type },
      });

      return data as AutoDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
      toast.success("Document created successfully");
    },
    onError: (error) => {
      toast.error("Error creating document: " + error.message);
    },
  });
}

export function useUpdateAutoDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutoDocument> & { id: string }) => {
      if (!organization?.id) {
        throw new Error("Organization context is required");
      }

      const { data, error } = await supabase
        .from("auto_documents")
        .update(updates)
        .eq("id", id)
        .eq("organization_id", organization.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      void writeAuditLog({
        action: "document_updated",
        entityType: "auto_documents",
        entityId: id,
        organizationId: organization?.id ?? null,
        userId: user?.id ?? null,
        newValues: updates,
      });

      return data as AutoDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
      queryClient.invalidateQueries({ queryKey: ["auto_document"] });
      toast.success("Document updated successfully");
    },
    onError: (error) => {
      toast.error("Error updating document: " + error.message);
    },
  });
}

export function useDeleteAutoDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const ok = await softDeleteRecord({
        table: "auto_documents",
        id,
        userId: user?.id ?? null,
        organizationId: organization?.id ?? null,
      });
      if (!ok) {
        throw new Error("Failed to soft-delete document");
      }

      void writeAuditLog({
        action: "document_soft_deleted",
        entityType: "auto_documents",
        entityId: id,
        organizationId: organization?.id ?? null,
        userId: user?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
      toast.success("Document moved to recycle bin");
    },
    onError: (error) => {
      toast.error("Error deleting document: " + error.message);
    },
  });
}

// ===== DOCUMENT E-SIGNATURES =====
export function useDocumentESignatures(documentId?: string) {
  const { user, role } = useAuth();
  const { organization } = useOrganization();
  useDocumentsRealtime(user?.id, `esignatures-${documentId || "all"}`, organization?.id);

  return useQuery({
    queryKey: ["document_esignatures", documentId || "all", user?.id, organization?.id],
    enabled: !!user,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      let query = supabase
        .from("document_esignatures")
        .select("*, document:auto_documents(id,name,type,status,created_at,updated_at)")
        .order("created_at", { ascending: false });

      if (documentId) {
        query = query.eq("document_id", documentId);
      }

      // Scope to organization for tenant isolation
      query = applyTenantOwnershipScope(query, {
        organizationId: organization?.id,
        isPlatformAdmin: isPlatformRole(role),
      });

      const { data, error } = await query;

      if (error) {
        if (isMissingTableError(error)) {
          return [];
        }
        throw error;
      }

      return (data || []) as DocumentESignatureWithDocument[];
    },
  });
}

export function useCreateDocumentESignature() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (signature: Omit<Partial<DocumentESignature>, "id" | "created_at" | "updated_at">) => {
      if (!signature.document_id) {
        throw new Error("document_id is required to create an e-signature");
      }

      let resolvedOrganizationId = organization?.id ?? null;
      if (!resolvedOrganizationId) {
        const { data: documentRef } = await supabase
          .from("auto_documents")
          .select("organization_id")
          .eq("id", signature.document_id)
          .maybeSingle();

        resolvedOrganizationId = (documentRef as { organization_id?: string } | null)?.organization_id ?? null;
      }

      const { data, error } = await supabase
        .from("document_esignatures")
        .insert({
          document_id: signature.document_id,
          recipient_name: signature.recipient_name || "",
          recipient_email: signature.recipient_email || "",
          status: signature.status || "pending",
          expires_at: signature.expires_at || null,
          sent_at: new Date().toISOString(),
          reminder_count: 0,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const { error: updateDocError } = await supabase
        .from("auto_documents")
        .update({ status: "sent" })
        .eq("id", signature.document_id)
        .eq("status", "draft");

      if (updateDocError) {
        throw updateDocError;
      }

      if (resolvedOrganizationId && signature.recipient_email) {
        void enqueueEmailSendJob({
          organizationId: resolvedOrganizationId,
          to: signature.recipient_email,
          template: "document_signature_request",
          payload: {
            document_id: signature.document_id,
            signature_id: data.id,
            recipient_name: signature.recipient_name ?? null,
          },
          createdBy: user?.id ?? null,
        });
      }

      void writeAuditLog({
        action: "document_signature_requested",
        entityType: "document_esignatures",
        entityId: data.id,
        organizationId: resolvedOrganizationId,
        userId: user?.id ?? null,
        newValues: {
          document_id: data.document_id,
          recipient_email: data.recipient_email,
          status: data.status,
        },
      });

      return data as DocumentESignature;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document_esignatures"] });
      queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
      queryClient.invalidateQueries({ queryKey: ["auto_document", variables.document_id] });
      toast.success("E-signature request sent successfully");
    },
    onError: (error) => {
      toast.error("Error sending e-signature request: " + error.message);
    },
  });
}

export function useUpdateDocumentESignature() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, document_id, ...updates }: Partial<DocumentESignature> & { id: string }) => {
      const payload = { ...updates } as Partial<DocumentESignature>;
      if (updates.status === "signed") {
        payload.signed_at = updates.signed_at || new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("document_esignatures")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (document_id) {
        await syncAutoDocumentStatusFromSignatures(document_id);
      }

      void writeAuditLog({
        action: "document_signature_updated",
        entityType: "document_esignatures",
        entityId: id,
        organizationId: organization?.id ?? null,
        userId: user?.id ?? null,
        newValues: updates,
      });

      return data as DocumentESignature;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document_esignatures"] });
      queryClient.invalidateQueries({ queryKey: ["auto_documents"] });
      if (variables.document_id) {
        queryClient.invalidateQueries({ queryKey: ["auto_document", variables.document_id] });
      }
      toast.success("Signature status updated");
    },
    onError: (error) => {
      toast.error("Error updating signature: " + error.message);
    },
  });
}

export function useSendDocumentReminder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (signatureId: string) => {
      const { data: current, error: currentError } = await supabase
        .from("document_esignatures")
        .select("id, reminder_count, recipient_email, document_id")
        .eq("id", signatureId)
        .single();

      if (currentError) {
        throw currentError;
      }

      const nextReminderCount = (current?.reminder_count || 0) + 1;
      const { data, error } = await supabase
        .from("document_esignatures")
        .update({
          reminder_count: nextReminderCount,
          last_reminder_at: new Date().toISOString(),
        })
        .eq("id", signatureId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (organization?.id && data.recipient_email) {
        void enqueueReminderJob({
          organizationId: organization.id,
          recipientEmail: data.recipient_email,
          entityType: "document_signature",
          entityId: data.id,
          createdBy: user?.id ?? null,
        });
      }

      void writeAuditLog({
        action: "document_signature_reminder_sent",
        entityType: "document_esignatures",
        entityId: data.id,
        organizationId: organization?.id ?? null,
        userId: user?.id ?? null,
        newValues: {
          reminder_count: data.reminder_count,
          last_reminder_at: data.last_reminder_at,
          document_id: data.document_id,
        },
      });

      return data as DocumentESignature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_esignatures"] });
      toast.success("Reminder sent");
    },
    onError: (error) => {
      toast.error("Error sending reminder: " + error.message);
    },
  });
}

// ===== DOCUMENT VERSIONS =====
export function useDocumentVersions(documentId: string) {
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ["document_versions", documentId, user?.id, organization?.id],
    enabled: !!documentId && !!user,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Verify the user can access the parent document in their organization
      const { data: docCheck } = await supabase
        .from("auto_documents")
        .select("id")
        .eq("id", documentId)
        .eq("organization_id", organization?.id ?? "")
        .maybeSingle();

      if (!docCheck) {
        throw new Error("Document not found or not accessible");
      }

      const { data, error } = await supabase
        .from("document_versions")
        .select("*")
        .eq("document_id", documentId)
        .order("version_number", { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          return [];
        }
        throw error;
      }

      return (data || []) as DocumentVersion[];
    },
  });
}

export function useCreateDocumentVersion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (version: Omit<Partial<DocumentVersion>, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("document_versions")
        .insert({
          document_id: version.document_id || "",
          version_number: version.version_number || 1,
          content: version.content,
          file_path: version.file_path,
          file_name: version.file_name,
          format: version.format,
          file_size: version.file_size,
          change_summary: version.change_summary,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document_versions", variables.document_id] });
      toast.success("Document version created successfully");
    },
    onError: (error) => {
      toast.error("Error creating document version: " + error.message);
    },
  });
}

// ===== DOCUMENT PERMISSIONS =====
export function useDocumentPermissions(documentId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["document_permissions", documentId, user?.id],
    enabled: !!documentId && !!user,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase
        .from("document_permissions")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          return [];
        }
        throw error;
      }

      return (data || []) as DocumentPermission[];
    },
  });
}

export function useShareDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (permission: Omit<Partial<DocumentPermission>, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("document_permissions")
        .insert({
          document_id: permission.document_id || "",
          user_id: permission.user_id || "",
          permission_type: permission.permission_type || "view",
          shared_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document_permissions", variables.document_id] });
      toast.success("Document shared successfully");
    },
    onError: (error) => {
      toast.error("Error sharing document: " + error.message);
    },
  });
}

export function useRemoveDocumentPermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_permissions").delete().eq("id", id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_permissions"] });
      toast.success("Permission removed successfully");
    },
    onError: (error) => {
      toast.error("Error removing permission: " + error.message);
    },
  });
}


