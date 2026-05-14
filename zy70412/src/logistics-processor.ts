import { LogisticsInterception, CompensationAction, SchemaDiff } from './types';
import { SchemaDiffer } from './schema-diff';
import { v4 as uuidv4 } from 'uuid';

export class LogisticsProcessor {
  private differ: SchemaDiffer;

  constructor() {
    this.differ = new SchemaDiffer();
  }

  validateInterception(interception: LogisticsInterception, referenceSchema: any): {
    valid: boolean;
    failedPath?: string;
    schemaDiffs: SchemaDiff[];
    missingCompensations: CompensationAction[];
  } {
    const schemaDiffs = this.differ.compare(
      this.interceptionToSchema(interception),
      referenceSchema
    );

    const missingCompensations = this.checkCompensationActions(interception);
    const failedPath = this.detectFailedPath(interception, schemaDiffs, missingCompensations);

    return {
      valid: !failedPath,
      failedPath,
      schemaDiffs,
      missingCompensations
    };
  }

  private interceptionToSchema(interception: LogisticsInterception): any {
    return {
      status: interception.status,
      grayRelease: interception.grayRelease,
      hasCompensationActions: interception.compensationActions.length > 0,
      allCompensationsExecuted: interception.compensationActions.every(c => c.executed),
      requiredCompensationsCount: interception.compensationActions.filter(c => c.required).length
    };
  }

  private checkCompensationActions(interception: LogisticsInterception): CompensationAction[] {
    return interception.compensationActions.filter(action => 
      action.required && !action.executed
    );
  }

  private detectFailedPath(
    interception: LogisticsInterception,
    schemaDiffs: SchemaDiff[],
    missingCompensations: CompensationAction[]
  ): string | undefined {
    if (missingCompensations.length > 0) {
      return `COMPENSATION_MISSING: ${missingCompensations.map(c => c.name).join(', ')}`;
    }

    if (this.differ.hasCriticalDiffs(schemaDiffs)) {
      return 'SCHEMA_CRITICAL_DIFF';
    }

    if (interception.grayRelease && interception.status === 'failed') {
      return 'GRAY_RELEASE_FAILED';
    }

    if (interception.status === 'intercepted' && !interception.interceptionTime) {
      return 'INTERCEPTION_TIME_MISSING';
    }

    return undefined;
  }

  createPreview(items: LogisticsInterception[]): {
    totalCount: number;
    willFail: number;
    willSucceed: number;
    failureGroups: Record<string, string[]>;
    affectedPartitions: string[];
  } {
    const failureGroups: Record<string, string[]> = {};
    const affectedPartitions = new Set<string>();

    let willFail = 0;
    let willSucceed = 0;

    for (const item of items) {
      const partition = this.derivePartition(item);
      affectedPartitions.add(partition);

      const result = this.simulateProcessing(item);
      if (result.willFail) {
        willFail++;
        const group = result.failureGroup || 'UNKNOWN';
        if (!failureGroups[group]) {
          failureGroups[group] = [];
        }
        failureGroups[group].push(item.orderId);
      } else {
        willSucceed++;
      }
    }

    return {
      totalCount: items.length,
      willFail,
      willSucceed,
      failureGroups,
      affectedPartitions: Array.from(affectedPartitions)
    };
  }

  private simulateProcessing(item: LogisticsInterception): { willFail: boolean; failureGroup?: string } {
    const missingCompensations = item.compensationActions.filter(a => a.required && !a.executed);
    if (missingCompensations.length > 0) {
      return { willFail: true, failureGroup: 'COMPENSATION_MISSING' };
    }

    if (item.grayRelease && item.status === 'failed') {
      return { willFail: true, failureGroup: 'GRAY_RELEASE_FAILED' };
    }

    if (item.status === 'intercepted' && !item.interceptionTime) {
      return { willFail: true, failureGroup: 'INTERCEPTION_TIME_MISSING' };
    }

    return { willFail: false };
  }

  derivePartition(item: LogisticsInterception): string {
    const date = item.interceptionTime 
      ? new Date(item.interceptionTime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    return `date=${date}/gray=${item.grayRelease}`;
  }

  groupByFailure(items: LogisticsInterception[]): Record<string, LogisticsInterception[]> {
    const groups: Record<string, LogisticsInterception[]> = {};

    for (const item of items) {
      const result = this.simulateProcessing(item);
      const group = result.failureGroup || 'SUCCESS';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
    }

    return groups;
  }
}
