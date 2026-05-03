class RiskAssessor {
  constructor(schema, trafficWindows) {
    this.schema = schema;
    this.trafficWindows = trafficWindows;
    
    // PostgreSQL 锁级别定义
    this.lockLevels = {
      ACCESS_SHARE: {
        name: 'ACCESS SHARE',
        level: 1,
        conflicts: ['ACCESS EXCLUSIVE'],
        description: '只读查询锁，与大多数操作兼容'
      },
      ROW_SHARE: {
        name: 'ROW SHARE',
        level: 2,
        conflicts: ['EXCLUSIVE', 'ACCESS EXCLUSIVE'],
        description: 'SELECT FOR UPDATE/SHARE 使用的锁'
      },
      ROW_EXCLUSIVE: {
        name: 'ROW EXCLUSIVE',
        level: 3,
        conflicts: ['SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
        description: 'INSERT/UPDATE/DELETE 使用的锁'
      },
      SHARE_UPDATE_EXCLUSIVE: {
        name: 'SHARE UPDATE EXCLUSIVE',
        level: 4,
        conflicts: ['SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
        description: 'VACUUM (without FULL), ANALYZE, CREATE INDEX CONCURRENTLY 使用'
      },
      SHARE: {
        name: 'SHARE',
        level: 5,
        conflicts: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
        description: 'CREATE INDEX (without CONCURRENTLY) 使用'
      },
      SHARE_ROW_EXCLUSIVE: {
        name: 'SHARE ROW EXCLUSIVE',
        level: 6,
        conflicts: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
        description: 'CREATE TRIGGER, some ALTER TABLE 使用'
      },
      EXCLUSIVE: {
        name: 'EXCLUSIVE',
        level: 7,
        conflicts: ['ROW SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
        description: 'REFRESH MATERIALIZED VIEW (without CONCURRENTLY) 使用'
      },
      ACCESS_EXCLUSIVE: {
        name: 'ACCESS EXCLUSIVE',
        level: 8,
        conflicts: ['ALL'],
        description: 'ALTER TABLE, DROP TABLE, TRUNCATE, REINDEX, CLUSTER, VACUUM FULL 使用'
      }
    };
    
    // 操作到锁级别的映射
    this.operationLockMap = {
      'ADD_COLUMN': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '添加列需要 ACCESS EXCLUSIVE 锁，但添加带默认值的列在 PostgreSQL 11+ 可以是瞬时的',
        hasDefault: false,
        isNullable: true
      },
      'DROP_COLUMN': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '删除列需要 ACCESS EXCLUSIVE 锁，但只是元数据操作，不会重写表'
      },
      'ALTER_COLUMN_TYPE': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '修改列类型通常需要重写表，持有 ACCESS EXCLUSIVE 锁时间较长',
        mayRewrite: true
      },
      'SET_NOT_NULL': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '设置 NOT NULL 约束需要扫描整个表验证数据',
        needsScan: true
      },
      'DROP_NOT_NULL': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '移除 NOT NULL 约束是简单的元数据操作'
      },
      'SET_DEFAULT': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '设置默认值是简单的元数据操作，不会影响现有数据'
      },
      'DROP_DEFAULT': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '移除默认值是简单的元数据操作'
      },
      'ADD_CONSTRAINT': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '添加约束通常需要 ACCESS EXCLUSIVE 锁'
      },
      'ADD_FOREIGN_KEY': {
        lockLevel: 'SHARE_ROW_EXCLUSIVE',
        description: '添加外键需要 SHARE ROW EXCLUSIVE 锁，会阻塞写入但允许读取',
        needsValidation: true
      },
      'ADD_PRIMARY_KEY': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '添加主键需要 ACCESS EXCLUSIVE 锁，会构建索引'
      },
      'ADD_UNIQUE_CONSTRAINT': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '添加唯一约束需要 ACCESS EXCLUSIVE 锁，会构建唯一索引'
      },
      'DROP_CONSTRAINT': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '删除约束是元数据操作'
      },
      'RENAME_TABLE': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '重命名表是简单的元数据操作，但需要注意应用兼容性'
      },
      'RENAME_COLUMN': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '重命名列是简单的元数据操作，但需要注意应用兼容性'
      },
      'ALTER_TABLE_OTHER': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '其他 ALTER TABLE 操作，需要具体分析'
      },
      'CREATE_INDEX': {
        lockLevel: 'SHARE',
        description: '创建索引（非 CONCURRENTLY）需要 SHARE 锁，阻塞写入但允许读取'
      },
      'CREATE_INDEX_CONCURRENTLY': {
        lockLevel: 'SHARE_UPDATE_EXCLUSIVE',
        description: '创建索引（CONCURRENTLY）不需要长时间锁表，可以在生产环境安全执行',
        isSafe: true
      },
      'DROP_INDEX': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '删除索引是元数据操作，通常很快',
        canUseConcurrently: true
      },
      'ALTER_INDEX': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '修改索引需要 ACCESS EXCLUSIVE 锁'
      },
      'UPDATE': {
        lockLevel: 'ROW_EXCLUSIVE',
        description: 'UPDATE 使用 ROW EXCLUSIVE 锁，影响行数决定锁持有时间'
      },
      'DELETE': {
        lockLevel: 'ROW_EXCLUSIVE',
        description: 'DELETE 使用 ROW EXCLUSIVE 锁，影响行数决定锁持有时间'
      },
      'INSERT': {
        lockLevel: 'ROW_EXCLUSIVE',
        description: 'INSERT 使用 ROW EXCLUSIVE 锁'
      },
      'CREATE_TABLE': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '创建新表，几乎没有风险因为还没有数据'
      },
      'DROP_TABLE': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: '删除表，高风险操作'
      },
      'TRUNCATE': {
        lockLevel: 'ACCESS_EXCLUSIVE',
        description: 'TRUNCATE 需要 ACCESS EXCLUSIVE 锁，会立即清空表'
      },
      'SELECT': {
        lockLevel: 'ACCESS_SHARE',
        description: 'SELECT 只需要 ACCESS SHARE 锁，不会阻塞其他操作'
      }
    };
  }

  assess(migrations) {
    const result = {
      migrations: [],
      tables: {},
      summary: {
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        noRisk: 0,
        total: 0
      },
      recommendations: [],
      timeline: []
    };

    let statementIndex = 0;

    for (const migration of migrations) {
      const migrationResult = {
        file: migration.file,
        statements: [],
        transactions: [],
        riskSummary: {
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0,
          noRisk: 0
        }
      };

      // 评估语句
      for (const stmt of migration.statements) {
        const assessment = this.assessStatement(stmt, statementIndex++);
        migrationResult.statements.push(assessment);
        
        // 更新统计
        switch (assessment.riskLevel) {
          case 'high':
            migrationResult.riskSummary.highRisk++;
            result.summary.highRisk++;
            break;
          case 'medium':
            migrationResult.riskSummary.mediumRisk++;
            result.summary.mediumRisk++;
            break;
          case 'low':
            migrationResult.riskSummary.lowRisk++;
            result.summary.lowRisk++;
            break;
          default:
            migrationResult.riskSummary.noRisk++;
            result.summary.noRisk++;
        }
        result.summary.total++;

        // 按表汇总
        if (assessment.table) {
          if (!result.tables[assessment.table]) {
            result.tables[assessment.table] = {
              table: assessment.table,
              statements: [],
              riskSummary: {
                highRisk: 0,
                mediumRisk: 0,
                lowRisk: 0,
                noRisk: 0
              },
              maxLockLevel: null,
              estimatedDuration: 0
            };
          }
          
          result.tables[assessment.table].statements.push(assessment);
          
          // 更新表级别风险统计
          switch (assessment.riskLevel) {
            case 'high':
              result.tables[assessment.table].riskSummary.highRisk++;
              break;
            case 'medium':
              result.tables[assessment.table].riskSummary.mediumRisk++;
              break;
            case 'low':
              result.tables[assessment.table].riskSummary.lowRisk++;
              break;
            default:
              result.tables[assessment.table].riskSummary.noRisk++;
          }
          
          // 更新最大锁级别
          const currentLockLevel = this.lockLevels[assessment.lockLevel];
          const tableLockLevel = result.tables[assessment.table].maxLockLevel 
            ? this.lockLevels[result.tables[assessment.table].maxLockLevel] 
            : null;
          
          if (!tableLockLevel || (currentLockLevel && currentLockLevel.level > tableLockLevel.level)) {
            result.tables[assessment.table].maxLockLevel = assessment.lockLevel;
          }
          
          // 累加预计时长
          result.tables[assessment.table].estimatedDuration += assessment.estimatedDuration || 0;
        }

        // 添加到时间线
        result.timeline.push({
          index: statementIndex - 1,
          statement: stmt.raw,
          assessment: assessment,
          file: migration.file
        });

        // 收集建议
        if (assessment.recommendations && assessment.recommendations.length > 0) {
          result.recommendations.push(...assessment.recommendations.map(r => ({
            ...r,
            file: migration.file,
            line: stmt.line,
            statement: stmt.raw
          })));
        }
      }

      // 评估事务
      for (const transaction of migration.transactions) {
        const transactionAssessment = this.assessTransaction(transaction);
        migrationResult.transactions.push(transactionAssessment);
        
        // 如果事务有风险，添加到建议
        if (transactionAssessment.riskLevel === 'high' || transactionAssessment.riskLevel === 'medium') {
          result.recommendations.push({
            type: 'TRANSACTION_RISK',
            riskLevel: transactionAssessment.riskLevel,
            message: transactionAssessment.description,
            file: migration.file,
            details: transactionAssessment
          });
        }
      }

      result.migrations.push(migrationResult);
    }

    return result;
  }

  assessStatement(stmt, index) {
    const result = {
      index: index,
      statement: stmt,
      table: stmt.table,
      indexName: stmt.index,
      operation: stmt.operation,
      lockLevel: null,
      lockDescription: '',
      riskLevel: 'none',
      riskReason: '',
      estimatedDuration: 0,
      canSplit: false,
      splitSteps: [],
      recommendations: [],
      concurrentlyUsed: stmt.concurrently,
      concurrentlyRecommended: false
    };

    // 获取锁级别信息
    const lockInfo = this.operationLockMap[stmt.operation];
    if (lockInfo) {
      result.lockLevel = lockInfo.lockLevel;
      result.lockDescription = lockInfo.description;
    }

    // 评估风险
    this.assessRiskLevel(result, stmt, lockInfo);

    // 评估预计时长
    this.estimateDuration(result, stmt);

    // 评估能否拆分
    this.assessSplittable(result, stmt, lockInfo);

    return result;
  }

  assessRiskLevel(result, stmt, lockInfo) {
    // 基础风险评估
    let baseRisk = 'none';
    
    if (lockInfo) {
      const lockLevel = this.lockLevels[lockInfo.lockLevel];
      if (lockLevel) {
        // 根据锁级别确定基础风险
        if (lockLevel.level >= 7) {
          baseRisk = 'high';
        } else if (lockLevel.level >= 5) {
          baseRisk = 'medium';
        } else if (lockLevel.level >= 3) {
          baseRisk = 'low';
        }
      }
      
      // 特殊操作的风险调整
      if (stmt.operation === 'CREATE_INDEX_CONCURRENTLY' || lockInfo.isSafe) {
        baseRisk = 'low';
        result.riskReason = '使用 CONCURRENTLY 创建索引，不会长时间锁表';
      }
      
      if (stmt.operation === 'CREATE_INDEX' && !stmt.concurrently) {
        baseRisk = 'high';
        result.riskReason = '创建索引未使用 CONCURRENTLY，会阻塞写入操作';
        result.recommendations.push({
          type: 'USE_CONCURRENTLY',
          riskLevel: 'high',
          message: '建议使用 CREATE INDEX CONCURRENTLY 替代 CREATE INDEX，避免阻塞写入',
          priority: 'high'
        });
      }
      
      // ALTER COLUMN TYPE 高风险
      if (stmt.operation === 'ALTER_COLUMN_TYPE') {
        baseRisk = 'high';
        result.riskReason = '修改列类型可能需要重写整个表，持有锁时间较长';
      }
      
      // SET NOT NULL 风险
      if (stmt.operation === 'SET_NOT_NULL') {
        baseRisk = 'high';
        result.riskReason = '设置 NOT NULL 约束需要扫描整个表验证数据';
        result.recommendations.push({
          type: 'SET_NOT_NULL_RISK',
          riskLevel: 'high',
          message: '设置 NOT NULL 前建议先检查该列是否已有 NULL 值，并考虑在低峰期执行',
          priority: 'high'
        });
      }
      
      // TRUNCATE 高风险
      if (stmt.operation === 'TRUNCATE') {
        baseRisk = 'high';
        result.riskReason = 'TRUNCATE 会立即清空表数据，且需要 ACCESS EXCLUSIVE 锁';
      }
      
      // DROP TABLE 高风险
      if (stmt.operation === 'DROP_TABLE') {
        baseRisk = 'high';
        result.riskReason = '删除表是高风险操作';
      }
      
      // UPDATE/DELETE 没有 WHERE 条件的风险
      if ((stmt.operation === 'UPDATE' || stmt.operation === 'DELETE') && !stmt.hasWhere) {
        baseRisk = 'high';
        result.riskReason = `${stmt.operation} 语句没有 WHERE 条件，会影响所有行`;
        result.recommendations.push({
          type: 'MISSING_WHERE',
          riskLevel: 'high',
          message: `${stmt.operation} 语句没有 WHERE 条件，建议添加限制条件或分批执行`,
          priority: 'critical'
        });
      }
    }

    // 结合流量窗口调整风险
    if (this.trafficWindows && result.table) {
      // 使用当前时间进行估计
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const tableTraffic = this.getTableTrafficInfo(result.table, currentTime);
      if (tableTraffic) {
        if (tableTraffic.trafficLevel === 'high' && baseRisk !== 'none') {
          // 高流量时段，风险升级
          if (baseRisk === 'medium') {
            baseRisk = 'high';
            result.riskReason = (result.riskReason || '') + '（当前时段流量较高）';
          } else if (baseRisk === 'low') {
            baseRisk = 'medium';
            result.riskReason = (result.riskReason || '') + '（当前时段流量中等）';
          }
        }
      }
    }

    result.riskLevel = baseRisk;
  }

  getTableTrafficInfo(tableName, time) {
    if (!this.trafficWindows || !this.trafficWindows.length) return null;
    
    for (const window of this.trafficWindows) {
      if (window.tables) {
        const tableConfig = window.tables.find(t => t.name === tableName);
        if (tableConfig) {
          return tableConfig;
        }
      }
    }
    return null;
  }

  estimateDuration(result, stmt) {
    let duration = 0; // 秒
    
    // 获取表大小信息
    const tableInfo = this.getTableInfo(stmt.table);
    const rowCount = tableInfo ? tableInfo.rowCount : 0;
    const tableSize = tableInfo ? tableInfo.size : 0; // 字节
    
    // 根据操作类型估计时长
    switch (stmt.operation) {
      case 'CREATE_INDEX':
      case 'CREATE_INDEX_CONCURRENTLY':
        // 索引创建时间与表大小成正比
        // CONCURRENTLY 大约需要 2 倍时间，但不锁表
        duration = Math.max(5, tableSize / (10 * 1024 * 1024)); // 假设 10MB/s
        if (stmt.concurrently) {
          duration *= 2;
        }
        break;
        
      case 'ALTER_COLUMN_TYPE':
        // 类型修改可能需要重写表
        duration = Math.max(10, tableSize / (5 * 1024 * 1024)); // 假设 5MB/s
        break;
        
      case 'SET_NOT_NULL':
        // 需要扫描表验证
        duration = Math.max(2, rowCount / 10000); // 假设每秒 10000 行
        break;
        
      case 'UPDATE':
      case 'DELETE':
        // 假设每次操作影响所有行（保守估计）
        duration = Math.max(1, rowCount / 1000); // 假设每秒 1000 行
        break;
        
      case 'TRUNCATE':
        duration = 1; // TRUNCATE 通常很快
        break;
        
      default:
        // 其他操作默认 1 秒
        duration = 1;
    }
    
    result.estimatedDuration = Math.round(duration);
  }

  getTableInfo(tableName) {
    if (!this.schema || !this.schema.tables) return null;
    return this.schema.tables.find(t => t.name === tableName);
  }

  assessSplittable(result, stmt, lockInfo) {
    result.canSplit = false;
    result.splitSteps = [];

    // 检查是否可以拆分
    switch (stmt.operation) {
      case 'CREATE_INDEX':
        if (!stmt.concurrently) {
          result.canSplit = true;
          result.concurrentlyRecommended = true;
          result.splitSteps = [
            {
              step: 1,
              description: '使用 CONCURRENTLY 创建索引',
              sql: stmt.raw.replace(/CREATE\s+(?:UNIQUE\s+)?INDEX/i, 'CREATE $1INDEX CONCURRENTLY'),
              risk: 'low',
              reason: 'CONCURRENTLY 不会长时间锁表'
            }
          ];
          result.recommendations.push({
            type: 'USE_CONCURRENTLY',
            riskLevel: 'high',
            message: '建议使用 CREATE INDEX CONCURRENTLY 替代 CREATE INDEX',
            priority: 'high'
          });
        }
        break;
        
      case 'DROP_INDEX':
        if (!stmt.concurrently) {
          result.canSplit = true;
          result.concurrentlyRecommended = true;
          result.splitSteps = [
            {
              step: 1,
              description: '使用 CONCURRENTLY 删除索引',
              sql: stmt.raw.replace(/DROP\s+INDEX/i, 'DROP INDEX CONCURRENTLY'),
              risk: 'low',
              reason: 'CONCURRENTLY 不会长时间锁表'
            }
          ];
        }
        break;
        
      case 'UPDATE':
      case 'DELETE':
        if (!stmt.hasWhere || this.isLargeOperation(stmt)) {
          result.canSplit = true;
          result.splitSteps = [
            {
              step: 1,
              description: '分批执行，使用 LIMIT 限制每次影响的行数',
              example: `${stmt.operation} ... WHERE id > last_id LIMIT 1000`,
              risk: 'low',
              reason: '分批执行可以减少锁持有时间'
            },
            {
              step: 2,
              description: '在事务外部执行，或者使用短事务',
              risk: 'low',
              reason: '避免长事务持有锁'
            }
          ];
          result.recommendations.push({
            type: 'BATCH_OPERATION',
            riskLevel: 'medium',
            message: `建议将 ${stmt.operation} 操作分批执行，使用 LIMIT 限制每次影响的行数`,
            priority: 'medium'
          });
        }
        break;
        
      case 'ALTER_COLUMN_TYPE':
        result.canSplit = true;
        result.splitSteps = [
          {
            step: 1,
            description: '添加新列（使用默认值）',
            risk: 'low',
            reason: 'PostgreSQL 11+ 添加带默认值的列是瞬时操作'
          },
          {
            step: 2,
            description: '后台分批更新新列的值',
            risk: 'low',
            reason: '分批更新不会长时间锁表'
          },
          {
            step: 3,
            description: '创建索引（如果需要）',
            risk: 'low',
            reason: '使用 CONCURRENTLY 创建索引'
          },
          {
            step: 4,
            description: '在低峰期切换列（重命名或切换应用逻辑）',
            risk: 'medium',
            reason: '切换操作可能需要短暂锁表'
          },
          {
            step: 5,
            description: '删除旧列（如果确定不再需要）',
            risk: 'medium',
            reason: '删除列是元数据操作，但需要确认应用兼容性'
          }
        ];
        break;
        
      case 'SET_NOT_NULL':
        result.canSplit = true;
        result.splitSteps = [
          {
            step: 1,
            description: '先检查该列是否有 NULL 值',
            sql: `SELECT COUNT(*) FROM ${stmt.table} WHERE column_name IS NULL`,
            risk: 'low',
            reason: '确认数据状态'
          },
          {
            step: 2,
            description: '如果有 NULL 值，先更新为非 NULL 值',
            risk: 'medium',
            reason: '分批更新避免长时间锁表'
          },
          {
            step: 3,
            description: '添加 CHECK 约束作为过渡（NOT VALID）',
            sql: `ALTER TABLE ${stmt.table} ADD CONSTRAINT constraint_name CHECK (column_name IS NOT NULL) NOT VALID`,
            risk: 'low',
            reason: 'NOT VALID 不会扫描现有数据'
          },
          {
            step: 4,
            description: 'VALIDATE 约束',
            sql: `ALTER TABLE ${stmt.table} VALIDATE CONSTRAINT constraint_name`,
            risk: 'low',
            reason: 'VALIDATE 只需要 SHARE UPDATE EXCLUSIVE 锁'
          },
          {
            step: 5,
            description: '在低峰期设置 NOT NULL 并删除 CHECK 约束',
            risk: 'medium',
            reason: '这个步骤仍需要 ACCESS EXCLUSIVE 锁，但时间较短'
          }
        ];
        break;
    }
  }

  isLargeOperation(stmt) {
    const tableInfo = this.getTableInfo(stmt.table);
    if (!tableInfo) return false;
    // 超过 10 万行认为是大操作
    return tableInfo.rowCount > 100000;
  }

  assessTransaction(transaction) {
    const result = {
      statements: transaction.statements,
      riskLevel: 'none',
      description: '',
      hasMixedDDLandDML: transaction.hasDDL && transaction.hasDML,
      hasConcurrentlyInTransaction: transaction.hasConcurrently,
      statementCount: transaction.statements.length
    };

    // 评估事务风险
    if (transaction.hasConcurrently) {
      result.riskLevel = 'high';
      result.description = '事务块中包含 CONCURRENTLY 操作，这会导致 PostgreSQL 错误。CONCURRENTLY 必须在事务外部执行。';
    } else if (transaction.hasDDL && transaction.hasDML) {
      result.riskLevel = 'medium';
      result.description = '事务块中混合了 DDL 和 DML 操作，这可能导致长时间锁表。建议将 DDL 和 DML 分开执行。';
    } else if (transaction.statements.length > 10) {
      result.riskLevel = 'low';
      result.description = `事务块包含 ${transaction.statements.length} 条语句，可能是长事务。考虑拆分以减少锁持有时间。`;
    }

    return result;
  }
}

module.exports = RiskAssessor;