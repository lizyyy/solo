import * as fs from 'fs';
import * as yaml from 'yaml';
import { ServiceMap } from '../model/types';

export class ServiceMapParser {
  parseFile(filePath: string): ServiceMap {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.parse(content);
    return this.normalize(data);
  }

  private normalize(data: Record<string, unknown>): ServiceMap {
    const services: ServiceMap['services'] = [];
    const connections: ServiceMap['connections'] = [];

    if (Array.isArray(data.services)) {
      for (const svc of data.services) {
        services.push({
          name: svc.name as string || svc.serviceName as string || svc.service_name as string,
          type: svc.type as string || 'unknown',
        });
      }
    }

    if (Array.isArray(data.connections)) {
      for (const conn of data.connections) {
        connections.push({
          from: conn.from as string,
          to: conn.to as string,
        });
      }
    } else if (Array.isArray(data.edges)) {
      for (const edge of data.edges) {
        connections.push({
          from: edge.from as string || edge.source as string,
          to: edge.to as string || edge.target as string,
        });
      }
    }

    return { services, connections };
  }
}