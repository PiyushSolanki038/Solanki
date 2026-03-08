import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";
import { Textarea } from "@/ui/shadcn/textarea";
import { useContacts } from "@/modules/crm/hooks/useCRM";
import {
  useAutoDocument,
  useCreateDocumentESignature,
  useDocumentESignatures,
  useSendDocumentReminder,
  useUpdateAutoDocument,
  useUpdateDocumentESignature,
} from "@/modules/documents/hooks/useDocuments";
import { DOCUMENT_STATUS_COLORS } from "@/core/types/documents";
import { ArrowLeft, CheckCircle2, Clock, Download, Mail, Send, XCircle } from "lucide-react";

const signatureBadgeStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  signed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

type DocumentContent = {
  templateName?: string;
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  effectiveDate?: string;
  expiryDate?: string;
  notes?: string;
};

const DocumentESignPage = () => {
  const { id: documentId } = useParams<{ id: string }>();
  const { data: document, isLoading: isDocumentLoading } = useAutoDocument(documentId || "");
  const { data: signatures = [], isLoading: isSignaturesLoading, refetch } = useDocumentESignatures(documentId);
  const { data: contacts = [] } = useContacts();
  const createSignatureMutation = useCreateDocumentESignature();
  const updateSignatureMutation = useUpdateDocumentESignature();
  const sendReminderMutation = useSendDocumentReminder();
  const updateDocumentMutation = useUpdateAutoDocument();

  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [rejectionReason, setRejectionReason] = useState("");

  const parsedContent = useMemo(() => {
    if (!document?.content) {
      return null;
    }
    try {
      return JSON.parse(document.content) as DocumentContent;
    } catch {
      return null;
    }
  }, [document?.content]);

  const pendingCount = signatures.filter((signature) => signature.status === "pending").length;
  const signedCount = signatures.filter((signature) => signature.status === "signed").length;

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    const selectedContact = contacts.find((contact) => contact.id === contactId);
    if (!selectedContact) {
      return;
    }

    const fullName = `${selectedContact.first_name} ${selectedContact.last_name}`.trim();
    setRecipientName(fullName);
    setRecipientEmail(selectedContact.email || "");
  };

  const handleAddRecipient = async () => {
    if (!documentId) {
      return;
    }

    if (!recipientName.trim() || !recipientEmail.trim()) {
      toast.error("Recipient name and email are required");
      return;
    }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + Number.parseInt(expiresInDays, 10));

    try {
      await createSignatureMutation.mutateAsync({
        document_id: documentId,
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim().toLowerCase(),
        status: "pending",
        expires_at: expirationDate.toISOString(),
      });

      setRecipientName("");
      setRecipientEmail("");
      setSelectedContactId("");
    } catch {
      // Toast handled in mutation onError
    }
  };

  const handleMarkSigned = async (signatureId: string) => {
    if (!documentId) {
      return;
    }

    try {
      await updateSignatureMutation.mutateAsync({
        id: signatureId,
        document_id: documentId,
        status: "signed",
      });
    } catch {
      // Toast handled in mutation onError
    }
  };

  const handleReject = async (signatureId: string) => {
    if (!documentId) {
      return;
    }

    try {
      await updateSignatureMutation.mutateAsync({
        id: signatureId,
        document_id: documentId,
        status: "rejected",
        rejection_reason: rejectionReason.trim() || "Rejected by signer",
      });
      setRejectionReason("");
    } catch {
      // Toast handled in mutation onError
    }
  };

  const handleSendReminder = async (signatureId: string) => {
    try {
      await sendReminderMutation.mutateAsync(signatureId);
    } catch {
      // Toast handled in mutation onError
    }
  };

  const handleDownloadPayload = () => {
    if (!document) {
      return;
    }

    const payload = document.content || JSON.stringify(document, null, 2);
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement("a");
    link.href = url;
    link.download = `${document.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSetApproved = async () => {
    if (!documentId) {
      return;
    }

    try {
      await updateDocumentMutation.mutateAsync({
        id: documentId,
        status: "approved",
      });
    } catch {
      // Toast handled in mutation onError
    }
  };

  if (!documentId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Invalid document identifier.
      </div>
    );
  }

  if (isDocumentLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Loading document...
      </div>
    );
  }

  if (!document) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Document not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/dashboard/documents/history" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to History
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{document.name}</h1>
          <p className="text-muted-foreground">Manage e-signatures and track signing in real time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {document.status === "draft" || document.status === "pending_review" ? (
            <Button variant="outline" onClick={handleSetApproved} disabled={updateDocumentMutation.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark Ready for Signature
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => refetch()}>
            <Clock className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleDownloadPayload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Send Signature Request</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Select Contact (Optional)</Label>
                <Select value={selectedContactId} onValueChange={handleSelectContact}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an existing contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name} {contact.email ? `(${contact.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  placeholder="Full name"
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientEmail">Recipient Email</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="email@company.com"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiresInDays">Expires In</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger id="expiresInDays">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Default Rejection Note</Label>
                <Textarea
                  id="rejectionReason"
                  rows={3}
                  placeholder="Optional reason when declining signatures"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleAddRecipient} disabled={createSignatureMutation.isPending}>
                <Send className="mr-2 h-4 w-4" />
                Send Signature Request
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Signature Activity</h2>
              <div className="text-sm text-muted-foreground">
                {pendingCount} pending / {signedCount} signed
              </div>
            </div>

            {isSignaturesLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading signature requests...</div>
            ) : signatures.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No signature requests have been sent.</div>
            ) : (
              <div className="space-y-3">
                {signatures.map((signature) => (
                  <div key={signature.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-medium text-foreground">{signature.recipient_name}</div>
                        <div className="text-sm text-muted-foreground">{signature.recipient_email}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Sent {formatDistanceToNow(new Date(signature.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${signatureBadgeStyles[signature.status] || signatureBadgeStyles.pending}`}>
                          {signature.status}
                        </span>
                        {signature.status === "pending" ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleSendReminder(signature.id)}>
                              <Mail className="mr-1 h-3.5 w-3.5" />
                              Remind
                            </Button>
                            <Button size="sm" onClick={() => handleMarkSigned(signature.id)}>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Mark Signed
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleReject(signature.id)}>
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {signature.status === "signed" && signature.signed_at ? (
                      <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                        Signed {formatDistanceToNow(new Date(signature.signed_at), { addSuffix: true })}
                      </div>
                    ) : null}
                    {signature.status === "rejected" && signature.rejection_reason ? (
                      <div className="mt-2 text-xs text-red-700 dark:text-red-400">{signature.rejection_reason}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Document</h3>
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-foreground">{document.name}</div>
              <div className="capitalize text-muted-foreground">{document.type}</div>
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${DOCUMENT_STATUS_COLORS[document.status]}`}>
                {document.status}
              </span>
              <div className="text-muted-foreground">
                Created {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payload Summary</h3>
            {parsedContent ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Template: {parsedContent.templateName || "N/A"}</div>
                <div>Account: {parsedContent.accountName || "N/A"}</div>
                <div>Contact: {parsedContent.contactName || "N/A"}</div>
                <div>Email: {parsedContent.contactEmail || "N/A"}</div>
                <div>Effective: {parsedContent.effectiveDate || "N/A"}</div>
                <div>Expires: {parsedContent.expiryDate || "N/A"}</div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No structured payload available for this document.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default DocumentESignPage;
