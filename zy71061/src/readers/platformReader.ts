import { DataSourceType, PlatformExport, ServiceRetention } from '../types';
import { parseRetention } from '../utils/unitConverter';
import { readFile, parseJsonOrYaml } from './fileReader';

export function readPlatformFile(filePath: string): ServiceRetention[] {
  const content = readFile(filePath);
  const data = parseJsonOrYaml(content, filePath) as PlatformExport;

  const results: ServiceRetention[] = [];
  const source: DataSourceType = 'platform';

  if (data.services && Array.isArray(data.services)) {
    for (const service of data.services) {
      let retention;
      if (service.log_retention_days !== undefined) {
        retention = parseRetention(service.log_retention_days);
      } else if (service.log_retention !== undefined) {
        retention = parseRetention(service.log_retention);
      } else {
        continue;
      }

      results.push({
        serviceName: service.name,
        retentionDays: retention.days,
        source,
        rawValue: retention.rawValue,
      });
    }
  }

  return results;
}
