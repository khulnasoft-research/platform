export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'deploy' | 'rollback' | 'approve' | 'reject' | 'invite' | 'remove' | 'export';

export type AuditResource = 'user' | 'organization' | 'project' | 'deployment' | 'blueprint' | 'agent' | 'api-key' | 'team-member' | 'billing' | 'settings';

export interface AuditEntry {
  id: string;
  timestamp: string;
  organizationId: string;
  projectId?: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'critical';
}

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries = 10000;

  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const full: AuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.entries.push(full);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    return full;
  }

  query(params: {
    organizationId?: string;
    projectId?: string;
    userId?: string;
    action?: AuditAction;
    resource?: AuditResource;
    severity?: 'info' | 'warning' | 'critical';
    limit?: number;
    offset?: number;
  }): AuditEntry[] {
    let results = [...this.entries];

    if (params.organizationId) results = results.filter((e) => e.organizationId === params.organizationId);
    if (params.projectId) results = results.filter((e) => e.projectId === params.projectId);
    if (params.userId) results = results.filter((e) => e.userId === params.userId);
    if (params.action) results = results.filter((e) => e.action === params.action);
    if (params.resource) results = results.filter((e) => e.resource === params.resource);
    if (params.severity) results = results.filter((e) => e.severity === params.severity);

    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;

    return results.slice(offset, offset + limit);
  }

  exportCSV(organizationId: string): string {
    const entries = this.entries.filter((e) => e.organizationId === organizationId);
    const header = 'id,timestamp,userId,userEmail,action,resource,resourceId,severity,details';
    const rows = entries.map((e) =>
      [e.id, e.timestamp, e.userId, e.userEmail, e.action, e.resource, e.resourceId, e.severity, JSON.stringify(e.details)].join(','),
    );
    return [header, ...rows].join('\n');
  }

  clear(organizationId?: string): void {
    if (organizationId) {
      this.entries = this.entries.filter((e) => e.organizationId !== organizationId);
    } else {
      this.entries = [];
    }
  }
}
