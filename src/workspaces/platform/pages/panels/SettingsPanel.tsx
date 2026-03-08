import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Shield, Wrench, Workflow } from "lucide-react";

export default function SettingsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global defaults for multi-tenant policies, background jobs, and governance.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Security Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Impersonation requires platform admin role and every session is audited.</p>
            <p>Tenant data access is scoped by ownership and tenant membership rules.</p>
            <Button variant="outline" size="sm" className="w-full">
              Review Auth Policies
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4" />
              Async Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Document generation, PDF creation, reminder emails, and expiry alerts run through job queues.</p>
            <p>Worker command: `npm run jobs:worker`</p>
            <Button variant="outline" size="sm" className="w-full">
              Open Worker Runbook
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Data Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Soft-delete is the default convention for business records and audit traceability.</p>
            <p>Ownership and tenant scope guidance lives in `docs/data-ownership.md`.</p>
            <Button variant="outline" size="sm" className="w-full">
              View Governance Docs
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
