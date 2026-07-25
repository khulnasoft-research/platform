import { RBAC, AuditLogger, OrgManager, FeatureFlags, SSOManager } from '@platform/enterprise-controls';
import { db } from '../db/index.js';
import type { AuditEntry } from '@platform/enterprise-controls';

export const rbac = new RBAC();
export const auditLogger = new AuditLogger();
export const orgManager = new OrgManager();
export const featureFlags = new FeatureFlags();
export const ssoManager = new SSOManager();

async function loadRBACRules(): Promise<void> {
  if (!db.connected) return;
  const rules = await db.query<{ user_id: string; organization_id: string; project_id: string | null; role: string }>(
    'SELECT user_id, organization_id, project_id, role FROM organization_members WHERE role IS NOT NULL',
  );
  if (!rules) return;
  for (const r of rules) {
    rbac.assign({
      userId: r.user_id,
      organizationId: r.organization_id,
      projectId: r.project_id ?? undefined,
      roles: [r.role],
    });
  }
}

async function loadFeatureFlags(): Promise<void> {
  if (!db.connected) return;
  const flags = await db.query<{ key: string; state: string; description: string; created_at: string }>(
    'SELECT key, state, description, created_at FROM feature_flags',
  );
  if (!flags) return;
  for (const f of flags) {
    featureFlags.register({
      key: f.key,
      name: f.key,
      state: f.state as 'enabled' | 'disabled' | 'rollout' | 'internal',
      description: f.description,
    });
  }
}

async function loadSSOConfigs(): Promise<void> {
  if (!db.connected) return;
  const configs = await db.query<{ organization_id: string; provider: string; domain: string; client_id: string; issuer_url: string; enabled: boolean }>(
    'SELECT organization_id, provider, domain, client_id, issuer_url, enabled FROM sso_configs',
  );
  if (!configs) return;
  for (const c of configs) {
    ssoManager.configure(c.organization_id, {
      provider: c.provider as 'saml' | 'oidc' | 'google' | 'github' | 'microsoft',
      clientId: c.client_id,
      clientSecret: '',
      issuerUrl: c.issuer_url ?? undefined,
      allowedDomains: [c.domain],
      redirectUri: '',
      enforced: c.enabled,
      justInTimeProvisioning: false,
      defaultOrganizationRole: 'member',
    });
  }
}

export async function loadEnterpriseState(): Promise<void> {
  await Promise.all([loadRBACRules(), loadFeatureFlags(), loadSSOConfigs()]);
}

export async function persistAuditEntry(entry: AuditEntry): Promise<void> {
  if (!db.connected) {
    auditLogger.log(entry);
    return;
  }
  auditLogger.log(entry);
  await db.query(
    `INSERT INTO audit_logs (id, organization_id, project_id, user_id, action, resource, resource_id, details, severity, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      entry.id, entry.organizationId, entry.projectId, entry.userId,
      entry.action, entry.resource, entry.resourceId,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.severity, entry.ipAddress ?? null, entry.userAgent ?? null,
      entry.timestamp ?? new Date().toISOString(),
    ],
  );
}

export async function persistOrg(params: { id: string; name: string; slug: string; plan: string; ownerId: string }): Promise<void> {
  if (!db.connected) return;
  await db.query(
    `INSERT INTO organizations (id, name, slug, plan, owner_id, created_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET name = $2, plan = $4`,
    [params.id, params.name, params.slug, params.plan, params.ownerId],
  );
}
