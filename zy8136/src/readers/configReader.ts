import * as fs from 'fs';
import * as yaml from 'js-yaml';
import csv from 'csv-parser';
import { RoutesConfig, TrafficSample, CanaryPolicy, ServiceHealth } from '../types';
import { logger } from '../utils/logger';

export class ConfigReader {
  static async readRoutes(path: string): Promise<RoutesConfig> {
    logger.debug(`Reading routes from: ${path}`);
    const content = fs.readFileSync(path, 'utf-8');
    const config = yaml.load(content) as RoutesConfig;
    
    if (!config.routes || !Array.isArray(config.routes)) {
      throw new Error('Invalid routes.yaml: expected routes array');
    }
    
    logger.info(`Loaded ${config.routes.length} routes`);
    return config;
  }

  static async readTrafficSamples(path: string): Promise<TrafficSample[]> {
    logger.debug(`Reading traffic samples from: ${path}`);
    const samples: TrafficSample[] = [];
    const content = fs.readFileSync(path, 'utf-8');
    const lines = content.trim().split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const sample = JSON.parse(line) as TrafficSample;
          samples.push(sample);
        } catch (error) {
          logger.warn(`Failed to parse JSON line: ${line.substring(0, 50)}...`);
        }
      }
    }
    
    logger.info(`Loaded ${samples.length} traffic samples`);
    return samples;
  }

  static async readCanaryPolicy(path: string): Promise<CanaryPolicy> {
    logger.debug(`Reading canary policy from: ${path}`);
    const content = fs.readFileSync(path, 'utf-8');
    const policy = yaml.load(content) as CanaryPolicy;
    
    if (!policy.rules || !Array.isArray(policy.rules)) {
      throw new Error('Invalid canary_policy.yaml: expected rules array');
    }
    
    logger.info(`Loaded ${policy.rules.length} canary rules`);
    return policy;
  }

  static async readServiceHealth(path: string): Promise<ServiceHealth[]> {
    logger.debug(`Reading service health from: ${path}`);
    return new Promise((resolve, reject) => {
      const healthData: ServiceHealth[] = [];
      
      fs.createReadStream(path)
        .pipe(csv())
        .on('data', (row: Record<string, string>) => {
          healthData.push({
            service: row.service,
            version: row.version,
            healthy: row.healthy === 'true' || row.healthy === '1',
            lastCheck: row.lastCheck,
            errorRate: parseFloat(row.errorRate) || 0,
            latencyP99: parseFloat(row.latencyP99) || 0
          });
        })
        .on('end', () => {
          logger.info(`Loaded ${healthData.length} service health records`);
          resolve(healthData);
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }
}
