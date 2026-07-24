export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: 'email' | 'github' | 'google' | 'saml';
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  ownerId: string;
  createdAt: string;
}

export interface Session {
  token: string;
  expiresAt: string;
  user: User;
}

export interface OrganizationRole {
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

export interface ProjectRole {
  userId: string;
  projectId: string;
  role: 'admin' | 'developer' | 'reviewer' | 'viewer';
}

export interface ServiceAccount {
  id: string;
  name: string;
  organizationId: string;
  scopes: string[];
  createdAt: string;
}
