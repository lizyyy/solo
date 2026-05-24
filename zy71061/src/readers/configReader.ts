import { DataSourceType, RawRetentionConfig, ServiceRetention } from '../types';
import { parseRetention } from '../utils/unitConverter';
import { readFile, parseJsonOrYaml } from './fileReader';

export function readConfigFile(filePath: string): ServiceRetention[] {
  const content = readFile(filePath);
  const data = parseJsonOrYaml(content, filePath) as RawRetentionConfig;

  const results: ServiceRetention[] = [];
  const source: DataSourceType = 'config';

  const defaultRetention = data.defaults?.retention ? parseRetention(data.defaults.retention) : null;

  if (data.services && Array.isArray(data.services)) {
    for (const service of data.services) {
      const retention = service.retention !== undefined
        ? parseRetention(service.retention)
        : defaultRetention;

      if (retention) {
        results.push({
          serviceName: service.name,
          retentionDays: retention.days,
          source,
          rawValue: retention.rawValue,
          aliases: service.aliases || [],
        });
      }
    }
  }

  return results;
}
