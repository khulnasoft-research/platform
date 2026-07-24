export type Resource = 'project' | 'organization' | 'deployment' | 'blueprint' | 'agent' | 'api-key' | 'team-member' | 'audit-log' | 'billing';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'deploy' | 'approve' | 'manage' | 'admin';

export interface Permission {
  resource: Resource;
  actions: Action[];
  conditions?: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inherits?: string[];
}

export interface RBACRule {
  userId: string;
  organizationId: string;
  projectId?: string;
  roles: string[];
}

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  matchedRole?: string;
}

const defaultRoles: Role[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all resources',
    permissions: [{ resource: 'organization', actions: ['admin'] }, { resource: 'project', actions: ['admin'] }, { resource: 'deployment', actions: ['admin'] }, { resource: 'blueprint', actions: ['admin'] }, { resource: 'agent', actions: ['admin'] }, { resource: 'api-key', actions: ['admin'] }, { resource: 'team-member', actions: ['admin'] }, { resource: 'audit-log', actions: ['admin'] }, { resource: 'billing', actions: ['admin'] }],
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Manage projects, deployments, and team',
    permissions: [{ resource: 'project', actions: ['create', 'read', 'update', 'delete'] }, { resource: 'deployment', actions: ['create', 'read', 'update', 'delete', 'deploy'] }, { resource: 'blueprint', actions: ['create', 'read', 'update', 'delete'] }, { resource: 'agent', actions: ['read', 'update'] }, { resource: 'team-member', actions: ['read', 'update'] }],
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Create and manage projects and deployments',
    permissions: [{ resource: 'project', actions: ['create', 'read', 'update'] }, { resource: 'deployment', actions: ['create', 'read', 'deploy'] }, { resource: 'blueprint', actions: ['create', 'read', 'update'] }, { resource: 'agent', actions: ['read'] }],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [{ resource: 'project', actions: ['read'] }, { resource: 'deployment', actions: ['read'] }, { resource: 'blueprint', actions: ['read'] }],
  },
];

export class RBAC {
  private roles = new Map<string, Role>(defaultRoles.map((r) => [r.id, r]));
  private rules = new Map<string, RBACRule>();

  registerRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  assign(params: RBACRule): void {
    const key = `${params.userId}:${params.organizationId}:${params.projectId ?? '*'}`;
    this.rules.set(key, params);
  }

  revoke(userId: string, organizationId: string, projectId?: string): void {
    const key = `${userId}:${organizationId}:${projectId ?? '*'}`;
    this.rules.delete(key);
  }

  check(userId: string, organizationId: string, resource: Resource, action: Action, projectId?: string): PermissionCheck {
    const rules = this.findRules(userId, organizationId, projectId);

    for (const rule of rules) {
      for (const roleId of rule.roles) {
        const role = this.roles.get(roleId);
        if (!role) continue;

        const effectiveRoles = this.collectRoles(role);
        for (const r of effectiveRoles) {
          for (const perm of r.permissions) {
            if (perm.resource === resource || perm.resource === 'organization') {
              if (perm.actions.includes('admin') || perm.actions.includes(action)) {
                return { allowed: true, matchedRole: r.name };
              }
            }
          }
        }
      }
    }

    return { allowed: false, reason: 'Insufficient permissions' };
  }

  hasRole(userId: string, organizationId: string, roleId: string, projectId?: string): boolean {
    const rules = this.findRules(userId, organizationId, projectId);
    return rules.some((r) => r.roles.includes(roleId));
  }

  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  private findRules(userId: string, organizationId: string, projectId?: string): RBACRule[] {
    const results: RBACRule[] = [];
    const exactKey = `${userId}:${organizationId}:${projectId ?? '*'}`;
    const orgKey = `${userId}:${organizationId}:*`;

    const exact = this.rules.get(exactKey);
    if (exact) results.push(exact);

    if (projectId) {
      const orgOnly = this.rules.get(orgKey);
      if (orgOnly) results.push(orgOnly);
    }

    return results;
  }

  private collectRoles(role: Role): Role[] {
    const collected: Role[] = [role];
    if (role.inherits) {
      for (const parentId of role.inherits) {
        const parent = this.roles.get(parentId);
        if (parent) collected.push(...this.collectRoles(parent));
      }
    }
    return collected;
  }
}
