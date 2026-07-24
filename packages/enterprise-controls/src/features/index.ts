export type FeatureFlagState = 'enabled' | 'disabled' | 'rollout' | 'internal';

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  state: FeatureFlagState;
  rolloutPercentage?: number;
  allowedOrganizations?: string[];
  allowedUsers?: string[];
  dependencies?: string[];
  expiresAt?: string;
}

export class FeatureFlags {
  private flags = new Map<string, FeatureFlag>();

  register(flag: FeatureFlag): void {
    this.flags.set(flag.key, flag);
  }

  isEnabled(key: string, context?: { userId?: string; organizationId?: string }): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;

    switch (flag.state) {
      case 'enabled':
        return true;
      case 'disabled':
        return false;
      case 'internal':
        return context?.userId === 'internal';
      case 'rollout':
        return this.evaluateRollout(flag, context);
    }
  }

  get(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  all(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  setState(key: string, state: FeatureFlagState): void {
    const flag = this.flags.get(key);
    if (flag) flag.state = state;
  }

  delete(key: string): void {
    this.flags.delete(key);
  }

  private evaluateRollout(flag: FeatureFlag, context?: { userId?: string; organizationId?: string }): boolean {
    if (flag.allowedUsers?.includes(context?.userId ?? '')) return true;
    if (flag.allowedOrganizations?.includes(context?.organizationId ?? '')) return true;

    if (flag.rolloutPercentage && context?.userId) {
      const hash = this.hashCode(context.userId) % 100;
      return hash < flag.rolloutPercentage;
    }

    return false;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
