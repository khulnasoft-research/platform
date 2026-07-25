import pg from 'pg';

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  if (!pool) {
    pool = new pg.Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    pool.on('error', (err) => {
      console.error('Postgres pool error:', err.message);
    });
  }

  return pool;
}

export const db = {
  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[] | null> {
    const p = getPool();
    if (!p) return null;

    try {
      const result = await p.query(text, params);
      return result.rows as T[];
    } catch (err) {
      console.error('DB query error:', (err as Error).message);
      throw err;
    }
  },

  async queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows && rows.length > 0 ? (rows[0] as T) : null;
  },

  async end(): Promise<void> {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },

  get connected(): boolean {
    return getPool() !== null;
  },
};
