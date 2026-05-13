import { AppConfig, TenantConfig, ShardConfig, MonthlyShardMapping, ShardRuleConfig, MigrationStatus } from '../types';
import { appConfig, tenantConfigs, shardConfigs, monthlyShardMappings, shardRuleConfigs } from '../config/defaults';

class ConfigService {
  private appConfig: AppConfig = appConfig;
  private tenantConfigs: Record<string, TenantConfig> = tenantConfigs;
  private shardConfigs: Record<string, ShardConfig> = shardConfigs;
  private monthlyShardMappings: MonthlyShardMapping[] = monthlyShardMappings;
  private shardRuleConfigs: Record<string, ShardRuleConfig> = shardRuleConfigs;

  getAppConfig(): AppConfig {
    return { ...this.appConfig };
  }

  getTenantConfig(tenantId: string): TenantConfig | undefined {
    return this.tenantConfigs[tenantId];
  }

  getAllTenantConfigs(): TenantConfig[] {
    return Object.values(this.tenantConfigs);
  }

  getShardConfig(shardId: string): ShardConfig | undefined {
    return this.shardConfigs[shardId];
  }

  getAllShardConfigs(): ShardConfig[] {
    return Object.values(this.shardConfigs);
  }

  getMonthlyShardMapping(tenantId: string, year: number, month: number): MonthlyShardMapping | undefined {
    return this.monthlyShardMappings.find(
      m => m.tenantId === tenantId && m.year === year && m.month === month
    );
  }

  getMonthlyShardMappingsByTimeRange(
    tenantId: string,
    fromYear: number,
    fromMonth: number,
    toYear: number,
    toMonth: number
  ): MonthlyShardMapping[] {
    return this.monthlyShardMappings.filter(m => {
      if (m.tenantId !== tenantId) return false;
      const mappingDate = new Date(m.year, m.month - 1, 1);
      const fromDate = new Date(fromYear, fromMonth - 1, 1);
      const toDate = new Date(toYear, toMonth - 1, 1);
      return mappingDate >= fromDate && mappingDate <= toDate;
    }).sort((a, b) => {
      const dateA = new Date(a.year, a.month - 1, 1);
      const dateB = new Date(b.year, b.month - 1, 1);
      return dateA.getTime() - dateB.getTime();
    });
  }

  getShardRuleConfig(ruleId: string): ShardRuleConfig | undefined {
    return this.shardRuleConfigs[ruleId];
  }

  isMigrationInProgress(tenantId: string): boolean {
    const tenant = this.getTenantConfig(tenantId);
    if (!tenant) return false;
    return tenant.migrationStatus === MigrationStatus.IN_PROGRESS;
  }

  requiresDualWrite(tenantId: string): boolean {
    const tenant = this.getTenantConfig(tenantId);
    if (!tenant) return false;
    return this.isMigrationInProgress(tenantId) && 
           tenant.writeStrategy === 'dual_write';
  }

  requiresDualRead(tenantId: string): boolean {
    const tenant = this.getTenantConfig(tenantId);
    if (!tenant) return false;
    return this.isMigrationInProgress(tenantId) && 
           tenant.readStrategy === 'dual_read';
  }

  getOldAndNewShards(tenantId: string): { oldShard?: ShardConfig; newShard?: ShardConfig } {
    const tenant = this.getTenantConfig(tenantId);
    if (!tenant) return {};
    
    return {
      oldShard: tenant.oldShardId ? this.getShardConfig(tenant.oldShardId) : undefined,
      newShard: tenant.currentShardId ? this.getShardConfig(tenant.currentShardId) : undefined,
    };
  }

  getMaxCrossMonthRange(): number {
    return this.appConfig.maxCrossMonthRange;
  }
}

export const configService = new ConfigService();
