import { AppRole } from "@/core/types/roles";
import { Badge } from "@/ui/shadcn/badge";
import {
  Building2,
  Clock,
  Crown,
  Shield,
  UserCheck,
  UserCog,
  UserRound,
  UserX,
} from "lucide-react";

interface RoleBadgeProps {
  role: AppRole | null;
  size?: "sm" | "md";
}

const sizeClass = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
} as const;

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  if (!role) {
    return (
      <Badge variant="outline" className={`${sizeClass[size]} gap-1.5 opacity-70`}>
        <Clock className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        <span className="hidden sm:inline">Pending</span>
      </Badge>
    );
  }

  switch (role) {
    case AppRole.PLATFORM_SUPER_ADMIN:
    case AppRole.PLATFORM_ADMIN:
      return (
        <Badge variant="destructive" className={`${sizeClass[size]} gap-1.5`}>
          <Shield className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Platform Super Admin</span>
        </Badge>
      );
    case AppRole.OWNER:
      return (
        <Badge variant="default" className={`${sizeClass[size]} gap-1.5`}>
          <Crown className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Owner</span>
        </Badge>
      );
    case AppRole.ADMIN:
      return (
        <Badge variant="default" className={`${sizeClass[size]} gap-1.5`}>
          <Building2 className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Organization Admin</span>
        </Badge>
      );
    case AppRole.MANAGER:
      return (
        <Badge variant="secondary" className={`${sizeClass[size]} gap-1.5`}>
          <UserCog className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Manager</span>
        </Badge>
      );
    case AppRole.USER:
    case AppRole.EMPLOYEE:
      return (
        <Badge variant="secondary" className={`${sizeClass[size]} gap-1.5`}>
          <UserRound className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Employee</span>
        </Badge>
      );
    case AppRole.CLIENT:
      return (
        <Badge variant="outline" className={`${sizeClass[size]} gap-1.5`}>
          <UserCheck className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Client User</span>
        </Badge>
      );
    case AppRole.PENDING_APPROVAL:
      return (
        <Badge variant="outline" className={`${sizeClass[size]} gap-1.5`}>
          <Clock className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Pending Approval</span>
        </Badge>
      );
    case AppRole.REJECTED:
      return (
        <Badge variant="outline" className={`${sizeClass[size]} gap-1.5`}>
          <UserX className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Rejected</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={`${sizeClass[size]} gap-1.5`}>
          <Clock className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          <span className="hidden sm:inline">Unknown</span>
        </Badge>
      );
  }
}
