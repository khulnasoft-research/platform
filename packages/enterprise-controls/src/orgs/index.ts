import type { Organization } from '@platform/shared-types';

export type OrgPlan = 'free' | 'pro' | 'enterprise';
export type OrgStatus = 'active' | 'suspended' | 'cancelled' | 'trial';

export class OrgManager {
  private orgs = new Map<string, Organization>();

  create(params: {
    name: string;
    slug: string;
    ownerId: string;
    plan?: OrgPlan;
  }): Organization {
    const org: Organization = {
      id: crypto.randomUUID(),
      name: params.name,
      slug: params.slug,
      plan: params.plan ?? 'free',
      ownerId: params.ownerId,
      createdAt: new Date().toISOString(),
    };
    this.orgs.set(org.id, org);
    return org;
  }

  get(id: string): Organization | undefined {
    return this.orgs.get(id);
  }

  findBySlug(slug: string): Organization | undefined {
    return Array.from(this.orgs.values()).find((o) => o.slug === slug);
  }

  update(id: string, updates: Partial<Organization>): Organization | undefined {
    const org = this.orgs.get(id);
    if (!org) return undefined;
    Object.assign(org, updates);
    return org;
  }

  list(userId: string): Organization[] {
    return Array.from(this.orgs.values()).filter((o) => o.ownerId === userId);
  }

  canCreateProject(orgId: string): { allowed: boolean; reason?: string } {
    const org = this.orgs.get(orgId);
    if (!org) return { allowed: false, reason: 'Organization not found' };

    return { allowed: true };
  }
}
