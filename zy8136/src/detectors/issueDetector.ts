import { Issue, HitChain } from '../types';
import { logger } from '../utils/logger';

export class IssueDetector {
  private weightTracking: Map<string, { hits: number; expectedWeight: number }> = new Map();
  private totalRequests: number = 0;

  detectIssues(hitChain: HitChain): Issue[] {
    const issues: Issue[] = [];
    this.totalRequests++;

    issues.push(...this.detectWrongService(hitChain));
    issues.push(...this.detectCanaryHitsHealthy(hitChain));
    issues.push(...this.detectUnhealthyStillShunt(hitChain));
    issues.push(...this.detectMissingHealthData(hitChain));

    this.trackWeight(hitChain);

    return issues;
  }

  private detectWrongService(hitChain: HitChain): Issue[] {
    const issues: Issue[] = [];
    
    if (hitChain.expectedService && hitChain.expectedService !== hitChain.actualService) {
      issues.push({
        type: 'WRONG_SERVICE',
        severity: 'critical',
        message: `Request ${hitChain.requestId} routed to wrong service`,
        details: {
          requestId: hitChain.requestId,
          path: hitChain.path,
          expectedService: hitChain.expectedService,
          actualService: hitChain.actualService,
          headers: hitChain.headers,
          userId: hitChain.userId
        }
      });
      logger.debug(`Detected WRONG_SERVICE for request ${hitChain.requestId}`);
    }
    
    return issues;
  }

  private detectCanaryHitsHealthy(hitChain: HitChain): Issue[] {
    const issues: Issue[] = [];
    
    if (hitChain.canaryEvaluation.rule && !hitChain.canaryEvaluation.shouldHitCanary) {
      if (hitChain.isHealthy) {
        issues.push({
          type: 'HEALTHY_SHOULD_HIT_CANARY',
          severity: 'medium',
          message: `User ${hitChain.userId || 'unknown'} should hit canary but did not (weight-based)`,
          details: {
            requestId: hitChain.requestId,
            userId: hitChain.userId,
            matchedConditions: hitChain.canaryEvaluation.matchedConditions,
            expectedWeight: hitChain.canaryEvaluation.weight,
            targetVersion: hitChain.canaryEvaluation.targetVersion
          }
        });
        logger.debug(`Detected HEALTHY_SHOULD_HIT_CANARY for request ${hitChain.requestId}`);
      }
    }
    
    return issues;
  }

  private detectUnhealthyStillShunt(hitChain: HitChain): Issue[] {
    const issues: Issue[] = [];
    
    if (hitChain.canaryEvaluation.shouldHitCanary && !hitChain.isHealthy) {
      if (hitChain.healthInfo) {
        issues.push({
          type: 'UNHEALTHY_STILL_SHUNT',
          severity: 'critical',
          message: `Request ${hitChain.requestId} would be routed to unhealthy canary version`,
          details: {
            requestId: hitChain.requestId,
            service: hitChain.actualService,
            version: hitChain.actualVersion,
            healthStatus: hitChain.isHealthy,
            errorRate: hitChain.healthInfo.errorRate,
            latencyP99: hitChain.healthInfo.latencyP99,
            lastCheck: hitChain.healthInfo.lastCheck
          }
        });
        logger.debug(`Detected UNHEALTHY_STILL_SHUNT for request ${hitChain.requestId}`);
      }
    }
    
    return issues;
  }

  private detectMissingHealthData(hitChain: HitChain): Issue[] {
    const issues: Issue[] = [];
    
    if (hitChain.canaryEvaluation.rule && !hitChain.healthInfo) {
      issues.push({
        type: 'MISSING_HEALTH_DATA',
        severity: 'high',
        message: `No health data for canary version ${hitChain.actualVersion} of service ${hitChain.actualService}`,
        details: {
          requestId: hitChain.requestId,
          service: hitChain.actualService,
          version: hitChain.actualVersion,
          path: hitChain.path
        }
      });
      logger.debug(`Detected MISSING_HEALTH_DATA for service ${hitChain.actualService}:${hitChain.actualVersion}`);
    }
    
    return issues;
  }

  private trackWeight(hitChain: HitChain): void {
    if (hitChain.canaryEvaluation.rule) {
      const key = `${hitChain.actualService}:${hitChain.actualVersion}`;
      if (!this.weightTracking.has(key)) {
        this.weightTracking.set(key, {
          hits: 0,
          expectedWeight: hitChain.canaryEvaluation.weight
        });
      }
      
      if (hitChain.canaryEvaluation.shouldHitCanary) {
        const tracking = this.weightTracking.get(key)!;
        tracking.hits++;
      }
    }
  }

  detectWeightIssues(): Issue[] {
    const issues: Issue[] = [];
    const tolerance = 0.1;

    for (const [key, tracking] of this.weightTracking.entries()) {
      const actualPercentage = this.totalRequests > 0 
        ? (tracking.hits / this.totalRequests) * 100 
        : 0;
      
      const expectedWeight = tracking.expectedWeight;
      const maxAllowed = expectedWeight * (1 + tolerance);

      if (actualPercentage > maxAllowed && this.totalRequests > 10) {
        const [service, version] = key.split(':');
        issues.push({
          type: 'WEIGHT_EXCEEDS_BUDGET',
          severity: 'high',
          message: `Weight exceeds budget for ${service}:${version}`,
          details: {
            service,
            version,
            expectedWeight: `${expectedWeight}%`,
            actualPercentage: `${actualPercentage.toFixed(2)}%`,
            actualHits: tracking.hits,
            totalRequests: this.totalRequests,
            tolerance: `${tolerance * 100}%`
          }
        });
        logger.debug(`Detected WEIGHT_EXCEEDS_BUDGET for ${key}`);
      }
    }

    return issues;
  }

  getWeightAnalysis(): {
    service: string;
    version: string;
    expectedWeight: number;
    actualHits: number;
    actualPercentage: number;
    isOverBudget: boolean;
  }[] {
    const analysis: {
      service: string;
      version: string;
      expectedWeight: number;
      actualHits: number;
      actualPercentage: number;
      isOverBudget: boolean;
    }[] = [];
    
    const tolerance = 0.1;

    for (const [key, tracking] of this.weightTracking.entries()) {
      const actualPercentage = this.totalRequests > 0 
        ? (tracking.hits / this.totalRequests) * 100 
        : 0;
      
      const maxAllowed = tracking.expectedWeight * (1 + tolerance);
      const isOverBudget = actualPercentage > maxAllowed && this.totalRequests > 10;
      
      const [service, version] = key.split(':');
      analysis.push({
        service,
        version,
        expectedWeight: tracking.expectedWeight,
        actualHits: tracking.hits,
        actualPercentage,
        isOverBudget
      });
    }

    return analysis;
  }
}
