import { api } from './api.js';

let cachedOrgId: string | null = null;
let fetchPromise: Promise<string> | null = null;

export async function getOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const session = await api.auth.session();
      cachedOrgId = session.organizationId;
      return cachedOrgId;
    } catch {
      return 'default';
    }
  })();

  return fetchPromise;
}

export function clearOrgCache(): void {
  cachedOrgId = null;
  fetchPromise = null;
}

let cachedProjectId: string | null = null;

export async function getFirstProjectId(): Promise<string> {
  if (cachedProjectId) return cachedProjectId;
  const orgId = await getOrgId();
  try {
    const res = await api.projects.list(orgId);
    const projects = res.projects as Array<{ id: string }>;
    if (projects.length > 0) {
      cachedProjectId = projects[0]!.id;
      return cachedProjectId;
    }
  } catch {}
  return 'default';
}

export function clearProjectCache(): void {
  cachedProjectId = null;
}
