import { beforeAll, afterAll } from 'vitest';
import { db } from '../db/index.js';

const REQUIRED_TABLES = [
  'users', 'projects', 'tasks', 'blueprint_snapshots',
  'deployment_environments', 'deployments', 'preview_sessions',
];

async function tableExists(table: string): Promise<boolean> {
  const row = await db.queryOne<{ exists: boolean }>(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
    [table],
  );
  return row?.exists ?? false;
}

beforeAll(async () => {
  if (!db.connected) {
    console.log('\n  Skipping integration tests — DATABASE_URL not set');
    return;
  }

  for (const table of REQUIRED_TABLES) {
    const exists = await tableExists(table);
    if (!exists) {
      throw new Error(`Required table '${table}' does not exist. Run migrations first.`);
    }
  }
});

afterAll(async () => {
  if (!db.connected) return;

  const tables = [
    'preview_sessions', 'deployment_artifacts', 'deployment_logs',
    'tasks', 'deployment_environments', 'deployments', 'blueprint_snapshots',
    'project_agents', 'ai_usage_logs', 'projects', 'organization_members',
    'organizations', 'users',
  ];

  for (const table of tables) {
    await db.query(`DELETE FROM ${table}`);
  }

  await db.end();
});
