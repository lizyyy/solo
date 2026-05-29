import { AllData, CheckResult } from '../types';
import { checkPageContinuity } from './pageChecker';
import { checkDistributions } from './distributionChecker';
import { checkRevisions } from './revisionChecker';

export interface CheckSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  open: number;
  resolved: number;
  byType: {
    page: number;
    distribution: number;
    revision: number;
  };
}

export function runAllChecks(data: AllData): CheckResult[] {
  const pageResults = checkPageContinuity(data.parts);
  const distributionResults = checkDistributions(
    data.distributions,
    data.musicians,
    data.parts
  );
  const revisionResults = checkRevisions(
    data.revisions,
    data.distributions,
    data.musicians,
    data.parts
  );

  return [...pageResults, ...distributionResults, ...revisionResults];
}

export function getCheckSummary(results: CheckResult[]): CheckSummary {
  const summary: CheckSummary = {
    total: results.length,
    errors: 0,
    warnings: 0,
    infos: 0,
    open: 0,
    resolved: 0,
    byType: {
      page: 0,
      distribution: 0,
      revision: 0,
    },
  };

  results.forEach((r) => {
    summary.byType[r.type]++;
    if (r.severity === 'error') summary.errors++;
    else if (r.severity === 'warning') summary.warnings++;
    else if (r.severity === 'info') summary.infos++;

    if (r.status === 'open') summary.open++;
    else if (r.status === 'resolved') summary.resolved++;
  });

  return summary;
}

export function filterResults(
  results: CheckResult[],
  filters: {
    type?: string;
    severity?: string;
    status?: string;
    partId?: string;
  }
): CheckResult[] {
  return results.filter((r) => {
    if (filters.type && r.type !== filters.type) return false;
    if (filters.severity && r.severity !== filters.severity) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.partId && r.partId !== filters.partId) return false;
    return true;
  });
}
