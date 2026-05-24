import { DataSourceType, TerraformOutput, ServiceRetention } from '../types';
import { parseRetention } from '../utils/unitConverter';
import { readFile, parseJsonOrYaml } from './fileReader';

export function readTerraformFile(filePath: string): ServiceRetention[] {
  const content = readFile(filePath);
  const data = parseJsonOrYaml(content, filePath) as TerraformOutput;

  const results: ServiceRetention[] = [];
  const source: DataSourceType = 'terraform';

  if (data.log_retention && typeof data.log_retention === 'object') {
    for (const [serviceName, rawRetention] of Object.entries(data.log_retention)) {
      const retention = parseRetention(rawRetention);
      results.push({
        serviceName,
        retentionDays: retention.days,
        source,
        rawValue: retention.rawValue,
      });
    }
  }

  return results;
}
