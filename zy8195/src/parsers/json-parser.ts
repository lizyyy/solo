import * as fs from 'fs';
import { ServiceGraph, ServiceInfo, ServiceRelationship } from '../types';

export class JsonParser {
  async parseServiceGraph(filePath: string): Promise<ServiceGraph> {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(fileContent) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON structure for service graph');
    }

    const services = this.parseServices(parsed['services']);
    const relationships = this.parseRelationships(parsed['relationships']);

    return {
      services,
      relationships,
    };
  }

  private parseServices(value: unknown): ServiceInfo[] {
    if (!value || !Array.isArray(value)) {
      return [];
    }

    return value.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Invalid service at index ${index}`);
      }

      const data = item as Record<string, unknown>;
      const name = this.parseString(data['name']);
      
      if (!name) {
        throw new Error(`Missing service name at index ${index}`);
      }

      return {
        name,
        trustBundle: this.parseString(data['trust_bundle']) || this.parseString(data['trustBundle']) || 'default',
        endpoint: this.parseString(data['endpoint']) || '',
      };
    });
  }

  private parseRelationships(value: unknown): ServiceRelationship[] {
    if (!value || !Array.isArray(value)) {
      return [];
    }

    return value.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Invalid relationship at index ${index}`);
      }

      const data = item as Record<string, unknown>;
      const client = this.parseString(data['client']);
      const server = this.parseString(data['server']);

      if (!client || !server) {
        throw new Error(`Missing client or server in relationship at index ${index}`);
      }

      return {
        client,
        server,
        protocol: this.parseString(data['protocol']) || 'http',
        requiresMtls: this.parseBoolean(data['requires_mtls']) || this.parseBoolean(data['requiresMtls']) || false,
      };
    });
  }

  private parseString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value.trim();
    }
    return undefined;
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === 'yes' || lower === '1';
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return undefined;
  }
}
