// Auto Documents Type Definitions

export type DocumentStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "sent"
  | "signed"
  | "rejected"
  | "expired"
  | "published"
  | "archived";

export type DocumentType = "proposal" | "invoice" | "agreement" | "report" | "policy" | "manual" | "other";
export type DocumentFormat = "pdf" | "docx" | "doc" | "xlsx" | "txt" | "html";
export type DocumentESignatureStatus = "pending" | "signed" | "rejected" | "expired";

export interface AutoDocument {
  id: string;
  tenant_id?: string;
  name: string;
  type: DocumentType;
  status: DocumentStatus;
  content?: string;
  template_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  file_path?: string;
  file_name?: string;
  format?: DocumentFormat;
  file_size?: number;
  generated_from?: string;
  owner_id?: string;
  created_by?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplate {
  id: string;
  tenant_id?: string;
  name: string;
  type: DocumentType;
  description?: string;
  content: string;
  variables?: Record<string, string | number | boolean | null>;
  is_active?: boolean;
  is_public?: boolean;
  created_by?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content?: string;
  file_path?: string;
  file_name?: string;
  format?: DocumentFormat;
  file_size?: number;
  change_summary?: string;
  created_by?: string;
  created_at: string;
}

export interface DocumentPermission {
  id: string;
  document_id: string;
  user_id: string;
  permission_type: "view" | "edit" | "comment" | "share";
  shared_by?: string;
  created_at: string;
}

export interface DocumentESignature {
  id: string;
  document_id: string;
  recipient_name: string;
  recipient_email: string;
  status: DocumentESignatureStatus;
  signed_at?: string;
  rejection_reason?: string;
  expires_at?: string;
  sent_at?: string;
  reminder_count?: number;
  last_reminder_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  pending_review: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  sent: "bg-info/15 text-info",
  signed: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  expired: "bg-warning/15 text-warning",
  published: "bg-primary/15 text-primary",
  archived: "bg-secondary text-secondary-foreground",
};

export const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  proposal: "bg-primary/15 text-primary",
  invoice: "bg-success/15 text-success",
  agreement: "bg-info/15 text-info",
  report: "bg-primary/15 text-primary",
  policy: "bg-warning/15 text-warning",
  manual: "bg-info/15 text-info",
  other: "bg-secondary text-secondary-foreground",
};
