import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TrustBundles, TrustBundle } from '../types';

export class YamlParser {
  async parseTrustBundles(filePath: string): Promise<TrustBundles> {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = yaml.load(fileContent) as Record<string, unknown>;
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML structure for trust bundles');
    }

    const bundles: TrustBundles = {};
    const baseDir = path.dirname(filePath);

    for (const [bundleName, bundleData] of Object.entries(parsed)) {
      if (!bundleData || typeof bundleData !== 'object') {
        continue;
      }

      const data = bundleData as Record<string, unknown>;
      
      bundles[bundleName] = {
        name: bundleName,
        rootCerts: this.parseCertPaths(data['root_certs'] || data['rootCerts'], baseDir),
        intermediateCerts: this.parseCertPaths(data['intermediate_certs'] || data['intermediateCerts'], baseDir),
        services: this.parseStringArray(data['services']),
      };
    }

    return bundles;
  }

  private parseCertPaths(value: unknown, baseDir: string): string[] {
    if (!value) {
      return [];
    }

    if (typeof value === 'string') {
      return [path.join(baseDir, value)];
    }

    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === 'string') {
          return path.join(baseDir, item);
        }
        return String(item);
      });
    }

    return [];
  }

  private parseStringArray(value: unknown): string[] {
    if (!value) {
      return [];
    }

    if (typeof value === 'string') {
      return [value.trim()];
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter((s) => s.length > 0);
    }

    return [];
  }
}
