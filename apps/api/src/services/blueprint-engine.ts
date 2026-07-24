import type {
  BlueprintSnapshot,
  BlueprintNode,
  BlueprintEdge,
  BlueprintMetadata,
  DriftFinding,
  ImpactAnalysis,
} from '@platform/shared-types';

const snapshots = new Map<string, BlueprintSnapshot>();

function generateId(): string {
  return crypto.randomUUID();
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export const blueprintEngine = {
  createSnapshot(params: {
    projectId: string;
    commitSha: string;
    branch: string;
    nodes: BlueprintNode[];
    edges: BlueprintEdge[];
    metadata: BlueprintMetadata;
  }): BlueprintSnapshot {
    const snapshot: BlueprintSnapshot = {
      id: generateId(),
      projectId: params.projectId,
      commitSha: params.commitSha,
      branch: params.branch,
      nodes: params.nodes,
      edges: params.edges,
      metadata: params.metadata,
      createdAt: new Date().toISOString(),
    };
    snapshots.set(snapshot.id, snapshot);
    return clone(snapshot);
  },

  getSnapshot(id: string): BlueprintSnapshot | undefined {
    const s = snapshots.get(id);
    return s ? clone(s) : undefined;
  },

  listSnapshots(projectId: string): BlueprintSnapshot[] {
    return Array.from(snapshots.values())
      .filter((s) => s.projectId === projectId)
      .map(clone);
  },

  deleteSnapshot(id: string): boolean {
    return snapshots.delete(id);
  },

  analyzeArchitecture(
    snapshot: BlueprintSnapshot,
  ): { pattern: string; description: string; recommendations: string[] } {
    const nodeTypes = new Set(snapshot.nodes.map((n) => n.type));

    const hasApiRoutes = nodeTypes.has('api-route');
    const hasComponents = nodeTypes.has('component');
    const hasPages = nodeTypes.has('page');

    if (hasApiRoutes && hasComponents && hasPages) {
      return {
        pattern: 'Full-stack web application',
        description:
          'Contains API routes, UI components, and pages - typical full-stack architecture.',
        recommendations: [
          'Ensure clear separation between server and client code',
          'Consider using server actions for form handling',
          'Add data validation layer at API boundaries',
        ],
      };
    }

    if (hasComponents && !hasApiRoutes) {
      return {
        pattern: 'Frontend-only application',
        description:
          'Contains UI components but no API routes - likely a static or client-rendered app.',
        recommendations: [
          'Verify API client configuration points to correct backend',
          'Consider adding error boundaries for API calls',
        ],
      };
    }

    if (hasApiRoutes && !hasComponents) {
      return {
        pattern: 'API service',
        description:
          'Contains API routes without UI components - a backend service.',
        recommendations: [
          'Add OpenAPI documentation generation',
          'Consider rate limiting and auth middleware',
          'Ensure proper error handling middleware is in place',
        ],
      };
    }

    return {
      pattern: 'Unknown or mixed architecture',
      description:
        'Could not determine a clear architectural pattern from the blueprint.',
      recommendations: [
        'Review project structure for consistency',
        'Consider adopting a well-defined architecture pattern',
      ],
    };
  },

  detectDrift(
    baseline: BlueprintSnapshot,
    current: BlueprintSnapshot,
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const baselineNodes = new Map(baseline.nodes.map((n) => [n.id, n]));
    const currentNodes = new Map(current.nodes.map((n) => [n.id, n]));

    for (const [id, node] of baselineNodes) {
      if (!currentNodes.has(id)) {
        findings.push({
          id: generateId(),
          severity: 'warning',
          rule: 'node-removed',
          message: `Node "${node.name}" (${node.type}) has been removed`,
          sourceNodeId: id,
          codeLocation: node.path ?? undefined,
          suggestedFix: 'Restore the removed node or update dependencies',
        });
      }
    }

    for (const [id, node] of currentNodes) {
      if (!baselineNodes.has(id)) {
        findings.push({
          id: generateId(),
          severity: 'info',
          rule: 'node-added',
          message: `New node "${node.name}" (${node.type}) detected`,
          sourceNodeId: id,
          codeLocation: node.path ?? undefined,
        });
      }
    }

    const baselineEdges = new Set(
      baseline.edges.map((e) => `${e.sourceId}:${e.targetId}:${e.type}`),
    );
    const currentEdges = new Set(
      current.edges.map((e) => `${e.sourceId}:${e.targetId}:${e.type}`),
    );

    for (const edgeKey of currentEdges) {
      if (!baselineEdges.has(edgeKey)) {
        const [sourceId, targetId, type] = edgeKey.split(':');
        findings.push({
          id: generateId(),
          severity: type === 'violates' ? 'error' : 'info',
          rule: 'edge-added',
          message: `New dependency: ${sourceId} → ${targetId} (${type})`,
          sourceNodeId: sourceId!,
          targetNodeId: targetId,
          suggestedFix:
            type === 'violates'
              ? 'Review this new dependency for architectural compliance'
              : undefined,
        });
      }
    }

    return findings;
  },

  analyzeImpact(
    snapshot: BlueprintSnapshot,
    targetNodeId: string,
    change: 'modify' | 'delete' | 'rename',
  ): ImpactAnalysis | null {
    const target = snapshot.nodes.find((n) => n.id === targetNodeId);
    if (!target) return null;

    const directImpact = snapshot.edges
      .filter((e) => e.sourceId === targetNodeId || e.targetId === targetNodeId)
      .map((e) => {
        const related =
          e.sourceId === targetNodeId
            ? snapshot.nodes.find((n) => n.id === e.targetId)
            : snapshot.nodes.find((n) => n.id === e.sourceId);
        return related?.name ?? e.targetId;
      });

    const indirectImpact = snapshot.edges
      .filter((e) => directImpact.includes(e.sourceId) || directImpact.includes(e.targetId))
      .filter((e) => e.sourceId !== targetNodeId && e.targetId !== targetNodeId)
      .map((e) => {
        const related = snapshot.nodes.find(
          (n) => n.id === (e.sourceId === targetNodeId ? e.targetId : e.sourceId),
        );
        return related?.name ?? 'unknown';
      });

    const uniqueDirect = [...new Set(directImpact)];
    const uniqueIndirect = [...new Set(indirectImpact)];

    const riskMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      delete: 'high',
      rename: 'medium',
      modify: 'low',
    };

    return {
      target: target.name,
      change,
      directImpact: uniqueDirect,
      indirectImpact: uniqueIndirect,
      filesToModify: uniqueDirect,
      estimatedEffort:
        uniqueDirect.length <= 2
          ? 'small'
          : uniqueDirect.length <= 5
            ? 'medium'
            : 'large',
      risk: riskMap[change] ?? 'medium',
    };
  },
};
