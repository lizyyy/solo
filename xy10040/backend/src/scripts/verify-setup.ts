import { runMigrations } from '../database/migrations';
import { db } from '../database/client';
import { logger } from '../utils/logger';
import { asyncTaskService } from '../services/async-task.service';

async function verifySetup() {
  logger.info('=== Verifying System Setup ===');

  try {
    logger.info('1. Running migrations...');
    await runMigrations();
    logger.info('✓ Migrations completed successfully');

    logger.info('2. Testing database connection...');
    const result = await db.query('SELECT NOW() as time');
    logger.info(`✓ Database connected, server time: ${result.rows[0].time}`);

    logger.info('3. Testing table creation...');
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = tablesResult.rows.map((r: { table_name: string }) => r.table_name);
    
    const expectedTables = [
      'async_tasks',
      'distributed_locks',
      'event_log',
      'events',
      'idempotency_tokens',
      'migration_history',
      'registrations'
    ];
    
    const missingTables = expectedTables.filter((t) => !tables.includes(t));
    if (missingTables.length > 0) {
      logger.error(`✗ Missing tables: ${missingTables.join(', ')}`);
      process.exit(1);
    }
    logger.info(`✓ All tables created: ${tables.join(', ')}`);

    logger.info('4. Testing async task service...');
    asyncTaskService.registerHandler({
      taskType: 'VERIFICATION_TASK',
      handle: async (payload: Record<string, unknown>) => {
        logger.info(`Verification task executed with payload: ${JSON.stringify(payload)}`);
      },
    });
    asyncTaskService.start(500);
    
    const taskId = await asyncTaskService.enqueue('VERIFICATION_TASK', { test: true });
    logger.info(`✓ Task enqueued: ${taskId}`);
    
    await new Promise((resolve) => setTimeout(resolve, 2000));
    asyncTaskService.stop();

    logger.info('\n=== All Verifications Passed! ===');
    process.exit(0);
  } catch (error) {
    logger.error('Verification failed', { error: (error as Error).message, stack: (error as Error).stack });
    process.exit(1);
  }
}

if (require.main === module) {
  verifySetup();
}
