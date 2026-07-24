export type SSOProvider = 'saml' | 'oidc' | 'google' | 'github' | 'microsoft';

export interface SSOConfig {
  provider: SSOProvider;
  clientId: string;
  clientSecret: string;
  issuerUrl?: string;
  metadataUrl?: string;
  redirectUri: string;
  allowedDomains: string[];
  enforced: boolean;
  justInTimeProvisioning: boolean;
  defaultOrganizationRole: string;
}

export interface SSOUser {
  id: string;
  email: string;
  name: string;
  provider: SSOProvider;
  providerUserId: string;
  avatarUrl?: string;
  organizationId?: string;
}

export class SSOManager {
  private configs = new Map<string, SSOConfig>();

  configure(organizationId: string, config: SSOConfig): void {
    this.configs.set(organizationId, config);
  }

  getConfig(organizationId: string): SSOConfig | undefined {
    return this.configs.get(organizationId);
  }

  isDomainAllowed(organizationId: string, email: string): boolean {
    const config = this.configs.get(organizationId);
    if (!config) return false;
    const domain = email.split('@')[1];
    if (!domain) return false;
    return config.allowedDomains.some((d) => domain.endsWith(d));
  }

  buildAuthUrl(organizationId: string): string {
    const config = this.configs.get(organizationId);
    if (!config) throw new Error(`SSO not configured for organization: ${organizationId}`);

    switch (config.provider) {
      case 'saml':
        return `${config.issuerUrl}/saml/auth?RelayState=${encodeURIComponent(config.redirectUri)}`;
      case 'oidc':
      case 'google':
      case 'microsoft': {
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
        });
        return `${config.issuerUrl}/authorize?${params}`;
      }
      case 'github': {
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: 'user:email',
        });
        return `https://github.com/login/oauth/authorize?${params}`;
      }
    }
  }

  validateCallback(organizationId: string, _code: string): SSOUser {
    const config = this.configs.get(organizationId);
    if (!config) throw new Error(`SSO not configured for organization: ${organizationId}`);

    return {
      id: crypto.randomUUID(),
      email: 'sso-user@example.com',
      name: 'SSO User',
      provider: config.provider,
      providerUserId: crypto.randomUUID(),
      organizationId,
    };
  }
}
