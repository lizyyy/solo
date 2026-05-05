import { 
  DBProfile, 
  SchemaSQL, 
  SQLTraceEntry, 
  WriteBatch, 
  ShardingPlan,
  ValidationResult,
  ValidationError
} from '../types';

export class ConfigValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  async validateAll(
    dbProfile: DBProfile,
    schema: SchemaSQL,
    traceEntries: SQLTraceEntry[],
    writeBatches: WriteBatch[],
    shardingPlan?: ShardingPlan
  ): Promise<ValidationResult> {
    this.errors = [];
    this.warnings = [];

    this.validateDBProfile(dbProfile);
    this.validateSchema(schema);
    this.validateTraceEntries(traceEntries);
    this.validateWriteBatches(writeBatches);
    
    if (shardingPlan) {
      this.validateShardingPlan(shardingPlan);
    }

    this.validateCrossReferences(dbProfile, schema, traceEntries, writeBatches, shardingPlan);

    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings]
    };
  }

  private validateDBProfile(profile: DBProfile): void {
    if (!profile.database) {
      this.addError('database', '缺少 database 配置');
    } else {
      if (!profile.database.type) {
        this.addError('database.type', '缺少数据库类型配置');
      } else if (!['mysql', 'postgresql', 'sqlite'].includes(profile.database.type)) {
        this.addError('database.type', `不支持的数据库类型: ${profile.database.type}`);
      }

      if (!profile.database.host && profile.database.type !== 'sqlite') {
        this.addError('database.host', '缺少数据库主机配置');
      }

      if (!profile.database.port && profile.database.type !== 'sqlite') {
        this.addWarning('database.port', '未指定数据库端口，将使用默认端口');
      }

      if (!profile.database.database) {
        this.addError('database.database', '缺少数据库名配置');
      }
    }

    if (!profile.connectionPool) {
      this.addError('connectionPool', '缺少连接池配置');
    } else {
      if (profile.connectionPool.maxConnections === undefined) {
        this.addError('connectionPool.maxConnections', '缺少最大连接数配置');
      } else if (profile.connectionPool.maxConnections <= 0) {
        this.addError('connectionPool.maxConnections', '最大连接数必须大于 0', profile.connectionPool.maxConnections);
      } else if (profile.connectionPool.maxConnections > 1000) {
        this.addWarning('connectionPool.maxConnections', '最大连接数设置过高，可能导致系统资源耗尽', profile.connectionPool.maxConnections);
      }

      if (profile.connectionPool.minConnections === undefined) {
        this.addWarning('connectionPool.minConnections', '未指定最小连接数');
      } else if (profile.connectionPool.minConnections < 0) {
        this.addError('connectionPool.minConnections', '最小连接数不能为负数', profile.connectionPool.minConnections);
      } else if (profile.connectionPool.minConnections > profile.connectionPool.maxConnections) {
        this.addError('connectionPool.minConnections', '最小连接数不能大于最大连接数', {
          min: profile.connectionPool.minConnections,
          max: profile.connectionPool.maxConnections
        });
      }

      if (profile.connectionPool.maxWaitQueueSize === undefined) {
        this.addWarning('connectionPool.maxWaitQueueSize', '未指定最大等待队列大小');
      } else if (profile.connectionPool.maxWaitQueueSize < 0) {
        this.addError('connectionPool.maxWaitQueueSize', '最大等待队列大小不能为负数', profile.connectionPool.maxWaitQueueSize);
      }

      if (profile.connectionPool.connectionTimeoutMs === undefined) {
        this.addWarning('connectionPool.connectionTimeoutMs', '未指定连接超时时间');
      } else if (profile.connectionPool.connectionTimeoutMs <= 0) {
        this.addError('connectionPool.connectionTimeoutMs', '连接超时时间必须大于 0', profile.connectionPool.connectionTimeoutMs);
      } else if (profile.connectionPool.connectionTimeoutMs < 1000) {
        this.addWarning('connectionPool.connectionTimeoutMs', '连接超时时间设置过短，可能导致频繁超时', profile.connectionPool.connectionTimeoutMs);
      }

      if (profile.connectionPool.idleTimeoutMs !== undefined && profile.connectionPool.idleTimeoutMs <= 0) {
        this.addError('connectionPool.idleTimeoutMs', '空闲超时时间必须大于 0', profile.connectionPool.idleTimeoutMs);
      }
    }

    if (profile.readWriteSeparation) {
      if (profile.readWriteSeparation.enabled && profile.readWriteSeparation.readReplicas === undefined) {
        this.addWarning('readWriteSeparation.readReplicas', '启用了读写分离但未指定从库数量');
      }

      if (profile.readWriteSeparation.routingStrategy && 
          !['round-robin', 'least-connections', 'latency-based'].includes(profile.readWriteSeparation.routingStrategy)) {
        this.addError('readWriteSeparation.routingStrategy', `不支持的路由策略: ${profile.readWriteSeparation.routingStrategy}`);
      }
    }

    if (profile.sharding) {
      if (profile.sharding.enabled && profile.sharding.shardCount === undefined) {
        this.addError('sharding.shardCount', '启用了分库分表但未指定分片数量');
      }

      if (profile.sharding.shardCount !== undefined && profile.sharding.shardCount <= 0) {
        this.addError('sharding.shardCount', '分片数量必须大于 0', profile.sharding.shardCount);
      }

      if (profile.sharding.algorithm && 
          !['hash', 'range', 'modulo'].includes(profile.sharding.algorithm)) {
        this.addError('sharding.algorithm', `不支持的分片算法: ${profile.sharding.algorithm}`);
      }
    }
  }

  private validateSchema(schema: SchemaSQL): void {
    if (!schema.tables || schema.tables.length === 0) {
      this.addError('schema.tables', '未定义任何表');
      return;
    }

    const tableNames = new Set<string>();
    const indexNames = new Set<string>();

    for (const table of schema.tables) {
      if (!table.name) {
        this.addError('schema.tables[].name', '存在未命名的表定义');
        continue;
      }

      if (tableNames.has(table.name)) {
        this.addError('schema.tables[].name', `表名重复: ${table.name}`);
      }
      tableNames.add(table.name);

      if (!table.columns || table.columns.length === 0) {
        this.addWarning('schema.tables[].columns', `表 ${table.name} 未定义任何列`);
      } else {
        const columnNames = new Set<string>();
        for (const col of table.columns) {
          if (!col.name) {
            this.addError('schema.tables[].columns[].name', `表 ${table.name} 存在未命名的列`);
            continue;
          }
          if (columnNames.has(col.name)) {
            this.addError('schema.tables[].columns[].name', `表 ${table.name} 列名重复: ${col.name}`);
          }
          columnNames.add(col.name);

          if (!col.type) {
            this.addError('schema.tables[].columns[].type', `表 ${table.name} 列 ${col.name} 缺少类型定义`);
          }
        }

        if (table.primaryKey && table.primaryKey.length > 0) {
          for (const pkCol of table.primaryKey) {
            if (!columnNames.has(pkCol)) {
              this.addError('schema.tables[].primaryKey', `表 ${table.name} 主键列不存在: ${pkCol}`);
            }
          }
        }
      }
    }

    if (schema.indexes) {
      for (const index of schema.indexes) {
        if (!index.name) {
          this.addError('schema.indexes[].name', '存在未命名的索引');
          continue;
        }

        if (indexNames.has(index.name)) {
          this.addWarning('schema.indexes[].name', `索引名可能重复: ${index.name}`);
        }
        indexNames.add(index.name);

        if (!index.table) {
          this.addError('schema.indexes[].table', `索引 ${index.name} 未指定表`);
        } else if (!tableNames.has(index.table)) {
          this.addWarning('schema.indexes[].table', `索引 ${index.name} 引用的表不存在: ${index.table}`);
        }

        if (!index.columns || index.columns.length === 0) {
          this.addError('schema.indexes[].columns', `索引 ${index.name} 未指定任何列`);
        }
      }
    }
  }

  private validateTraceEntries(entries: SQLTraceEntry[]): void {
    if (entries.length === 0) {
      this.addWarning('traceEntries', '未提供任何 SQL Trace 记录，分析结果可能不准确');
      return;
    }

    const traceIds = new Set<string>();
    let lineNumber = 0;

    for (const entry of entries) {
      lineNumber++;

      if (!entry.timestamp || entry.timestamp <= 0) {
        this.addError(`traceEntries[${lineNumber}].timestamp`, `第 ${lineNumber} 行缺少或无效的时间戳`);
      }

      if (!entry.traceId) {
        this.addWarning(`traceEntries[${lineNumber}].traceId`, `第 ${lineNumber} 行缺少 traceId`);
      } else if (traceIds.has(entry.traceId)) {
        this.addWarning(`traceEntries[${lineNumber}].traceId`, `第 ${lineNumber} 行 traceId 可能重复: ${entry.traceId}`);
      }
      traceIds.add(entry.traceId);

      if (!entry.sql) {
        this.addError(`traceEntries[${lineNumber}].sql`, `第 ${lineNumber} 行缺少 SQL 语句`);
      } else if (entry.sql.trim().length === 0) {
        this.addError(`traceEntries[${lineNumber}].sql`, `第 ${lineNumber} 行 SQL 语句为空`);
      }

      if (entry.durationMs === undefined || entry.durationMs < 0) {
        this.addError(`traceEntries[${lineNumber}].durationMs`, `第 ${lineNumber} 行缺少或无效的执行时间`);
      }

      if (entry.isRead === undefined) {
        this.addWarning(`traceEntries[${lineNumber}].isRead`, `第 ${lineNumber} 行未指定读写类型，将尝试自动识别`);
      }

      if (entry.rowsReturned !== undefined && entry.rowsReturned < 0) {
        this.addError(`traceEntries[${lineNumber}].rowsReturned`, `第 ${lineNumber} 行返回行数不能为负数`, entry.rowsReturned);
      }

      if (entry.rowsAffected !== undefined && entry.rowsAffected < 0) {
        this.addError(`traceEntries[${lineNumber}].rowsAffected`, `第 ${lineNumber} 行影响行数不能为负数`, entry.rowsAffected);
      }
    }

    if (entries.length < 100) {
      this.addWarning('traceEntries', `SQL Trace 记录数量较少 (${entries.length} 条)，分析结果可能不具代表性`);
    }
  }

  private validateWriteBatches(batches: WriteBatch[]): void {
    if (batches.length === 0) {
      this.addWarning('writeBatches', '未提供任何写入批次数据');
      return;
    }

    let lineNumber = 0;
    const batchIds = new Set<string>();

    for (const batch of batches) {
      lineNumber++;

      if (!batch.batchId) {
        this.addWarning(`writeBatches[${lineNumber}].batchId`, `第 ${lineNumber} 行缺少 batchId`);
      } else if (batchIds.has(batch.batchId)) {
        this.addWarning(`writeBatches[${lineNumber}].batchId`, `第 ${lineNumber} 行 batchId 重复: ${batch.batchId}`);
      }
      batchIds.add(batch.batchId);

      if (!batch.table) {
        this.addError(`writeBatches[${lineNumber}].table`, `第 ${lineNumber} 行缺少表名`);
      }

      if (!batch.operation) {
        this.addWarning(`writeBatches[${lineNumber}].operation`, `第 ${lineNumber} 行缺少操作类型`);
      } else if (!['INSERT', 'UPDATE', 'DELETE'].includes(batch.operation)) {
        this.addError(`writeBatches[${lineNumber}].operation`, `第 ${lineNumber} 行无效的操作类型: ${batch.operation}`);
      }

      if (batch.rowCount === undefined || batch.rowCount <= 0) {
        this.addError(`writeBatches[${lineNumber}].rowCount`, `第 ${lineNumber} 行缺少或无效的行数`);
      }

      if (!batch.values || batch.values.length === 0) {
        this.addWarning(`writeBatches[${lineNumber}].values`, `第 ${lineNumber} 行未提供值数据`);
      }
    }
  }

  private validateShardingPlan(plan: ShardingPlan): void {
    if (!plan.shards || plan.shards.length === 0) {
      this.addError('shardingPlan.shards', '分库分表计划未定义任何分片');
      return;
    }

    const shardIds = new Set<number>();
    for (const shard of plan.shards) {
      if (shard.id === undefined) {
        this.addError('shardingPlan.shards[].id', '存在未指定 ID 的分片');
        continue;
      }

      if (shardIds.has(shard.id)) {
        this.addError('shardingPlan.shards[].id', `分片 ID 重复: ${shard.id}`);
      }
      shardIds.add(shard.id);

      if (!shard.name) {
        this.addWarning('shardingPlan.shards[].name', `分片 ${shard.id} 未指定名称`);
      }

      if (!shard.host) {
        this.addError('shardingPlan.shards[].host', `分片 ${shard.id} 缺少主机配置`);
      }

      if (!shard.database) {
        this.addError('shardingPlan.shards[].database', `分片 ${shard.id} 缺少数据库名`);
      }

      if (shard.weight !== undefined && shard.weight <= 0) {
        this.addError('shardingPlan.shards[].weight', `分片 ${shard.id} 权重必须大于 0`, shard.weight);
      }
    }

    if (plan.tables) {
      for (const tableConfig of plan.tables) {
        if (!tableConfig.table) {
          this.addError('shardingPlan.tables[].table', '存在未指定表名的分片配置');
          continue;
        }

        if (!tableConfig.shardKey) {
          this.addError('shardingPlan.tables[].shardKey', `表 ${tableConfig.table} 缺少分片键配置`);
        }

        if (!tableConfig.shardCount || tableConfig.shardCount <= 0) {
          this.addError('shardingPlan.tables[].shardCount', `表 ${tableConfig.table} 缺少或无效的分片数量`);
        }

        if (!tableConfig.algorithm) {
          this.addWarning('shardingPlan.tables[].algorithm', `表 ${tableConfig.table} 未指定分片算法`);
        } else if (!['hash', 'range', 'modulo'].includes(tableConfig.algorithm)) {
          this.addError('shardingPlan.tables[].algorithm', `表 ${tableConfig.table} 不支持的分片算法: ${tableConfig.algorithm}`);
        }
      }
    }

    if (plan.routingRules) {
      for (const rule of plan.routingRules) {
        if (!rule.pattern) {
          this.addError('shardingPlan.routingRules[].pattern', '存在未指定模式的路由规则');
        }

        if (!rule.shardIds || rule.shardIds.length === 0) {
          this.addError('shardingPlan.routingRules[].shardIds', '路由规则未指定任何分片 ID');
        } else {
          for (const shardId of rule.shardIds) {
            if (!shardIds.has(shardId)) {
              this.addWarning('shardingPlan.routingRules[].shardIds', `路由规则引用的分片 ID 不存在: ${shardId}`);
            }
          }
        }

        if (rule.priority !== undefined && rule.priority < 0) {
          this.addError('shardingPlan.routingRules[].priority', '路由规则优先级不能为负数', rule.priority);
        }
      }
    }
  }

  private validateCrossReferences(
    dbProfile: DBProfile,
    schema: SchemaSQL,
    traceEntries: SQLTraceEntry[],
    writeBatches: WriteBatch[],
    shardingPlan?: ShardingPlan
  ): void {
    const tableNames = new Set(schema.tables.map(t => t.name.toLowerCase()));

    for (const entry of traceEntries) {
      const sqlLower = entry.sql.toLowerCase();
      for (const table of tableNames) {
        if (sqlLower.includes(table)) {
          if (entry.shardId !== undefined && shardingPlan) {
            const validShard = shardingPlan.shards.some(s => s.id === entry.shardId);
            if (!validShard) {
              this.addWarning('crossReference', `Trace 记录引用了不存在的分片 ID: ${entry.shardId}`);
            }
          }
        }
      }
    }

    for (const batch of writeBatches) {
      if (batch.table && !tableNames.has(batch.table.toLowerCase())) {
        this.addWarning('crossReference', `写入批次引用了未在 schema 中定义的表: ${batch.table}`);
      }

      if (batch.shardId !== undefined && shardingPlan) {
        const validShard = shardingPlan.shards.some(s => s.id === batch.shardId);
        if (!validShard) {
          this.addWarning('crossReference', `写入批次引用了不存在的分片 ID: ${batch.shardId}`);
        }
      }
    }

    if (shardingPlan && shardingPlan.tables) {
      for (const tableConfig of shardingPlan.tables) {
        if (!tableNames.has(tableConfig.table.toLowerCase())) {
          this.addWarning('crossReference', `分片配置引用了未在 schema 中定义的表: ${tableConfig.table}`);
        }
      }
    }

    if (dbProfile.sharding?.enabled && !shardingPlan) {
      this.addWarning('crossReference', 'db-profile.yaml 中启用了分库分表，但未提供 sharding-plan.yaml');
    }
  }

  private addError(field: string, message: string, value?: any): void {
    this.errors.push({ field, message, value });
  }

  private addWarning(field: string, message: string, value?: any): void {
    this.warnings.push({ field, message, value });
  }
}
