import { createContext } from "react";
import type {
  ModuleType,
  Organization,
  OrganizationMembership,
  OrganizationSubscription,
} from "@/core/types/organization";

export interface OrganizationContextType {
  organization: Organization | null;
  organizationLoading: boolean;
  activeOrganizationSlug: string | null;
  subscription: OrganizationSubscription | null;
  memberships: OrganizationMembership[];
  hasModule: (module: ModuleType) => boolean;
  enabledModules: ModuleType[];
  switchOrganization: (organizationId: string) => Promise<void>;
  switchOrganizationBySlug: (organizationSlug: string) => Promise<void>;
  refreshOrganization: () => Promise<void>;
}

export const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);
