import { ServiceHealth } from '../types';
import { logger } from '../utils/logger';

export class HealthChecker {
  private healthMap: Map<string, ServiceHealth> = new Map();
  private missingServices: Set<string> = new Set();

  constructor(healthData: ServiceHealth[]) {
    for (const health of healthData) {
      const key = `${health.service}:${health.version}`;
      this.healthMap.set(key, health);
    }
    logger.info(`HealthChecker initialized with ${this.healthMap.size} service versions`);
  }

  checkHealth(service: string, version: string): { healthy: boolean; healthInfo?: ServiceHealth; hasData: boolean } {
    const key = `${service}:${version}`;
    const healthInfo = this.healthMap.get(key);

    if (!healthInfo) {
      this.missingServices.add(key);
      logger.warn(`Missing health data for: ${key}`);
      return { healthy: true, hasData: false };
    }

    return {
      healthy: healthInfo.healthy,
      healthInfo,
      hasData: true
    };
  }

  getMissingHealthServices(): string[] {
    return Array.from(this.missingServices);
  }

  isServiceHealthy(service: string, version: string): boolean {
    return this.checkHealth(service, version).healthy;
  }

  getAllHealthData(): ServiceHealth[] {
    return Array.from(this.healthMap.values());
  }
}
