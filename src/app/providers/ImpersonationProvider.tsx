import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { isPlatformRole } from "@/core/types/roles";
import {
  defaultImpersonationState,
  IMPERSONATION_STORAGE_KEY,
  ImpersonationContext,
  type ImpersonationState,
  type StartImpersonationInput,
} from "@/app/providers/impersonation-context";

async function logImpersonationEvent(
  actorUserId: string,
  action: "start" | "stop",
  nextState: ImpersonationState,
) {
  try {
    const unsafeSupabase = supabase as unknown as {
      from: (table: string) => {
        insert: (payload: unknown) => Promise<{ error: { message?: string } | null }>;
      };
    };

    await unsafeSupabase.from("audit_logs").insert({
      user_id: actorUserId,
      tenant_id: nextState.tenantId,
      entity_type: "impersonation",
      entity_id: actorUserId,
      action: `impersonation_${action}`,
      old_values: null,
      new_values: nextState,
      metadata: {
        tenant_slug: nextState.tenantSlug,
        started_at: nextState.startedAt,
      },
      created_at: new Date().toISOString(),
    });
  } catch {
    // Impersonation should still work even if logging fails.
  }
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [state, setState] = useState<ImpersonationState>(defaultImpersonationState);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as ImpersonationState;
      if (parsed?.active && parsed.tenantId && parsed.tenantSlug) {
        setState(parsed);
      }
    } catch {
      setState(defaultImpersonationState);
    }
  }, []);

  const persist = useCallback((next: ImpersonationState) => {
    setState(next);
    if (!next.active) {
      sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const stopImpersonation = useCallback(async () => {
    if (!user?.id) return;
    const previous = state;
    const next = { ...defaultImpersonationState };
    persist(next);

    try {
      if (previous.sessionId) {
        const unsafeSupabase = supabase as unknown as {
          from: (table: string) => {
            update: (payload: unknown) => {
              eq: (column: string, value: string) => {
                is: (column: string, value: null) => Promise<{ error: { message?: string } | null }>;
              };
            };
          };
        };

        await unsafeSupabase
          .from("impersonation_sessions")
          .update({ ended_at: new Date().toISOString() })
          .eq("id", previous.sessionId)
          .is("ended_at", null);
      }
    } catch {
      // Do not block sign-out / navigation flows on session close failures.
    }

    await logImpersonationEvent(user.id, "stop", { ...previous, active: false });
  }, [persist, state, user?.id]);

  const startImpersonation = useCallback(
    async ({ tenantId, tenantSlug, reason }: StartImpersonationInput) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!isPlatformRole(role)) throw new Error("Only platform admins can impersonate");

      let sessionId: string | null = null;
      try {
        const unsafeSupabase = supabase as unknown as {
          from: (table: string) => {
            insert: (payload: unknown) => {
              select: (columns: string) => {
                single: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
              };
            };
            update: (payload: unknown) => {
              eq: (column: string, value: string) => {
                is: (column: string, value: null) => Promise<{ error: { message?: string } | null }>;
              };
            };
          };
        };

        if (state.sessionId) {
          await unsafeSupabase
            .from("impersonation_sessions")
            .update({ ended_at: new Date().toISOString() })
            .eq("id", state.sessionId)
            .is("ended_at", null);
        }

        const { data } = await unsafeSupabase
          .from("impersonation_sessions")
          .insert({
            platform_admin_user_id: user.id,
            tenant_id: tenantId,
            tenant_slug: tenantSlug,
            started_at: new Date().toISOString(),
            reason: reason ?? null,
            metadata: {
              source: "web",
            },
          })
          .select("id")
          .single();

        sessionId = data?.id ?? null;
      } catch {
        // Impersonation can still run even if session insert fails.
      }

      const next: ImpersonationState = {
        active: true,
        sessionId,
        tenantId,
        tenantSlug,
        startedAt: new Date().toISOString(),
        reason: reason ?? null,
      };

      persist(next);
      await logImpersonationEvent(user.id, "start", next);
    },
    [persist, role, state.sessionId, user?.id],
  );

  useEffect(() => {
    // Defensive: if role changes away from platform admin, clear impersonation.
    if (state.active && !isPlatformRole(role)) {
      sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      setState(defaultImpersonationState);
    }
  }, [role, state.active]);

  const value = useMemo(
    () => ({
      state,
      startImpersonation,
      stopImpersonation,
    }),
    [state, startImpersonation, stopImpersonation],
  );

  return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}
