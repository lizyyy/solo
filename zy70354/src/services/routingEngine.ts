import { v4 as uuidv4 } from 'uuid';
import {
  RoutingKey,
  ShardTarget,
  ShardRuleType,
  OrderContext,
  WriteStrategy,
  ReadStrategy,
  MigrationStatus,
  WriteRoutingResult,
  QueryRoutingResult,
  QueryPlan,
  QueryPlanStep,
  AuditRecord,
} from '../types';
import { configService } from './configService';
import { auditService } from '../utils/audit';

class RoutingEngine {
  private generateRequestId(): string {
    return uuidv4();
  }

  parseRoutingKey(context: OrderContext): RoutingKey {
    const routingKey: RoutingKey = {
      tenantId: context.tenantId,
    };

    if (context.createdAt) {
      routingKey.timestamp = new Date(context.createdAt).getTime();
    }

    if (context.orderId) {
      routingKey.orderId = context.orderId;
    }

    return routingKey;
  }

  validateRoutingKey(routingKey: RoutingKey): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!routingKey.tenantId) {
      errors.push('缺少必须的路由键：tenantId');
    }

    const tenantConfig = configService.getTenantConfig(routingKey.tenantId);
    if (!tenantConfig) {
      errors.push(`租户配置不存在：${routingKey.tenantId}`);
    }

    return { valid: errors.length === 0, errors };
  }

  calculateShardByMonthly(
    tenantId: string,
    timestamp: number
  ): ShardTarget | null {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const mapping = configService.getMonthlyShardMapping(tenantId, year, month);
    if (!mapping) {
      return null;
    }

    const shardConfig = configService.getShardConfig(mapping.shardId);
    if (!shardConfig) {
      return null;
    }

    return {
      shardId: mapping.shardId,
      database: shardConfig.database,
      table: shardConfig.table,
      isHistorical: shardConfig.isHistorical,
      confidence: 1.0,
      reason: `根据订单时间 ${year}-${month.toString().padStart(2, '0')} 匹配到月度分片规则`,
    };
  }

  calculateShardByTenantHash(
    tenantId: string,
    useNewShard: boolean = true
  ): ShardTarget[] {
    const tenantConfig = configService.getTenantConfig(tenantId);
    if (!tenantConfig) {
      return [];
    }

    const targets: ShardTarget[] = [];

    if (useNewShard && tenantConfig.currentShardId) {
      const newShard = configService.getShardConfig(tenantConfig.currentShardId);
      if (newShard) {
        targets.push({
          shardId: newShard.shardId,
          database: newShard.database,
          table: newShard.table,
          isHistorical: newShard.isHistorical,
          confidence: 1.0,
          reason: '使用租户当前配置的主分片',
        });
      }
    }

    if (!useNewShard && tenantConfig.oldShardId) {
      const oldShard = configService.getShardConfig(tenantConfig.oldShardId);
      if (oldShard) {
        targets.push({
          shardId: oldShard.shardId,
          database: oldShard.database,
          table: oldShard.table,
          isHistorical: oldShard.isHistorical,
          confidence: 1.0,
          reason: '使用租户配置的旧分片',
        });
      }
    }

    return targets;
  }

  getWriteTargets(
    context: OrderContext,
    routingKey: RoutingKey
  ): {
    writeTargets: ShardTarget[];
    writeStrategy: WriteStrategy;
    requiresCompensation: boolean;
    isIdempotentWrite: boolean;
  } {
    const tenantConfig = configService.getTenantConfig(context.tenantId);
    if (!tenantConfig) {
      throw new Error('租户配置不存在');
    }

    const { shardRuleType, writeStrategy, migrationStatus } = tenantConfig;
    const targets: ShardTarget[] = [];

    if (migrationStatus === MigrationStatus.IN_PROGRESS) {
      if (writeStrategy === WriteStrategy.DUAL_WRITE) {
        const { oldShard, newShard } = configService.getOldAndNewShards(context.tenantId);
        if (newShard) {
          targets.push({
            shardId: newShard.shardId,
            database: newShard.database,
            table: newShard.table,
            isHistorical: newShard.isHistorical,
            confidence: 1.0,
            reason: '双写模式：写入新分片（主目标）',
          });
        }
        if (oldShard) {
          targets.push({
            shardId: oldShard.shardId,
            database: oldShard.database,
            table: oldShard.table,
            isHistorical: oldShard.isHistorical,
            confidence: 0.8,
            reason: '双写模式：写入旧分片（备用目标）',
          });
        }
        return {
          writeTargets: targets,
          writeStrategy: WriteStrategy.DUAL_WRITE,
          requiresCompensation: true,
          isIdempotentWrite: false,
        };
      } else if (writeStrategy === WriteStrategy.NEW_ONLY) {
        const newTargets = this.calculateShardByTenantHash(context.tenantId, true);
        return {
          writeTargets: newTargets,
          writeStrategy: WriteStrategy.NEW_ONLY,
          requiresCompensation: false,
          isIdempotentWrite: false,
        };
      }
    }

    if (shardRuleType === ShardRuleType.MONTHLY && routingKey.timestamp) {
      const monthlyShard = this.calculateShardByMonthly(context.tenantId, routingKey.timestamp);
      if (monthlyShard) {
        targets.push(monthlyShard);
        return {
          writeTargets: targets,
          writeStrategy: WriteStrategy.NEW_ONLY,
          requiresCompensation: false,
          isIdempotentWrite: false,
        };
      }
    }

    if (shardRuleType === ShardRuleType.TENANT_HASH) {
      const hashTargets = this.calculateShardByTenantHash(context.tenantId, true);
      return {
        writeTargets: hashTargets,
        writeStrategy: WriteStrategy.NEW_ONLY,
        requiresCompensation: false,
        isIdempotentWrite: false,
      };
    }

    return {
      writeTargets: [],
      writeStrategy: writeStrategy,
      requiresCompensation: false,
      isIdempotentWrite: false,
    };
  }

  getReadTargets(
    context: OrderContext,
    routingKey: RoutingKey
  ): {
    readTargets: ShardTarget[];
    readStrategy: ReadStrategy;
    alternativeTargets: ShardTarget[];
  } {
    const tenantConfig = configService.getTenantConfig(context.tenantId);
    if (!tenantConfig) {
      throw new Error('租户配置不存在');
    }

    const { shardRuleType, readStrategy, migrationStatus } = tenantConfig;
    const targets: ShardTarget[] = [];
    const alternatives: ShardTarget[] = [];

    if (migrationStatus === MigrationStatus.IN_PROGRESS) {
      if (readStrategy === ReadStrategy.DUAL_READ) {
        const { oldShard, newShard } = configService.getOldAndNewShards(context.tenantId);
        if (newShard) {
          targets.push({
            shardId: newShard.shardId,
            database: newShard.database,
            table: newShard.table,
            isHistorical: newShard.isHistorical,
            confidence: 1.0,
            reason: '双读模式：读取新分片（主目标）',
          });
        }
        if (oldShard) {
          targets.push({
            shardId: oldShard.shardId,
            database: oldShard.database,
            table: oldShard.table,
            isHistorical: oldShard.isHistorical,
            confidence: 0.9,
            reason: '双读模式：读取旧分片（备用目标）',
          });
        }
        return {
          readTargets: targets,
          readStrategy: ReadStrategy.DUAL_READ,
          alternativeTargets: [],
        };
      }
    }

    if (shardRuleType === ShardRuleType.MONTHLY && routingKey.timestamp) {
      const monthlyShard = this.calculateShardByMonthly(context.tenantId, routingKey.timestamp);
      if (monthlyShard) {
        targets.push(monthlyShard);
        return {
          readTargets: targets,
          readStrategy: ReadStrategy.NEW_ONLY,
          alternativeTargets: [],
        };
      }
    }

    if (shardRuleType === ShardRuleType.TENANT_HASH) {
      const hashTargets = this.calculateShardByTenantHash(context.tenantId, true);
      return {
        readTargets: hashTargets,
        readStrategy: ReadStrategy.NEW_ONLY,
        alternativeTargets: [],
      };
    }

    return {
      readTargets: [],
      readStrategy: readStrategy,
      alternativeTargets: [],
    };
  }

  buildCrossMonthQueryPlan(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): QueryPlan {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    const fromYear = from.getFullYear();
    const fromMonth = from.getMonth() + 1;
    const toYear = to.getFullYear();
    const toMonth = to.getMonth() + 1;

    const mappings = configService.getMonthlyShardMappingsByTimeRange(
      tenantId,
      fromYear,
      fromMonth,
      toYear,
      toMonth
    );

    const uniqueShards: Map<string, {
      shardId: string;
      minDate: Date;
      maxDate: Date;
    }> = new Map();

    mappings.forEach((mapping) => {
      const existing = uniqueShards.get(mapping.shardId);
      const mappingDate = new Date(mapping.year, mapping.month - 1, 1);

      if (!existing) {
        uniqueShards.set(mapping.shardId, {
          shardId: mapping.shardId,
          minDate: mappingDate,
          maxDate: mappingDate,
        });
      } else {
        if (mappingDate < existing.minDate) {
          existing.minDate = mappingDate;
        }
        if (mappingDate > existing.maxDate) {
          existing.maxDate = mappingDate;
        }
      }
    });

    const steps: QueryPlanStep[] = [];
    let order = 1;

    uniqueShards.forEach((value, shardId) => {
      const shardConfig = configService.getShardConfig(shardId);
      if (!shardConfig) return;

      const stepFrom = new Date(value.minDate);
      const stepTo = new Date(value.maxDate);
      stepTo.setMonth(stepTo.getMonth() + 1);
      stepTo.setDate(0);

      steps.push({
        stepId: uuidv4(),
        order: order++,
        shardId: shardId,
        database: shardConfig.database,
        table: shardConfig.table,
        timeRange: {
          from: stepFrom.toISOString(),
          to: stepTo.toISOString(),
        },
        description: `查询 ${shardConfig.database}.${shardConfig.table}`,
        reason: `时间范围 ${stepFrom.getFullYear()}-${(stepFrom.getMonth() + 1).toString().padStart(2, '0')} 到 ${stepTo.getFullYear()}-${(stepTo.getMonth() + 1).toString().padStart(2, '0')} 匹配此分片`,
        canExecuteInParallel: true,
      });
    });

    const warnings: string[] = [];
    const maxRange = configService.getMaxCrossMonthRange();
    const monthDiff = (toYear - fromYear) * 12 + (toMonth - fromMonth);

    if (monthDiff > maxRange) {
      warnings.push(`查询时间范围 ${monthDiff + 1} 个月，超过建议的 ${maxRange} 个月限制，建议缩小范围或分批查询`);
    }

    return {
      planId: uuidv4(),
      totalSteps: steps.length,
      steps,
      originalQuery: {
        tenantId,
        timeRange: {
          from: fromDate,
          to: toDate,
        },
      },
      estimatedShardCount: uniqueShards.size,
      executionStrategy: steps.length <= 2 ? 'parallel' : 'hybrid',
      warnings,
    };
  }

  resolveDualReadConflict(
    oldResult: any,
    newResult: any
  ): {
    hasConflict: boolean;
    conflictDetails?: {
      field: string;
      oldValue: any;
      newValue: any;
    }[];
    resolution: 'use_old' | 'use_new' | 'pending' | 'error';
  } {
    if (!oldResult || !newResult) {
      return {
        hasConflict: false,
        resolution: oldResult ? 'use_old' : 'use_new',
      };
    }

    const conflictDetails: {
      field: string;
      oldValue: any;
      newValue: any;
    }[] = [];

    const allKeys = new Set([...Object.keys(oldResult), ...Object.keys(newResult)]);

    allKeys.forEach((key) => {
      if (JSON.stringify(oldResult[key]) !== JSON.stringify(newResult[key])) {
        conflictDetails.push({
          field: key,
          oldValue: oldResult[key],
          newValue: newResult[key],
        });
      }
    });

    if (conflictDetails.length === 0) {
      return {
        hasConflict: false,
        resolution: 'use_new',
      };
    }

    return {
      hasConflict: true,
      conflictDetails,
      resolution: 'pending',
    };
  }

  routeWrite(context: OrderContext): WriteRoutingResult {
    const requestId = this.generateRequestId();
    const routingKey = this.parseRoutingKey(context);
    const validation = this.validateRoutingKey(routingKey);
    const tenantConfig = configService.getTenantConfig(context.tenantId);

    const auditRecords: AuditRecord[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!validation.valid) {
      errors.push(...validation.errors);
    }

    const isMigrationInProgress = configService.isMigrationInProgress(context.tenantId);
    const requiresDualWrite = configService.requiresDualWrite(context.tenantId);

    let writeTargets: ShardTarget[] = [];
    let writeStrategy: WriteStrategy = WriteStrategy.NEW_ONLY;
    let requiresCompensation = false;
    let isIdempotentWrite = false;
    let primaryTarget: ShardTarget | undefined;
    const alternativeTargets: ShardTarget[] = [];

    try {
      const result = this.getWriteTargets(context, routingKey);
      writeTargets = result.writeTargets;
      writeStrategy = result.writeStrategy;
      requiresCompensation = result.requiresCompensation;
      isIdempotentWrite = result.isIdempotentWrite;

      if (writeTargets.length > 0) {
        primaryTarget = writeTargets[0];
        alternativeTargets.push(...writeTargets.slice(1));
      }

      writeTargets.forEach((target) => {
        auditRecords.push(
          auditService.createRecord(
            'ROUTE_WRITE',
            target.shardId,
            'write',
            {
              strategy: writeStrategy,
              context: {
                orderId: context.orderId,
                orderNo: context.orderNo,
              },
            },
            'routing-engine'
          )
        );
      });
    } catch (error) {
      errors.push(`路由计算失败：${error}`);
    }

    if (!routingKey.timestamp && tenantConfig?.shardRuleType === ShardRuleType.MONTHLY) {
      warnings.push('使用时间戳作为路由键');
    } else if (tenantConfig?.shardRuleType === ShardRuleType.TENANT_HASH && !context.orderId) {
      warnings.push('缺少订单ID，可能影响查询效率');
    }

    const result: WriteRoutingResult = {
      success: errors.length === 0,
      requestId,
      timestamp: new Date().toISOString(),
      primaryTarget,
      alternativeTargets,
      routingKey,
      tenantConfig: {
        tenantId: context.tenantId,
        migrationStatus: tenantConfig?.migrationStatus || MigrationStatus.NOT_STARTED,
        writeStrategy,
        readStrategy: tenantConfig?.readStrategy || ReadStrategy.NEW_ONLY,
      },
      auditRecords,
      warnings,
      errors,
      isMigrationInProgress,
      requiresDualWrite,
      requiresDualRead: configService.requiresDualRead(context.tenantId),
      writeTargets,
      writeStrategy,
      isIdempotentWrite,
      requiresCompensation,
    };

    if (isMigrationInProgress && requiresDualWrite) {
      result.conflictResolution = {
        strategy: 'dual_write_with_compensation',
        actions: [
          '先写入新分片',
          '再写入旧分片',
          '任一失败触发补偿机制',
        ],
      };
    }

    return result;
  }

  routeQuery(
    context: OrderContext,
    queryPlan?: {
      fromDate: string;
      toDate: string;
    }
  ): QueryRoutingResult {
    const requestId = this.generateRequestId();
    const routingKey = this.parseRoutingKey(context);
    const validation = this.validateRoutingKey(routingKey);
    const tenantConfig = configService.getTenantConfig(context.tenantId);

    const auditRecords: AuditRecord[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!validation.valid) {
      errors.push(...validation.errors);
    }

    const isMigrationInProgress = configService.isMigrationInProgress(context.tenantId);
    const requiresDualRead = configService.requiresDualRead(context.tenantId);

    let readTargets: ShardTarget[] = [];
    let readStrategy: ReadStrategy = ReadStrategy.NEW_ONLY;
    let primaryTarget: ShardTarget | undefined;
    const alternativeTargets: ShardTarget[] = [];
    let plan: QueryPlan | undefined;

    try {
      if (queryPlan && tenantConfig?.shardRuleType === ShardRuleType.MONTHLY) {
        plan = this.buildCrossMonthQueryPlan(
          context.tenantId,
          queryPlan.fromDate,
          queryPlan.toDate
        );

        plan.steps.forEach((step) => {
          readTargets.push({
            shardId: step.shardId,
            database: step.database,
            table: step.table,
            isHistorical: configService.getShardConfig(step.shardId)?.isHistorical || false,
            confidence: 1.0,
            reason: step.reason,
          });
        });
      } else {
        const result = this.getReadTargets(context, routingKey);
        readTargets = result.readTargets;
        readStrategy = result.readStrategy;
        alternativeTargets.push(...result.alternativeTargets);
      }

      if (readTargets.length > 0) {
        primaryTarget = readTargets[0];
      }

      readTargets.forEach((target) => {
        auditRecords.push(
          auditService.createRecord(
            'ROUTE_QUERY',
            target.shardId,
            'read',
            {
              strategy: readStrategy,
              context: {
                orderId: context.orderId,
                orderNo: context.orderNo,
              },
            },
            'routing-engine'
          )
        );
      });
    } catch (error) {
      errors.push(`路由计算失败：${error}`);
    }

    if (queryPlan?.fromDate && queryPlan?.toDate && plan) {
      warnings.push(...(plan.warnings || []));
    }

    const result: QueryRoutingResult = {
      success: errors.length === 0,
      requestId,
      timestamp: new Date().toISOString(),
      primaryTarget,
      alternativeTargets,
      routingKey,
      tenantConfig: {
        tenantId: context.tenantId,
        migrationStatus: tenantConfig?.migrationStatus || MigrationStatus.NOT_STARTED,
        writeStrategy: tenantConfig?.writeStrategy || WriteStrategy.NEW_ONLY,
        readStrategy,
      },
      auditRecords,
      warnings,
      errors,
      isMigrationInProgress,
      requiresDualWrite: configService.requiresDualWrite(context.tenantId),
      requiresDualRead,
      readTargets,
      readStrategy,
      queryPlan: plan,
    };

    if (isMigrationInProgress && requiresDualRead) {
      result.conflictResolution = {
        status: 'pending',
        message: '迁移中双读结果可能存在冲突，需人工处理或自动合并',
      };
    }

    return result;
  }
}

export const routingEngine = new RoutingEngine();
