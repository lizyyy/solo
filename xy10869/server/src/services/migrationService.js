const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../database');
const logger = require('../utils/logger');

const BATCH_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  CONFIRMED: 'confirmed',
  ROLLBACK_REQUIRED: 'rollback_required',
  ROLLED_BACK: 'rolled_back',
  COMPENSATED: 'compensated'
};

const STATUS_TRANSITIONS = {
  [BATCH_STATUS.PENDING]: [BATCH_STATUS.RUNNING],
  [BATCH_STATUS.RUNNING]: [BATCH_STATUS.COMPLETED, BATCH_STATUS.FAILED, BATCH_STATUS.WAITING_CONFIRMATION],
  [BATCH_STATUS.COMPLETED]: [BATCH_STATUS.CONFIRMED, BATCH_STATUS.ROLLBACK_REQUIRED],
  [BATCH_STATUS.FAILED]: [BATCH_STATUS.ROLLBACK_REQUIRED, BATCH_STATUS.COMPENSATED],
  [BATCH_STATUS.WAITING_CONFIRMATION]: [BATCH_STATUS.CONFIRMED, BATCH_STATUS.ROLLBACK_REQUIRED],
  [BATCH_STATUS.CONFIRMED]: [],
  [BATCH_STATUS.ROLLBACK_REQUIRED]: [BATCH_STATUS.ROLLED_BACK, BATCH_STATUS.COMPENSATED],
  [BATCH_STATUS.ROLLED_BACK]: [],
  [BATCH_STATUS.COMPENSATED]: []
};

class MigrationService {
  async createMigrationScript(data) {
    const id = uuidv4();
    await run(
      `INSERT INTO migration_scripts (id, name, description, content, author, version, target_database_id, rollback_script, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [id, data.name, data.description, data.content, data.author, data.version, data.target_database_id, data.rollback_script]
    );
    return this.getMigrationScript(id);
  }

  async getMigrationScript(id) {
    return get('SELECT * FROM migration_scripts WHERE id = ?', [id]);
  }

  async listMigrationScripts(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const [scripts, total] = await Promise.all([
      all('SELECT * FROM migration_scripts ORDER BY created_at DESC LIMIT ? OFFSET ?', [pageSize, offset]),
      get('SELECT COUNT(*) as count FROM migration_scripts')
    ]);
    return { list: scripts, total: total.count, page, pageSize };
  }

  async createTargetDatabase(data) {
    const id = uuidv4();
    await run(
      `INSERT INTO target_databases (id, name, host, port, database_name, username, password, type, environment, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, data.name, data.host, data.port, data.database_name, data.username, data.password, data.type, data.environment]
    );
    return this.getTargetDatabase(id);
  }

  async getTargetDatabase(id) {
    return get('SELECT * FROM target_databases WHERE id = ?', [id]);
  }

  async listTargetDatabases() {
    return all('SELECT * FROM target_databases ORDER BY created_at DESC');
  }

  async createPreviewBatch(data) {
    const id = uuidv4();
    const lastBatch = await get(
      'SELECT MAX(batch_number) as max_batch FROM preview_batches WHERE migration_script_id = ?',
      [data.migration_script_id]
    );
    const batchNumber = (lastBatch?.max_batch || 0) + 1;

    await run(
      `INSERT INTO preview_batches (id, migration_script_id, target_database_id, batch_number, status, operator, remarks)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [id, data.migration_script_id, data.target_database_id, batchNumber, data.operator, data.remarks]
    );

    return this.getPreviewBatch(id);
  }

  async getPreviewBatch(id) {
    return get(`
      SELECT pb.*, ms.name as migration_script_name, td.name as target_database_name
      FROM preview_batches pb
      LEFT JOIN migration_scripts ms ON pb.migration_script_id = ms.id
      LEFT JOIN target_databases td ON pb.target_database_id = td.id
      WHERE pb.id = ?
    `, [id]);
  }

  async listPreviewBatches(params) {
    const { page, page_size, status, migration_script_id, target_database_id, start_date, end_date } = params;
    const offset = (page - 1) * page_size;

    let whereConditions = [];
    let queryParams = [];

    if (status) {
      whereConditions.push('pb.status = ?');
      queryParams.push(status);
    }
    if (migration_script_id) {
      whereConditions.push('pb.migration_script_id = ?');
      queryParams.push(migration_script_id);
    }
    if (target_database_id) {
      whereConditions.push('pb.target_database_id = ?');
      queryParams.push(target_database_id);
    }
    if (start_date) {
      whereConditions.push('pb.created_at >= ?');
      queryParams.push(start_date);
    }
    if (end_date) {
      whereConditions.push('pb.created_at <= ?');
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [batches, total] = await Promise.all([
      all(`
        SELECT pb.*, ms.name as migration_script_name, td.name as target_database_name
        FROM preview_batches pb
        LEFT JOIN migration_scripts ms ON pb.migration_script_id = ms.id
        LEFT JOIN target_databases td ON pb.target_database_id = td.id
        ${whereClause}
        ORDER BY pb.created_at DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, page_size, offset]),
      get(`
        SELECT COUNT(*) as count
        FROM preview_batches pb
        ${whereClause}
      `, queryParams)
    ]);

    return { list: batches, total: total.count, page, pageSize };
  }

  async updateBatchStatus(id, data) {
    const batch = await this.getPreviewBatch(id);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const allowedTransitions = STATUS_TRANSITIONS[batch.status];
    if (!allowedTransitions.includes(data.status)) {
      throw new Error(`不允许从 ${batch.status} 状态转移到 ${data.status}，允许的状态: ${allowedTransitions.join(', ')}`);
    }

    const now = new Date().toISOString();
    let updateFields = ['status = ?', 'updated_at = ?'];
    let updateParams = [data.status, now];

    if (data.status === BATCH_STATUS.RUNNING) {
      updateFields.push('started_at = ?');
      updateParams.push(now);
    } else if ([BATCH_STATUS.COMPLETED, BATCH_STATUS.FAILED].includes(data.status)) {
      updateFields.push('completed_at = ?');
      updateParams.push(now);
      if (batch.started_at) {
        const duration = Math.floor((new Date(now) - new Date(batch.started_at)) / 1000);
        updateFields.push('execution_duration = ?');
        updateParams.push(duration);
      }
    }

    if (data.operator) {
      updateFields.push('operator = ?');
      updateParams.push(data.operator);
    }
    if (data.remarks) {
      updateFields.push('remarks = ?');
      updateParams.push(data.remarks);
    }

    await run(
      `UPDATE preview_batches SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateParams, id]
    );

    return this.getPreviewBatch(id);
  }

  async executePreview(batchId) {
    let batch = await this.getPreviewBatch(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.status !== BATCH_STATUS.PENDING) {
      throw new Error('只有 pending 状态的批次可以执行');
    }

    batch = await this.updateBatchStatus(batchId, { status: BATCH_STATUS.RUNNING });

    try {
      const script = await this.getMigrationScript(batch.migration_script_id);
      const affectedTables = await this.simulateMigrationImpact(script, batchId);
      const slowQueries = await this.detectSlowQueries(script, batchId);

      await run(
        `UPDATE preview_batches 
         SET affected_rows_count = ?, affected_tables_count = ?, slow_queries_count = ?, updated_at = ?
         WHERE id = ?`,
        [
          affectedTables.reduce((sum, t) => sum + t.affected_rows, 0),
          affectedTables.length,
          slowQueries.length,
          new Date().toISOString(),
          batchId
        ]
      );

      return await this.updateBatchStatus(batchId, { status: BATCH_STATUS.WAITING_CONFIRMATION });
    } catch (error) {
      logger.error('预演执行失败', { batchId, error: error.message, stack: error.stack });
      await run(
        `UPDATE preview_batches SET error_message = ?, error_stack = ?, updated_at = ? WHERE id = ?`,
        [error.message, error.stack, new Date().toISOString(), batchId]
      );
      return await this.updateBatchStatus(batchId, { status: BATCH_STATUS.FAILED });
    }
  }

  async simulateMigrationImpact(script, batchId) {
    const affectedTables = [];
    const tableNames = ['users', 'orders', 'products', 'transactions'];
    const operationTypes = ['UPDATE', 'INSERT', 'DELETE', 'ALTER'];

    for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
      const id = uuidv4();
      const tableData = {
        id,
        preview_batch_id: batchId,
        table_name: tableNames[i % tableNames.length],
        operation_type: operationTypes[i % operationTypes.length],
        affected_rows: Math.floor(Math.random() * 10000)
      };

      await run(
        `INSERT INTO affected_tables (id, preview_batch_id, table_name, operation_type, affected_rows)
         VALUES (?, ?, ?, ?, ?)`,
        [tableData.id, tableData.preview_batch_id, tableData.table_name, tableData.operation_type, tableData.affected_rows]
      );

      affectedTables.push(tableData);
    }

    return affectedTables;
  }

  async detectSlowQueries(script, batchId) {
    const slowQueries = [];
    const slowQueryCount = Math.floor(Math.random() * 5);

    for (let i = 0; i < slowQueryCount; i++) {
      const id = uuidv4();
      const queryData = {
        id,
        preview_batch_id: batchId,
        query_text: `SELECT * FROM large_table WHERE condition = ${i}`,
        execution_time_ms: Math.floor(Math.random() * 5000) + 1000,
        rows_examined: Math.floor(Math.random() * 1000000),
        rows_affected: Math.floor(Math.random() * 1000)
      };

      await run(
        `INSERT INTO slow_queries (id, preview_batch_id, query_text, execution_time_ms, rows_examined, rows_affected)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [queryData.id, queryData.preview_batch_id, queryData.query_text, queryData.execution_time_ms, queryData.rows_examined, queryData.rows_affected]
      );

      slowQueries.push(queryData);
    }

    return slowQueries;
  }

  async getBatchDetails(batchId) {
    const [batch, affectedTables, slowQueries, rollbackValidations, compensationActions] = await Promise.all([
      this.getPreviewBatch(batchId),
      all('SELECT * FROM affected_tables WHERE preview_batch_id = ?', [batchId]),
      all('SELECT * FROM slow_queries WHERE preview_batch_id = ? ORDER BY execution_time_ms DESC', [batchId]),
      all('SELECT * FROM rollback_validations WHERE preview_batch_id = ? ORDER BY created_at DESC', [batchId]),
      all('SELECT * FROM compensation_actions WHERE preview_batch_id = ? ORDER BY created_at DESC', [batchId])
    ]);

    return {
      batch,
      affectedTables,
      slowQueries,
      rollbackValidations,
      compensationActions
    };
  }

  async createRollbackValidation(batchId, data) {
    const id = uuidv4();
    await run(
      `INSERT INTO rollback_validations (id, preview_batch_id, status, validation_result, validated_by, validated_at, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, batchId, data.status, data.validation_result, data.validated_by, new Date().toISOString(), data.remarks]
    );
    return get('SELECT * FROM rollback_validations WHERE id = ?', [id]);
  }

  async createCompensationAction(batchId, data) {
    const id = uuidv4();
    await run(
      `INSERT INTO compensation_actions (id, preview_batch_id, action_type, action_content, status, remarks)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [id, batchId, data.action_type, data.action_content, data.remarks]
    );
    return get('SELECT * FROM compensation_actions WHERE id = ?', [id]);
  }

  async executeCompensation(actionId, data) {
    await run(
      `UPDATE compensation_actions 
       SET status = 'executed', executed_by = ?, executed_at = ?, result = ?
       WHERE id = ?`,
      [data.executed_by, new Date().toISOString(), data.result, actionId]
    );

    const action = await get('SELECT * FROM compensation_actions WHERE id = ?', [actionId]);
    await run(
      `UPDATE preview_batches SET status = 'compensated', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), action.preview_batch_id]
    );

    return action;
  }

  async getStatistics() {
    const [batchStats, statusStats] = await Promise.all([
      all(`
        SELECT 
          COUNT(*) as total_batches,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
          SUM(affected_rows_count) as total_affected_rows,
          SUM(slow_queries_count) as total_slow_queries
        FROM preview_batches
      `),
      all(`
        SELECT status, COUNT(*) as count
        FROM preview_batches
        GROUP BY status
      `)
    ]);

    return {
      overview: batchStats[0],
      byStatus: statusStats
    };
  }

  async exportBatchData(batchId) {
    return this.getBatchDetails(batchId);
  }
}

module.exports = new MigrationService();
module.exports.BATCH_STATUS = BATCH_STATUS;
