import mysql, { Pool } from 'mysql2/promise';

let pool: Pool | null = null;
let isConnected = false;
let lastError: string | null = null;

export function getDbConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'ceiba2_db',
    connectTimeout: 3000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
}

export async function initDbPool(): Promise<boolean> {
  const config = getDbConfig();
  try {
    if (pool) {
      await pool.end();
    }
    pool = mysql.createPool(config);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    isConnected = true;
    lastError = null;
    console.log(`[MySQL] Conectado exitosamente a ${config.host}:${config.port}/${config.database}`);
    return true;
  } catch (err: any) {
    isConnected = false;
    lastError = err.message || 'Error de conexión MySQL';
    console.log(`[MySQL] Modo Simulación Activo (Servidor Ceiba II/MySQL no detectado en ${config.host}:${config.port}):`, err.message);
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

export function getDbLastError(): string | null {
  return lastError;
}

export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[] | null> {
  if (!isConnected || !pool) {
    return null;
  }
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T[];
  } catch (err: any) {
    console.error(`[MySQL Query Error] ${err.message} -> SQL: ${sql}`);
    return null;
  }
}

export async function ensureTrackerEventsTable(): Promise<boolean> {
  if (!isConnected || !pool) return false;
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS tracker_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        vehicle_id VARCHAR(64) NOT NULL,
        unit_number VARCHAR(64) NOT NULL,
        plate VARCHAR(32) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        event_time DATETIME NOT NULL,
        lat DECIMAL(10,6) NOT NULL,
        lng DECIMAL(10,6) NOT NULL,
        speed DECIMAL(10,2) NOT NULL DEFAULT 0,
        source VARCHAR(32) NOT NULL,
        meta LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tracker_events_unit_time (unit_number, event_time),
        INDEX idx_tracker_events_plate_time (plate, event_time),
        INDEX idx_tracker_events_vehicle_time (vehicle_id, event_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    return true;
  } catch (err: any) {
    console.error(`[MySQL] tracker_events init failed: ${err.message}`);
    return false;
  }
}

export async function testConnectionAndSchema() {
  const config = getDbConfig();
  const startTime = Date.now();
  try {
    const testPool = mysql.createPool(config);
    const conn = await testPool.getConnection();
    await conn.ping();

    // Check existing tables
    const [tables] = await conn.query('SHOW TABLES');
    conn.release();
    await testPool.end();

    const latency = Date.now() - startTime;
    return {
      success: true,
      latencyMs: latency,
      config: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user
      },
      tables: tables
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      config: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user
      },
      error: err.message
    };
  }
}
