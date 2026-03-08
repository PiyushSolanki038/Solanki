import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/resend.ts";

interface ClientInvitePayload {
  recipientEmail: string;
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  inviterName?: string;
  expiresAt: string;
  invitationUrl?: string;
  authRedirectTo?: string;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveRedirectTo(payload: ClientInvitePayload): string | undefined {
  const direct = payload.authRedirectTo?.trim();
  if (direct) return direct;

  if (payload.invitationUrl) {
    try {
      const url = new URL(payload.invitationUrl);
      return `${url.origin}/auth/sign-in`;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase env vars");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing authorization" });
    }

    const requesterClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await requesterClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const payload = (await req.json()) as ClientInvitePayload;

    if (!payload.recipientEmail || !payload.organizationId || !payload.organizationName || !payload.organizationCode) {
      return jsonResponse(400, { error: "Invalid payload" });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inviterMembership, error: inviterMembershipError } = await adminClient
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", payload.organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("account_state", ["active", "pending_verification"])
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (inviterMembershipError) {
      return jsonResponse(500, { error: inviterMembershipError.message });
    }

    if (!inviterMembership) {
      return jsonResponse(403, { error: "Only organization owner/admin can send invitations." });
    }

    // Rate limit: max 50 invitations per org per hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await adminClient
      .from("client_invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", payload.organizationId)
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= 50) {
      return jsonResponse(429, { error: "Too many invitations sent. Please try again later." });
    }

    const redirectTo = resolveRedirectTo(payload);

    // Check if user already exists before inviting
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === payload.recipientEmail.trim().toLowerCase()
    );

    if (existingUser) {
      // User already exists — check if they already have a membership
      const { data: existingMembership } = await adminClient
        .from("organization_memberships")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("organization_id", payload.organizationId)
        .maybeSingle();

      if (existingMembership) {
        return jsonResponse(409, { error: "This user is already a member of this organization." });
      }

      // Create client membership directly for existing user
      const { error: membershipError } = await adminClient
        .from("organization_memberships")
        .insert({
          user_id: existingUser.id,
          organization_id: payload.organizationId,
          role: "client",
          account_state: "active",
        });

      if (membershipError) {
        return jsonResponse(500, { error: membershipError.message });
      }

      return jsonResponse(200, { ok: true, provider: "direct_membership", existing_user: true });
    }

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(payload.recipientEmail.trim(), {
      redirectTo,
      data: {
        signup_type: "client_invitation",
        organization_id: payload.organizationId,
        organization_name: payload.organizationName,
        organization_code: payload.organizationCode,
        inviter_name: payload.inviterName ?? user.email ?? payload.organizationName,
        invitation_expires_at: payload.expiresAt,
      },
    });

    if (inviteError) {
      const status = typeof inviteError.status === "number" ? inviteError.status : 500;
      return jsonResponse(status, { error: inviteError.message });
    }

    return jsonResponse(200, { ok: true, provider: "supabase_auth" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(500, { error: message });
  }
});
