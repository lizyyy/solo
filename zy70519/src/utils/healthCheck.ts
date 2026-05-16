import { getDatabase } from '../database/init';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    error?: string;
  };
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    duration: string;
    error?: string;
  }>;
}

export const HealthCheck = {
  async performCheck(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = [];
    const db = getDatabase();
    let dbConnected = false;
    let dbError: string | undefined;

    const dbStart = Date.now();
    try {
      await new Promise<void>((resolve, reject) => {
        db.get('SELECT 1 as test', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      dbConnected = true;
      checks.push({
        name: 'database_connection',
        status: 'pass',
        duration: `${Date.now() - dbStart}ms`
      });
    } catch (error: any) {
      dbError = error.message;
      checks.push({
        name: 'database_connection',
        status: 'fail',
        duration: `${Date.now() - dbStart}ms`,
        error: error.message
      });
    }

    const tablesCheckStart = Date.now();
    try {
      const tables = ['warmup_batches', 'cache_keys', 'failure_records', 'retry_records',
        'execution_nodes', 'data_sources'];
      const missingTables: string[] = [];
      
      for (const table of tables) {
        try {
          await new Promise<void>((resolve, reject) => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
              if (err) reject(err);
              else if (!row) missingTables.push(table);
              resolve();
            });
          });
        } catch (e) {
          missingTables.push(table);
        }
      }

      if (missingTables.length === 0) {
        checks.push({
          name: 'database_tables',
          status: 'pass',
          duration: `${Date.now() - tablesCheckStart}ms`
        });
      } else {
        checks.push({
          name: 'database_tables',
          status: 'fail',
          duration: `${Date.now() - tablesCheckStart}ms`,
          error: `Missing tables: ${missingTables.join(', ')}`
        });
      }
    } catch (error: any) {
      checks.push({
        name: 'database_tables',
        status: 'fail',
        duration: `${Date.now() - tablesCheckStart}ms`,
        error: error.message
      });
    }

    const allPassed = checks.every(c => c.status === 'pass');

    return {
      status: allPassed ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        error: dbError
      },
      checks
    };
  },

  async getDetailedStatus(): Promise<any> {
    return this.performCheck();
  }
};
