import { createContext } from "react";

export const IMPERSONATION_STORAGE_KEY = "siswit_impersonation_state";

export interface ImpersonationState {
  active: boolean;
  sessionId: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  startedAt: string | null;
  reason?: string | null;
}

export interface StartImpersonationInput {
  tenantId: string;
  tenantSlug: string;
  reason?: string;
}

export interface ImpersonationContextType {
  state: ImpersonationState;
  startImpersonation: (input: StartImpersonationInput) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

export const defaultImpersonationState: ImpersonationState = {
  active: false,
  sessionId: null,
  tenantId: null,
  tenantSlug: null,
  startedAt: null,
  reason: null,
};

export const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);
