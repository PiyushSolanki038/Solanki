import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { useImpersonation } from "@/core/hooks/useImpersonation";

export function ImpersonationBanner() {
  const { state, stopImpersonation } = useImpersonation();

  if (!state.active || !state.tenantSlug) {
    return null;
  }

  return (
    <div className="border-b border-warning/40 bg-warning/10 px-4 py-2">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-warning-foreground">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-sm font-medium">
            Impersonation mode is active for tenant <span className="font-bold">{state.tenantSlug}</span>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-warning-foreground hover:bg-warning/20"
          onClick={() => void stopImpersonation()}
        >
          <X className="mr-1 h-4 w-4" />
          Exit
        </Button>
      </div>
    </div>
  );
}
