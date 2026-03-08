import { useContext } from "react";
import { ImpersonationContext } from "@/app/providers/impersonation-context";

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) {
    throw new Error("useImpersonation must be used inside ImpersonationProvider");
  }
  return ctx;
}
