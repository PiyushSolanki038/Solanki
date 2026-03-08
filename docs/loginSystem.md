# Login System Documentation (Organization-Native)

## Overview
The auth system is rebuilt around organizations. Tenant-era auth entities are replaced by organization-native tables, roles, and flows.

## Roles and Account State

### Roles
- `platform_super_admin`
- `owner`
- `admin`
- `manager`
- `employee`
- `client`

### Account states
- `pending_verification`
- `pending_approval`
- `active`
- `rejected`
- `suspended`

## Public Auth Routes
- `/auth/sign-in`
- `/auth/organization-signup`
- `/auth/client-signup`
- `/auth/accept-invitation`
- `/auth/accept-client-invitation`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/pending-approval`

Legacy alias kept:
- `/auth/company-signup` -> `/auth/organization-signup`

## Signup and Invitation Flows

### Organization signup
1. Owner submits org name/code + owner credentials.
2. User is created in Supabase Auth.
3. `profiles` row is upserted.
4. `organizations` + `organization_subscriptions` + owner `organization_memberships` are inserted.
5. User verifies email and signs in.

### Client self-signup
1. Client submits org slug/code + credentials.
2. User is created in Supabase Auth.
3. Membership is created as role `client` with `account_state = pending_approval`.
4. After email verification, login routes to pending approval until owner/admin approves.

### Employee invitation
1. Owner/admin creates invitation from organization dashboard.
2. Token hash is stored in `employee_invitations` (plain token is not stored).
3. Invite email is sent via Edge Function + Resend.
4. Employee accepts via `/auth/accept-invitation?token=...`.
5. Membership is created with invited role and invitation marked accepted.

### Client invitation
1. Owner/admin creates client invitation.
2. Token hash is stored in `client_invitations`.
3. Invite email is sent via Edge Function + Resend.
4. Client accepts via `/auth/accept-client-invitation?token=...`.
5. Client membership is created and invitation marked accepted.

## Login and Redirect Behavior
Single email/password sign-in is used for all users. Role is resolved server-side and redirect is automatic:

- `platform_super_admin` -> `/platform`
- `owner` -> `/organization`
- `admin` / `manager` / `employee` -> `/:orgSlug/app/dashboard`
- `client` -> `/:orgSlug/app/portal`
- `pending_approval` -> `/auth/pending-approval`
- `rejected` -> `/unauthorized`

## Password Recovery
- Forgot password uses Supabase Auth email flow from `/auth/forgot-password`.
- Reset password updates credentials from `/auth/reset-password`.

## Organization Owner Dashboard
`/organization` includes:
- Send employee invitations
- Send client invitations
- Approve/reject pending client self-signups
- View recent invitation statuses

## Core Database Objects
Primary auth-domain tables:
- `organizations`
- `organization_subscriptions`
- `organization_memberships`
- `employee_roles`
- `employee_invitations`
- `client_invitations`
- `profiles`
- `platform_super_admins`
- `audit_logs`
- `impersonation_sessions`

## Route Protection
- `PlatformAdminRoute`: platform super admin only
- `OrganizationOwnerRoute`: owner/admin/super admin
- `TenantAdminRoute`: workspace members and super admin
- `ClientRoute`: client portal access
- `PendingApprovalRoute`: pending approval state only

## Compatibility Layer
To avoid breaking module pages during migration, compatibility aliases/views and helper functions are retained:
- Tenant path helpers alias to organization helpers
- Legacy routes (`/admin/*`, `/dashboard/*`, `/portal/*`) redirect to canonical org paths
- Tenant-scoped module code continues to function while backend schema is org-native

## Key Files
- `src/hooks/AuthProvider.tsx`
- `src/hooks/OrganizationProvider.tsx`
- `src/hooks/auth-context.ts`
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/Auth.tsx`
- `src/pages/OrganizationSignup.tsx`
- `src/pages/ClientSignup.tsx`
- `src/pages/AcceptEmployeeInvitation.tsx`
- `src/pages/AcceptClientInvitation.tsx`
- `src/pages/ForgotPassword.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/OrganizationOwnerDashboard.tsx`
- `supabase/migrations/007_org_native_auth_reset.sql`
