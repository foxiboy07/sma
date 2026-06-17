import { Pool, Client, QueryResult } from 'pg';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/encryption';

let pool: Pool | null = null;

const getConnectionString = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
};

export const initializePool = async (): Promise<void> => {
  if (pool) return;

  const minConnections = parseInt(process.env.DATABASE_POOL_MIN || '5', 10);
  const maxConnections = parseInt(process.env.DATABASE_POOL_MAX || '20', 10);

  pool = new Pool({
    connectionString: getConnectionString(),
    min: minConnections,
    max: maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    application_name: 'flowpulse-backend',
  });

  pool.on('error', (err) => {
    logger.error({ error: err }, 'Unexpected error on idle client');
  });

  pool.on('connect', () => {
    logger.debug('New database connection established');
  });

  // Enable RLS by setting tenant context
  pool.on('connect', async (client: Client) => {
    // This will be set per-request in middleware
  });

  logger.info({ min: minConnections, max: maxConnections }, 'Database pool initialized');
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool() first.');
  }
  return pool;
};

export const query = async <T = any>(text: string, values?: any[]): Promise<QueryResult<T>> => {
  const pool = getPool();
  const startTime = Date.now();

  try {
    const result = await pool.query<T>(text, values);
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      logger.warn({ duration, query: text }, 'Slow query detected');
    }

    return result;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), query: text },
      'Database query failed'
    );
    throw error;
  }
};

export const queryWithTenantContext = async <T = any>(
  text: string,
  values?: any[],
  tenantId?: string
): Promise<QueryResult<T>> => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Set RLS tenant context
    if (tenantId) {
      await client.query(`SET app.current_tenant_id = $1`, [tenantId]);
    }

    const result = await client.query<T>(text, values);
    return result;
  } finally {
    client.release();
  }
};

export const transaction = async <T>(
  callback: (client: Client) => Promise<T>,
  tenantId?: string
): Promise<T> => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Set RLS tenant context
    if (tenantId) {
      await client.query(`SET app.current_tenant_id = $1`, [tenantId]);
    }

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Transaction failed');
    throw error;
  } finally {
    client.release();
  }
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
};
