import type {
  Service, Endpoint, BudgetRule, MetricPoint, ExceptionApproval, FreezeRecord
} from '../types/index.js';

export interface Database {
  services: Service[];
  endpoints: Endpoint[];
  budgetRules: BudgetRule[];
  metricPoints: MetricPoint[];
  exceptionApprovals: ExceptionApproval[];
  freezeRecords: FreezeRecord[];
}

export let db: Database = {
  services: [],
  endpoints: [],
  budgetRules: [],
  metricPoints: [],
  exceptionApprovals: [],
  freezeRecords: [],
};

export function initDatabase() {
  db = {
    services: [],
    endpoints: [],
    budgetRules: [],
    metricPoints: [],
    exceptionApprovals: [],
    freezeRecords: [],
  };
}
