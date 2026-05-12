import { ContractDiff, Exemption, Confirmation, FilterOptions, ServiceConfig } from './types';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export class ComplianceManager {
  private exemptions: Exemption[];
  private confirmations: Confirmation[];
  private services: ServiceConfig[];

  constructor(
    services: ServiceConfig[],
    exemptions: Exemption[] = [],
    confirmations: Confirmation[] = []
  ) {
    this.services = services;
    this.exemptions = exemptions;
    this.confirmations = confirmations;
  }

  addExemption(
    serviceName: string,
    path: string,
    method: string,
    field: string | undefined,
    reason: string,
    expiresInDays: number,
    createdBy: string
  ): Exemption {
    const exemption: Exemption = {
      id: uuidv4(),
      serviceName,
      path,
      method: method.toLowerCase() as any,
      field,
      reason,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      createdBy,
      createdAt: new Date().toISOString()
    };

    this.exemptions.push(exemption);
    return exemption;
  }

  removeExemption(id: string): boolean {
    const index = this.exemptions.findIndex(e => e.id === id);
    if (index !== -1) {
      this.exemptions.splice(index, 1);
      return true;
    }
    return false;
  }

  getExemptions(): Exemption[] {
    return [...this.exemptions];
  }

  addConfirmation(
    diff: ContractDiff,
    confirmedBy: string,
    notes?: string
  ): Confirmation {
    const confirmation: Confirmation = {
      id: uuidv4(),
      diffId: diff.id,
      serviceName: diff.serviceName,
      path: diff.path,
      method: diff.method,
      changeType: diff.changeType,
      field: diff.field,
      confirmedBy,
      confirmedAt: new Date().toISOString(),
      notes,
      changeHash: this.computeDiffHash(diff)
    };

    const existingIndex = this.confirmations.findIndex(
      c =>
        c.serviceName === diff.serviceName &&
        c.path === diff.path &&
        c.method === diff.method &&
        c.changeType === diff.changeType &&
        c.field === diff.field
    );

    if (existingIndex !== -1) {
      const existing = this.confirmations[existingIndex];
      const newHash = this.computeDiffHash(diff);
      if (existing.changeHash !== newHash) {
        console.warn(
          `变更已更新，原确认可能失效: ${diff.serviceName} ${diff.method.toUpperCase()} ${diff.path}`
        );
      }
      this.confirmations[existingIndex] = confirmation;
    } else {
      this.confirmations.push(confirmation);
    }

    return confirmation;
  }

  removeConfirmation(diffId: string): boolean {
    const index = this.confirmations.findIndex(c => c.diffId === diffId);
    if (index !== -1) {
      this.confirmations.splice(index, 1);
      return true;
    }
    return false;
  }

  getConfirmations(): Confirmation[] {
    return [...this.confirmations];
  }

  getConfirmationForDiff(diff: ContractDiff): Confirmation | undefined {
    return this.confirmations.find(
      c =>
        c.serviceName === diff.serviceName &&
        c.path === diff.path &&
        c.method === diff.method &&
        c.changeType === diff.changeType &&
        c.field === diff.field
    );
  }

  isExempted(diff: ContractDiff): boolean {
    const now = new Date();
    return this.exemptions.some(ex => {
      if (new Date(ex.expiresAt) < now) return false;
      if (ex.serviceName !== diff.serviceName) return false;
      if (ex.path !== diff.path) return false;
      if (ex.method !== diff.method) return false;
      if (ex.changeType && ex.changeType !== diff.changeType) return false;
      if (ex.field && ex.field !== diff.field) return false;
      return true;
    });
  }

  isConfirmed(diff: ContractDiff): boolean {
    const confirmation = this.getConfirmationForDiff(diff);
    if (!confirmation) return false;

    const currentHash = this.computeDiffHash(diff);
    return confirmation.changeHash === currentHash;
  }

  applyFilters(diffs: ContractDiff[], options: FilterOptions): ContractDiff[] {
    return diffs.filter(diff => {
      if (options.services && options.services.length > 0) {
        if (!options.services.includes(diff.serviceName)) return false;
      }

      if (options.paths && options.paths.length > 0) {
        if (!options.paths.some(p => diff.path.includes(p))) return false;
      }

      if (options.methods && options.methods.length > 0) {
        if (!options.methods.includes(diff.method)) return false;
      }

      if (options.owners && options.owners.length > 0) {
        const service = this.services.find(s => s.serviceName === diff.serviceName);
        if (!service || !service.owners.some(o => options.owners!.includes(o))) return false;
      }

      if (options.severities && options.severities.length > 0) {
        if (!options.severities.includes(diff.severity)) return false;
      }

      if (options.impacts && options.impacts.length > 0) {
        if (!options.impacts.includes(diff.impact)) return false;
      }

      return true;
    });
  }

  filterByExemptionStatus(
    diffs: ContractDiff[],
    showExempted: boolean = false
  ): ContractDiff[] {
    return diffs.filter(diff => {
      const exempted = this.isExempted(diff);
      return showExempted ? exempted : !exempted;
    });
  }

  filterByConfirmationStatus(
    diffs: ContractDiff[],
    showConfirmed: boolean = false
  ): ContractDiff[] {
    return diffs.filter(diff => {
      const confirmed = this.isConfirmed(diff);
      return showConfirmed ? confirmed : !confirmed;
    });
  }

  getOwnersForService(serviceName: string): string[] {
    const service = this.services.find(s => s.serviceName === serviceName);
    return service?.owners || [];
  }

  private computeDiffHash(diff: ContractDiff): string {
    const data = {
      serviceName: diff.serviceName,
      path: diff.path,
      method: diff.method,
      changeType: diff.changeType,
      field: diff.field,
      oldValue: diff.oldValue,
      newValue: diff.newValue,
      affectedEnumValues: diff.affectedEnumValues,
      affectedResponseCodes: diff.affectedResponseCodes
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}
