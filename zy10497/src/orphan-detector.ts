import { ServiceEntry, OrphanEvidence, OrphanReport, OwnerInfo, RepoProbeResult, AlertReference, ProcessingError } from './types';
import { ConfigManager } from './config';

export class OrphanDetector {
  private configManager: ConfigManager;
  private repoResults: Map<string, RepoProbeResult> = new Map();
  private alertResults: Map<string, AlertReference[]> = new Map();

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  public setRepoResults(results: Map<string, RepoProbeResult>): void {
    this.repoResults = results;
  }

  public setAlertResults(results: Map<string, AlertReference[]>): void {
    this.alertResults = results;
  }

  public detectOrphans(services: ServiceEntry[], errors: ProcessingError[]): OrphanReport {
    const orphanServices: OrphanEvidence[] = [];
    const activeServices: ServiceEntry[] = [];
    const criteria = this.configManager.getOrphanCriteria();

    for (const service of services) {
      const evidence = this.checkService(service, criteria);
      
      if (evidence.reasons.length > 0) {
        orphanServices.push(evidence);
      } else {
        activeServices.push(service);
      }
    }

    const owners = this.aggregateOwners(services, orphanServices);

    const orphanRate = services.length > 0 ? (orphanServices.length / services.length) * 100 : 0;

    return {
      generatedAt: new Date().toISOString(),
      totalServices: services.length,
      orphanServices,
      activeServices: activeServices.length,
      owners,
      errors,
      summary: {
        total: services.length,
        orphanCount: orphanServices.length,
        activeCount: activeServices.length,
        errorCount: errors.length,
        orphanRate: Math.round(orphanRate * 100) / 100
      }
    };
  }

  private checkService(service: ServiceEntry, criteria: any): OrphanEvidence {
    const reasons: string[] = [];
    const repoCheck = this.repoResults.get(service.id);
    const alertReferences = this.alertResults.get(service.id) || [];

    if (criteria.inactiveStatus && service.status === 'deprecated') {
      reasons.push('服务标记为已废弃');
    }

    if (repoCheck) {
      if (!repoCheck.exists) {
        reasons.push('仓库不存在');
      } else if (criteria.repoArchived && repoCheck.isArchived) {
        reasons.push('仓库已归档');
      } else if (criteria.noCommitSinceDays && repoCheck.lastCommitDate) {
        const lastCommit = new Date(repoCheck.lastCommitDate);
        const daysSince = Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > criteria.noCommitSinceDays) {
          reasons.push(`仓库超过 ${criteria.noCommitSinceDays} 天无提交 (最后提交: ${daysSince} 天前)`);
        }
      }
    }

    return {
      serviceId: service.id,
      serviceName: service.name,
      reasons,
      repoCheck,
      alertReferences
    };
  }

  private aggregateOwners(services: ServiceEntry[], orphanServices: OrphanEvidence[]): OwnerInfo[] {
    const ownerMap = new Map<string, { services: string[]; orphanServices: string[] }>();

    for (const service of services) {
      for (const owner of service.owners) {
        if (!ownerMap.has(owner)) {
          ownerMap.set(owner, { services: [], orphanServices: [] });
        }
        ownerMap.get(owner)!.services.push(service.name);
      }
    }

    for (const orphan of orphanServices) {
      const service = services.find(s => s.id === orphan.serviceId);
      if (service) {
        for (const owner of service.owners) {
          if (ownerMap.has(owner)) {
            ownerMap.get(owner)!.orphanServices.push(service.name);
          }
        }
      }
    }

    return Array.from(ownerMap.entries())
      .map(([name, data]) => ({
        name,
        services: data.services,
        orphanServices: data.orphanServices
      }))
      .sort((a, b) => b.orphanServices.length - a.orphanServices.length);
  }

  public getOrphanServicesByOwner(owners: OwnerInfo[]): Map<string, string[]> {
    const result = new Map<string, string[]>();
    
    for (const owner of owners) {
      if (owner.orphanServices.length > 0) {
        result.set(owner.name, [...owner.orphanServices]);
      }
    }
    
    return result;
  }
}
