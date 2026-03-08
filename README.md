# SISWIT Unified Platform

SISWIT is a multi-workspace SaaS platform that combines CRM, CPQ, CLM, ERP, and document automation in one product.  
This repository includes the public website, authentication, internal organization workspaces, customer portal, and platform admin console.

## What This Site Is For

SISWIT is built for B2B teams that need a single system to:

- manage customer relationships (CRM)
- generate and manage quotes (CPQ)
- manage contracts and e-sign flows (CLM)
- run operational finance/inventory workflows (ERP)
- generate and sign documents (Documents)

It also supports external client collaboration through a dedicated portal and supports platform-level administration for a multi-tenant SaaS model.

## Workspace Map

| Workspace | Base Routes | Primary Users | Purpose |
|---|---|---|---|
| Public Website | `/`, `/about`, `/contact`, `/pricing`, `/products`, `/solutions` | Anyone | Marketing and product discovery |
| Auth | `/auth/*` | All users | Sign-in, sign-up, invitations, password recovery |
| Organization Owner | `/organization/*` | `owner`, `admin` | User management, invitations, approvals, plan visibility |
| Tenant Workspace | `/:tenantSlug/app/*` | `owner`, `admin`, `manager`, `employee` | Day-to-day operations across modules |
| Customer Portal | `/:tenantSlug/app/portal/*` | `client` (plus owner/admin visibility) | Client access to quotes, contracts, docs, signatures |
| Platform Admin | `/platform/*` | `platform_super_admin` | Cross-tenant administration, audit, billing, impersonation |

## How The App Works

At runtime, the app boots with global providers and route guards:

- `AuthProvider` resolves session, role, and auth actions.
- `OrganizationProvider` and `TenantProvider` resolve org/tenant context and subscription modules.
- `ImpersonationProvider` supports platform admin tenant impersonation with audit events.
- Route guards enforce access (`PlatformAdminRoute`, `TenantAdminRoute`, `ClientRoute`, `OrganizationOwnerRoute`, `PendingApprovalRoute`).

Main routing lives in `src/app/App.tsx`.

## Roles and Account States

### Roles

- `platform_super_admin`
- `owner`
- `admin`
- `manager`
- `employee` (legacy alias: `user`)
- `client`

### Account states used in role resolution

- `pending_verification`
- `pending_approval`
- `active`
- `rejected`

## Login Flow

1. User signs in from `/auth/sign-in` with email/password.
2. `AuthProvider.signIn` calls `supabase.auth.signInWithPassword`.
3. Role resolution checks:
   - `platform_super_admins` first
   - then active `organization_memberships`
4. If no membership is found immediately, `claim_pending_invitations()` RPC is attempted and role is re-resolved.
5. If role resolves to `pending_verification`, user is signed out and prompted to verify email.
6. Redirects after successful sign-in:
   - `platform_super_admin` -> `/platform`
   - `owner` -> `/organization`
   - `admin`/`manager`/`employee` -> `/:tenantSlug/app/dashboard`
   - `client` -> `/:tenantSlug/app/portal`
   - `pending_approval` -> `/auth/pending-approval`
   - `rejected` -> `/unauthorized`

## Sign-Up and Invitation Flows

### 1) Organization Sign-Up (`/auth/sign-up?tab=organization`)

1. Owner submits org details + credentials.
2. Supabase Auth user is created (`signup_type: organization_owner`).
3. Profile is created through `create_signup_profile` RPC.
4. Organization + subscription + owner membership are inserted.
5. Owner verifies email, then signs in.

### 2) Client Self Sign-Up (`/auth/sign-up?tab=client`)

1. Client searches/enters organization slug or code.
2. Organization lookup uses RPC (`search_signup_organizations` / `find_signup_organization`).
3. Supabase Auth user is created (`signup_type: client_self`).
4. Profile + `client` membership are created.
5. User verifies email, then approval/access state is enforced by membership state and guards.

### 3) Employee Invitation (`/auth/accept-invitation?token=...`)

1. Owner/admin creates invite from Organization Owner workspace.
2. Raw token is generated client-side, hashed, and only hash is stored.
3. Invite email flow is triggered through Supabase Edge Function.
4. Invitee accepts link, token is validated (exists, pending, not expired).
5. Employee account + membership are created, invitation status updated.

### 4) Client Invitation (`/auth/accept-client-invitation?token=...`)

Flow matches employee invitation but creates `client` membership.

### 5) Password Recovery

- `/auth/forgot-password` sends reset email.
- `/auth/reset-password` updates password after recovery session validation.

## Navigation and Route Structure

### Canonical workspace paths

- Tenant app: `/:tenantSlug/app/...`
- Tenant portal: `/:tenantSlug/app/portal/...`
- Organization owner console: `/organization/...`
- Platform console: `/platform/...`

### Compatibility redirects

Legacy paths are still supported and redirected:

- `/admin/*` -> `/platform/*`
- `/dashboard/*` -> role-based canonical workspace path
- `/portal/*` -> `/:tenantSlug/app/portal/*`

## Module Functionality

### CRM (`/:tenantSlug/app/crm/*`)

- Entities: leads, accounts, contacts, opportunities, activities
- Includes pipeline and dashboard stats (pipeline value, expected revenue, win rate)
- CRUD with soft-delete and scoped ownership filters

### CPQ (`/:tenantSlug/app/cpq/*`)

- Product catalog and quote builder
- Quote items with pricing, discounts, totals
- Quote status lifecycle updates
- Quote PDF template component available

### CLM (`/:tenantSlug/app/clm/*`)

- Contract templates, contracts, and contract details
- E-signature requests and status updates
- Contract scan upload records
- Contract expiry alert jobs can be enqueued

### Documents (`/:tenantSlug/app/documents/*`)

- Document templates and generated documents (`auto_documents`)
- E-sign request lifecycle and reminders
- Document versions and permission sharing
- Realtime subscriptions for docs/signatures tables

### ERP (`/:tenantSlug/app/erp/*`)

- Suppliers
- Inventory items and stock levels
- Purchase orders and line items
- Production orders
- Financial records

## Organization Owner Workspace Features (`/organization/*`)

- Overview dashboard with member/invite/approval metrics
- User directory and filters
- Employee and client invitation workflows
- Client self-signup approval/rejection
- Plan/module visibility and usage indicators
- Alerts (pending approvals, expiring invites, billing/trial warnings)

## Customer Portal Features (`/:tenantSlug/app/portal/*`)

- Personal dashboard
- Quotes list
- Contracts list
- Documents and history
- Pending signatures

## Platform Admin Features (`/platform/*`)

- Tenant directory and impersonation entry points
- User directory
- Billing/subscription matrix
- Audit log stream
- Global settings overview for security/worker/data lifecycle

## Data Ownership, Security, and Audit

Core conventions used by module hooks and utilities:

- Every business record is organization scoped (`organization_id`, legacy `tenant_id` compatibility included).
- Read/write helpers enforce scope (`applyModuleReadScope`, `applyModuleMutationScope`).
- Soft delete is the default delete mode (`deleted_at`, `deleted_by`).
- Audit events are written to `audit_logs` for create/update/delete and impersonation actions.

## Background Jobs and Async Workflow

Job table: `background_jobs`  
Primary helpers: `src/core/utils/jobs.ts`

Supported job types:

- `document.generate`
- `document.generate_pdf`
- `email.send`
- `email.reminder`
- `contract.expiry_alert`

Scripts:

- `npm run jobs:worker`
- `npm run jobs:enqueue-expiry-alerts`

Note: current worker handlers in `scripts/background-worker.mjs` are scaffolded and log payloads; replace with production delivery logic as needed.

## Tech Stack

- React 18 + TypeScript
- Vite + SWC
- React Router v6
- TanStack Query
- Supabase (Auth, Postgres, RPC, Edge Functions)
- Tailwind CSS + shadcn/ui + Radix
- Recharts for dashboard visualizations

## Project Structure

```text
.
|- src/
|  |- app/                  # app bootstrap, routing, providers, generic pages
|  |- core/                 # auth, API client, RBAC, tenancy, shared utils/types
|  |- modules/              # CRM, CPQ, CLM, ERP, Documents
|  |- workspaces/           # website, auth, employee, portal, platform, organization
|  |- ui/                   # shared UI components (shadcn + custom)
|  |- styles/               # global styles
|- supabase/
|  |- migrations/           # schema + RLS + RPC migrations
|  |- functions/            # edge functions (invitation email flows)
|- scripts/                 # worker + maintenance scripts
|- docs/                    # architecture and flow docs
```

## Local Development

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase project (or local Supabase stack)

### Install and run

```bash
npm install
npm run dev
```

Dev server runs on `http://localhost:8080` (see `vite.config.ts`).

### Build and lint

```bash
npm run lint
npm run build
npm run preview
```

## Environment Variables

### Frontend (required)

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

### Frontend (optional)

```env
VITE_SUPABASE_PROJECT_ID=...              # used by db:types script
VITE_DISABLE_INVITE_EMAILS=true|false     # disable invitation email send path
VITE_AUTH_ROLE_LOOKUP_TIMEOUT_MS=5000
```

### Worker / server-side scripts

```env
SUPABASE_URL=...                          # or reuse VITE_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=...
CONTRACT_EXPIRY_LOOKAHEAD_DAYS=30
```

### Edge function environment (Supabase)

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...                        # if resend helper is used
RESEND_FROM_EMAIL=...
```

## NPM Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run build:dev` - development-mode build
- `npm run preview` - preview build output
- `npm run lint` - lint source
- `npm run db:types` - generate Supabase TypeScript types
- `npm run jobs:worker` - run job worker
- `npm run jobs:enqueue-expiry-alerts` - enqueue contract expiry alert jobs

## Migration / Compatibility Notes

This codebase is in a tenant-to-organization migration phase:

- Auth and major module scope logic are organization-native (`organizations`, `organization_memberships`, `organization_subscriptions`).
- Compatibility aliases keep legacy `tenant*` naming in paths/utilities.
- Some platform and dashboard panels still query legacy tables (`tenants`, `tenant_users`, `tenant_subscriptions`).

When extending the platform, prefer organization-native patterns and keep backward compatibility only where necessary.

## Additional Documentation

- `docs/loginSystem.md`
- `docs/background-jobs.md`
- `docs/data-ownership.md`
- `docs/futureLoginPlan.md`
