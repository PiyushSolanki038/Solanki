import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PenTool, Send, Plus, Trash2, ArrowLeft, Mail, User, Clock, CheckCircle, Shield, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Badge } from "@/ui/shadcn/badge";
import { Separator } from "@/ui/shadcn/separator";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";
import { Checkbox } from "@/ui/shadcn/checkbox";

interface Signer {
  id: string;
  name: string;
  email: string;
  role: string;
  order: number;
  status: "pending" | "sent" | "signed" | "declined";
}

export default function ESignaturePage() {
  const navigate = useNavigate();
  const { id: contractId } = useParams();

  const [signers, setSigners] = useState<Signer[]>([
    { id: "1", name: "", email: "", role: "signer", order: 1, status: "pending" },
  ]);

  const [options, setOptions] = useState({
    requireOTP: true,
    sendReminders: true,
    expirationDays: 7,
    sequentialSigning: false,
  });

  const addSigner = () => {
    const newSigner: Signer = {
      id: Date.now().toString(),
      name: "",
      email: "",
      role: "signer",
      order: signers.length + 1,
      status: "pending",
    };
    setSigners([...signers, newSigner]);
  };

  const removeSigner = (id: string) => {
    if (signers.length > 1) {
      setSigners(signers.filter((s) => s.id !== id));
    }
  };

  const updateSigner = (id: string, field: keyof Signer, value: Signer[keyof Signer]) => {
    setSigners(signers.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleSendForSignature = () => {
    const validSigners = signers.filter((s) => s.name && s.email);
    if (validSigners.length === 0) {
      toast.error("Please add at least one signer with name and email");
      return;
    }

    // Simulate sending
    toast.success(`Signature request sent to ${validSigners.length} signer(s)`);
    navigate("/dashboard/clm/contracts");
  };

  // Audit trail - will be fetched from database in production
  const auditTrail: Array<{ timestamp: string; action: string; user: string; ip: string }> = [];

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">E-Signature</h1>
              <p className="text-muted-foreground">Configure signature workflow and send for signing</p>
            </div>
          </div>
          <Button onClick={handleSendForSignature}>
            <Send className="h-4 w-4 mr-2" />Send for Signature
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Signers */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Signers</CardTitle>
                    <CardDescription>Add people who need to sign this document</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addSigner}>
                    <Plus className="h-4 w-4 mr-2" />Add Signer
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {signers.map((signer, index) => (
                  <div key={signer.id} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {options.sequentialSigning ? signer.order : index + 1}
                        </div>
                        <span className="font-medium">Signer {index + 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          signer.status === "signed" ? "bg-success/20 text-success-foreground" :
                          signer.status === "sent" ? "bg-info/20 text-info" :
                          "bg-muted text-muted-foreground"
                        }>
                          {signer.status === "signed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {signer.status === "sent" && <Mail className="h-3 w-3 mr-1" />}
                          {signer.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {signer.status.charAt(0).toUpperCase() + signer.status.slice(1)}
                        </Badge>
                        {signers.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeSigner(signer.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={signer.name}
                          onChange={(e) => updateSigner(signer.id, "name", e.target.value)}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                          type="email"
                          value={signer.email}
                          onChange={(e) => updateSigner(signer.id, "email", e.target.value)}
                          placeholder="john@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={signer.role} onValueChange={(v) => updateSigner(signer.id, "role", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="signer">Signer</SelectItem>
                            <SelectItem value="approver">Approver</SelectItem>
                            <SelectItem value="viewer">Viewer (CC)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Signature Options */}
            <Card>
              <CardHeader>
                <CardTitle>Signature Options</CardTitle>
                <CardDescription>Configure security and notification settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">OTP Verification</p>
                      <p className="text-sm text-muted-foreground">Require OTP for added security</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={options.requireOTP}
                    onCheckedChange={(checked) => setOptions({ ...options, requireOTP: !!checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Automatic Reminders</p>
                      <p className="text-sm text-muted-foreground">Send reminders to pending signers</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={options.sendReminders}
                    onCheckedChange={(checked) => setOptions({ ...options, sendReminders: !!checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Sequential Signing</p>
                      <p className="text-sm text-muted-foreground">Signers must sign in order</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={options.sequentialSigning}
                    onCheckedChange={(checked) => setOptions({ ...options, sequentialSigning: !!checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Expiration</p>
                      <p className="text-sm text-muted-foreground">Days until signature request expires</p>
                    </div>
                  </div>
                  <Select
                    value={options.expirationDays.toString()}
                    onValueChange={(v) => setOptions({ ...options, expirationDays: parseInt(v) })}
                  >
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Document Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Document Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-[3/4] bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <PenTool className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Contract Preview</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  <Eye className="h-4 w-4 mr-2" />View Full Document
                </Button>
              </CardContent>
            </Card>

            {/* Audit Trail */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditTrail.map((entry, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{entry.action}</span>
                        <Badge variant="outline" className="text-xs">{entry.ip}</Badge>
                      </div>
                      <p className="text-muted-foreground">{entry.user} • {entry.timestamp}</p>
                      {i < auditTrail.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
}
