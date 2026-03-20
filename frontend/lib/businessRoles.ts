/**
 * Business member roles and permission model.
 * Roles are defined in DB enum and must stay in sync with this file.
 */

export const BUSINESS_ROLES = ["owner", "manager", "responder", "viewer"] as const;
export type BusinessMemberRole = (typeof BUSINESS_ROLES)[number];

/**
 * Role-based permission matrix.
 * Each role is a superset of permissions for lower-privilege roles.
 */
export const rolePermissions: Record<
  BusinessMemberRole,
  {
    canManageTeam: boolean;
    canConfigureSync: boolean;
    canPostReplies: boolean;
    canViewDashboard: boolean;
  }
> = {
  owner: {
    canManageTeam: true,
    canConfigureSync: true,
    canPostReplies: true,
    canViewDashboard: true,
  },
  manager: {
    canManageTeam: false,
    canConfigureSync: true,
    canPostReplies: true,
    canViewDashboard: true,
  },
  responder: {
    canManageTeam: false,
    canConfigureSync: false,
    canPostReplies: true,
    canViewDashboard: true,
  },
  viewer: {
    canManageTeam: false,
    canConfigureSync: false,
    canPostReplies: false,
    canViewDashboard: true,
  },
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(
  role: BusinessMemberRole,
  permission: keyof (typeof rolePermissions)[BusinessMemberRole]
): boolean {
  return rolePermissions[role][permission] ?? false;
}

/**
 * Check if role has at least one of the minimum required roles.
 */
export function hasAnyRole(
  userRole: BusinessMemberRole,
  minimumRoles: BusinessMemberRole[]
): boolean {
  const roleHierarchy: Record<BusinessMemberRole, number> = {
    owner: 4,
    manager: 3,
    responder: 2,
    viewer: 1,
  };

  const userLevel = roleHierarchy[userRole];
  const minLevel = Math.max(...minimumRoles.map((r) => roleHierarchy[r]));

  return userLevel >= minLevel;
}
